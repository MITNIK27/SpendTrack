from fastapi.testclient import TestClient
from sqlalchemy import text

from tests.conftest import ADMIN_EMAIL, APPROVER_EMAIL, EMPLOYEE_EMAIL, headers


def _user_id(client: TestClient, email: str) -> str:
    users = client.get("/api/users", headers=headers(ADMIN_EMAIL)).json()
    return next(u["id"] for u in users if u["email"] == email)


def test_team_members_round_trip_on_initiative_and_spend_request(client: TestClient, db) -> None:
    approver_id = _user_id(client, APPROVER_EMAIL)
    employee_id = _user_id(client, EMPLOYEE_EMAIL)

    initiative = client.post(
        "/api/initiatives",
        headers=headers(ADMIN_EMAIL),
        json={"name": "__test__ Team Members Initiative", "team_member_ids": [approver_id, employee_id]},
    ).json()

    try:
        assert {m["id"] for m in initiative["team_members"]} == {approver_id, employee_id}

        categories = client.get("/api/categories", headers=headers(ADMIN_EMAIL)).json()
        category_id = categories[0]["id"]

        spend_request = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(ADMIN_EMAIL),
            json={
                "category_id": category_id,
                "description": "Team offsite",
                "requested_amount": 5000,
                "team_member_ids": [employee_id],
            },
        ).json()
        assert {m["id"] for m in spend_request["team_members"]} == {employee_id}

        # Unknown id is rejected.
        bad = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(ADMIN_EMAIL),
            json={
                "category_id": category_id,
                "description": "Bad team id",
                "requested_amount": 100,
                "team_member_ids": ["00000000-0000-0000-0000-000000000000"],
            },
        )
        assert bad.status_code == 400
    finally:
        db.execute(text("DELETE FROM activity_logs WHERE entity_id = :id"), {"id": initiative["id"]})
        db.execute(
            text("DELETE FROM spend_request_team_members WHERE spend_request_id IN "
                 "(SELECT id FROM spend_requests WHERE initiative_id = :id)"),
            {"id": initiative["id"]},
        )
        db.execute(text("DELETE FROM spend_requests WHERE initiative_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM initiative_team_members WHERE initiative_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM initiatives WHERE id = :id"), {"id": initiative["id"]})
        db.commit()
