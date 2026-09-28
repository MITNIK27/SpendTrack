"""Throttles error-alert emails so a repeating error (e.g. a client hammering
a broken endpoint) sends one email per window instead of flooding the inbox.
Every occurrence is still logged to the DB regardless — this only throttles
the email side effect. In-process only: fine for a single-instance backend;
a multi-instance deployment would want this in the DB/Redis instead.
"""

import threading
import time

_THROTTLE_WINDOW_SECONDS = 15 * 60

_lock = threading.Lock()
_last_alerted_at: dict[tuple[int, str], float] = {}


def should_alert(status_code: int, path: str) -> bool:
    key = (status_code, path)
    now = time.monotonic()
    with _lock:
        last = _last_alerted_at.get(key)
        if last is not None and now - last < _THROTTLE_WINDOW_SECONDS:
            return False
        _last_alerted_at[key] = now
        return True
