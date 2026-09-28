"""Persists every log record (app code + uvicorn) to the `logs` table, in
addition to the normal stdout stream, so logs survive a restart and are
queryable instead of living only in the server's terminal.

DB writes happen on a background thread via QueueHandler/QueueListener so a
slow/unavailable DB never blocks the request thread that triggered the log.

DBLogHandler holds ONE long-lived session per listener thread rather than
opening a new SessionLocal() per log line — against a pooled remote Postgres
(Supabase), checking a connection in/out of the pool for every single
request's log line adds up fast and, under sustained load, can exhaust the
pooler's connection limit (observed during this feature's own test run: a
21-minute suite with a DB write per request eventually hit "server closed
the connection unexpectedly"). One reused connection per listener thread,
with auto-recovery if it goes stale, avoids that.
"""

import logging
import logging.handlers
import queue
import traceback

from sqlalchemy.orm import Session

from app.core.db import SessionLocal
from app.models.log_entry import LOG_LEVELS, LogEntry

_listeners: list[logging.handlers.QueueListener] = []


class DBLogHandler(logging.Handler):
    def __init__(self) -> None:
        super().__init__()
        self._session: Session | None = None

    def _write(self, entry: LogEntry) -> None:
        if self._session is None:
            self._session = SessionLocal()
        self._session.add(entry)
        self._session.commit()

    def emit(self, record: logging.LogRecord) -> None:
        level = record.levelname if record.levelname in LOG_LEVELS else "INFO"
        stack_trace = None
        if record.exc_info:
            stack_trace = "".join(traceback.format_exception(*record.exc_info))
        entry = LogEntry(
            level=level,
            logger_name=record.name,
            message=record.getMessage(),
            module=record.module,
            path=getattr(record, "path", None),
            method=getattr(record, "method", None),
            status_code=getattr(record, "status_code", None),
            user_id=getattr(record, "user_id", None),
            user_email=getattr(record, "user_email", None),
            stack_trace=stack_trace,
        )
        try:
            self._write(entry)
        except Exception:
            # The held connection may have gone stale (pooler-side idle
            # disconnect) — drop it and retry once with a fresh one before
            # giving up on this record.
            if self._session is not None:
                try:
                    self._session.rollback()
                except Exception:
                    pass
                try:
                    self._session.close()
                except Exception:
                    pass
                self._session = None
            try:
                self._write(entry)
            except Exception:
                # Logging must never itself crash the app or the request
                # that triggered it (e.g. the DB being briefly unreachable).
                self.handleError(record)


def configure_logging() -> None:
    """Idempotent — safe to call more than once (e.g. under a reloader)."""
    if _listeners:
        return

    # Root logger (all app code via logging.getLogger(__name__)): DB + console.
    app_queue: queue.Queue = queue.Queue(-1)
    app_queue_handler = logging.handlers.QueueHandler(app_queue)

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))

    app_listener = logging.handlers.QueueListener(
        app_queue, stream_handler, DBLogHandler(), respect_handler_level=True
    )
    app_listener.start()
    _listeners.append(app_listener)

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(app_queue_handler)

    # uvicorn's own loggers run with propagate=False and already print to the
    # console via their own handlers — attach a DB-only queue so their
    # access/error lines are also persisted without printing twice.
    uvicorn_queue: queue.Queue = queue.Queue(-1)
    uvicorn_queue_handler = logging.handlers.QueueHandler(uvicorn_queue)
    uvicorn_listener = logging.handlers.QueueListener(uvicorn_queue, DBLogHandler(), respect_handler_level=True)
    uvicorn_listener.start()
    _listeners.append(uvicorn_listener)

    for name in ("uvicorn.error", "uvicorn.access"):
        logging.getLogger(name).addHandler(uvicorn_queue_handler)
