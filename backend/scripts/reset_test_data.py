"""One-off: wipe all initiative/spend-request test data before stakeholder testing.

Deletes (in FK-safe order): approval_actions, spend_request_line_items,
spend_request_team_members, spend_requests, initiative_team_members,
initiatives, and activity_logs. Leaves users, categories, and subcategories
untouched.

Usage:
    python -m scripts.reset_test_data            # dry run — shows counts only
    python -m scripts.reset_test_data --confirm   # actually deletes
"""

import sys

from sqlalchemy import create_engine, text

from app.core.config import settings

TABLES_IN_DELETE_ORDER = [
    "approval_actions",
    "spend_request_line_items",
    "spend_request_team_members",
    "spend_requests",
    "initiative_team_members",
    "initiatives",
    "activity_logs",
]


def main() -> None:
    confirm = "--confirm" in sys.argv
    engine = create_engine(settings.database_url)

    with engine.connect() as conn:
        print(f"Database: {engine.url.host}/{engine.url.database}\n")
        counts = {}
        for table in TABLES_IN_DELETE_ORDER:
            count = conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar_one()
            counts[table] = count
            print(f"  {table:<28} {count} row(s) to delete")

        remaining_users = conn.execute(text("SELECT COUNT(*) FROM users")).scalar_one()
        remaining_categories = conn.execute(text("SELECT COUNT(*) FROM categories")).scalar_one()
        print(f"\n  {'users (kept)':<28} {remaining_users}")
        print(f"  {'categories (kept)':<28} {remaining_categories}")

        if not confirm:
            print("\nDry run only — nothing deleted. Re-run with --confirm to actually delete.")
            return

        if sum(counts.values()) == 0:
            print("\nNothing to delete.")
            return

        for table in TABLES_IN_DELETE_ORDER:
            conn.execute(text(f"DELETE FROM {table}"))
        conn.commit()
        print("\nDone — all test data deleted. Users and categories preserved.")


if __name__ == "__main__":
    main()
