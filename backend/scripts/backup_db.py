"""Dumps every table in the configured database to one timestamped JSON file.

Read-only. Run from backend/:  python -m scripts.backup_db
Writes backups/backup_<YYYYmmdd_HHMMSS>.json (the folder is gitignored) and prints per-table row counts.
"""
import json
from datetime import datetime
from pathlib import Path

from sqlalchemy import MetaData, select

from app.core.db import engine


def main() -> None:
    metadata = MetaData()
    metadata.reflect(bind=engine)
    dump: dict[str, list[dict]] = {}
    with engine.connect() as conn:
        for name, table in sorted(metadata.tables.items()):
            dump[name] = [dict(row._mapping) for row in conn.execute(select(table))]
            print(f"{name}: {len(dump[name])} rows")

    backups_dir = Path(__file__).resolve().parent.parent / "backups"
    backups_dir.mkdir(exist_ok=True)
    path = backups_dir / f"backup_{datetime.now():%Y%m%d_%H%M%S}.json"
    path.write_text(json.dumps(dump, indent=1, default=str), encoding="utf-8")
    print(f"\nBackup written to {path}")


if __name__ == "__main__":
    main()
