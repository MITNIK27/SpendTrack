"""Seed the dev users used by the X-Dev-User-Email stub (see app/core/security.py).

Run with:  python -m scripts.seed_users
Safe to re-run — upserts by email.
"""

from app.core.db import SessionLocal
from app.models.user import User

DEV_USERS = [
    {"email": "paarth.sahni@infobeans.com", "display_name": "Paarth Sahni", "role": "admin"},
    {"email": "siddharth.sethi@infobeans.com", "display_name": "Siddharth Sethi", "role": "approver"},
    {"email": "test.@infobeans.com", "display_name": "Test Team Member", "role": "employee"},
]


def run() -> None:
    db = SessionLocal()
    try:
        for spec in DEV_USERS:
            user = db.query(User).filter(User.email == spec["email"]).one_or_none()
            if user is None:
                db.add(User(**spec))
                print(f"created {spec['email']} ({spec['role']})")
            else:
                user.display_name = spec["display_name"]
                user.role = spec["role"]
                print(f"updated {spec['email']} ({spec['role']})")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    run()
