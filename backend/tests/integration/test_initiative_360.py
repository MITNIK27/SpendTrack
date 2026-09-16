from fastapi.testclient import TestClient
from sqlalchemy import text

from tests.conftest import ADMIN_EMAIL, APPROVER_EMAIL, headers


def _first_category_id(client: TestClient) -> str:
    categories = client.get("/api/categories", headers=headers(ADMIN_EMAIL)).json()
    return categories[0]["id"]


def test_initiative_financial_summary_rolls_up_approved_actual_and_balance(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(ADMIN_EMAIL), json={"name": "__test__ ITC Vegas 2026"}
    ).json()

    try:
        category_id = _first_category_id(client)

        booth = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(ADMIN_EMAIL),
            json={"category_id": category_id, "description": "Booth", "requested_amount": 800000},
        ).json()
        travel = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(ADMIN_EMAIL),
            json={"category_id": category_id, "description": "Travel", "requested_amount": 300000},
        ).json()
        client.post(f"/api/initiatives/{initiative['id']}/submit", headers=headers(ADMIN_EMAIL))

        # No approval-decision endpoint exists yet (see notes) — set approved/actual
        # directly to exercise the read-side rollup in isolation.
        db.execute(
            text("UPDATE spend_requests SET status = 'closed', approved_amount = 800000, actual_amount = 800000 "
                 "WHERE id = :id"),
            {"id": booth["id"]},
        )
        db.execute(
            text("UPDATE spend_requests SET status = 'approved', approved_amount = 300000, actual_amount = 120000 "
                 "WHERE id = :id"),
            {"id": travel["id"]},
        )
        db.commit()

        detail = client.get(f"/api/initiatives/{initiative['id']}", headers=headers(APPROVER_EMAIL)).json()
        summary = detail["financial_summary"]
        assert summary["total_requested"] == "1100000.00"
        assert summary["total_approved"] == "1100000.00"
        assert summary["total_actual"] == "920000.00"
        assert summary["total_balance"] == "180000.00"
        assert summary["spend_request_count"] == 2

        by_id = {sr["id"]: sr for sr in detail["spend_requests"]}
        assert by_id[booth["id"]]["actual_amount"] == "800000.00"
        assert by_id[travel["id"]]["actual_amount"] == "120000.00"
    finally:
        db.execute(text("DELETE FROM activity_logs WHERE entity_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM spend_requests WHERE initiative_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM initiatives WHERE id = :id"), {"id": initiative["id"]})
        db.commit()
