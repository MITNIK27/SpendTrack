from fastapi.testclient import TestClient
from sqlalchemy import text

from tests.conftest import ADMIN_EMAIL, APPROVER_EMAIL, EMPLOYEE_EMAIL, headers


def _first_category_id(client: TestClient) -> str:
    categories = client.get("/api/categories", headers=headers(ADMIN_EMAIL)).json()
    return categories[0]["id"]


def _cleanup(db, initiative_id: str) -> None:
    db.execute(text("DELETE FROM approval_actions WHERE spend_request_id IN "
                     "(SELECT id FROM spend_requests WHERE initiative_id = :id)"), {"id": initiative_id})
    db.execute(text("DELETE FROM activity_logs WHERE entity_id = :id "
                     "OR entity_id IN (SELECT id FROM spend_requests WHERE initiative_id = :id)"),
               {"id": initiative_id})
    db.execute(text("DELETE FROM spend_requests WHERE initiative_id = :id"), {"id": initiative_id})
    db.execute(text("DELETE FROM initiatives WHERE id = :id"), {"id": initiative_id})
    db.commit()


def _submitted_initiative_with_pending_spend(client: TestClient, name: str, amounts: list[int]) -> dict:
    initiative = client.post("/api/initiatives", headers=headers(EMPLOYEE_EMAIL), json={"name": name}).json()
    category_id = _first_category_id(client)
    srs = [
        client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(EMPLOYEE_EMAIL),
            json={"category_id": category_id, "description": "Something", "requested_amount": amount},
        ).json()
        for amount in amounts
    ]
    client.post(
        f"/api/initiatives/{initiative['id']}/submit",
        headers=headers(EMPLOYEE_EMAIL),
        json={"spend_request_ids": [sr["id"] for sr in srs]},
    )
    initiative["spend_request_ids"] = [sr["id"] for sr in srs]
    return initiative


def test_approve_batch_approves_only_selected_rows_with_remarks(client: TestClient, db) -> None:
    initiative = _submitted_initiative_with_pending_spend(client, "__test__ Approve Batch", [100000, 50000, 25000])
    try:
        sr1, sr2, sr3 = initiative["spend_request_ids"]

        resp = client.post(
            "/api/spend-requests/approve-batch",
            headers=headers(APPROVER_EMAIL),
            json={"decisions": [{"spend_request_id": sr1, "comment": "Go ahead"}, {"spend_request_id": sr2}]},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert {sr["id"] for sr in body} == {sr1, sr2}
        assert all(sr["status"] == "approved" for sr in body)
        assert all(sr["approved_amount"] == sr["requested_amount"] for sr in body)

        by_id = {sr["id"]: sr for sr in body}
        assert by_id[sr1]["latest_decision_comment"] == "Go ahead"
        assert by_id[sr2]["latest_decision_comment"] is None

        # The third, unselected request stays untouched — pending, not rejected.
        untouched = client.get(f"/api/spend-requests/{sr3}", headers=headers(APPROVER_EMAIL)).json()
        assert untouched["status"] == "submitted"

        # Remark shows up in the activity log too.
        activity = client.get(f"/api/spend-requests/{sr1}/activity", headers=headers(APPROVER_EMAIL)).json()
        matching = [e for e in activity if e["action"] == "spend_approved"]
        assert matching and matching[0]["log_metadata"]["comment"] == "Go ahead"
    finally:
        _cleanup(db, initiative["id"])


def test_approve_batch_skips_invalid_and_already_decided_ids(client: TestClient, db) -> None:
    initiative = _submitted_initiative_with_pending_spend(client, "__test__ Approve Batch Skip", [1000])
    try:
        sr1 = initiative["spend_request_ids"][0]
        # Decide it once already.
        client.post(
            "/api/spend-requests/approve-batch",
            headers=headers(APPROVER_EMAIL),
            json={"decisions": [{"spend_request_id": sr1}]},
        )
        # Re-submitting the same id (already approved) and a nonexistent one — no error, just skipped.
        resp = client.post(
            "/api/spend-requests/approve-batch",
            headers=headers(APPROVER_EMAIL),
            json={"decisions": [{"spend_request_id": sr1}, {"spend_request_id": "00000000-0000-0000-0000-000000000000"}]},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json() == []
    finally:
        _cleanup(db, initiative["id"])


def test_employee_cannot_approve_batch(client: TestClient, db) -> None:
    initiative = _submitted_initiative_with_pending_spend(client, "__test__ Approve Batch Employee", [1000])
    try:
        sr1 = initiative["spend_request_ids"][0]
        resp = client.post(
            "/api/spend-requests/approve-batch",
            headers=headers(EMPLOYEE_EMAIL),
            json={"decisions": [{"spend_request_id": sr1}]},
        )
        assert resp.status_code == 403
    finally:
        _cleanup(db, initiative["id"])
