from fastapi.testclient import TestClient
from sqlalchemy import text

from tests.conftest import ADMIN_EMAIL, APPROVER_EMAIL, EMPLOYEE_EMAIL, headers


def _first_category_id(client: TestClient) -> str:
    categories = client.get("/api/categories", headers=headers(ADMIN_EMAIL)).json()
    return categories[0]["id"]


def _approved_spend_request(client: TestClient, initiative_id: str, amount: int = 200000) -> dict:
    category_id = _first_category_id(client)
    created = client.post(
        f"/api/initiatives/{initiative_id}/spend-requests",
        headers=headers(EMPLOYEE_EMAIL),
        json={"category_id": category_id, "description": "Conference Registration", "requested_amount": amount},
    ).json()
    client.post(f"/api/initiatives/{initiative_id}/submit", headers=headers(EMPLOYEE_EMAIL))
    client.post(f"/api/spend-requests/{created['id']}/submit", headers=headers(EMPLOYEE_EMAIL))
    client.post(
        f"/api/spend-requests/{created['id']}/decisions",
        headers=headers(APPROVER_EMAIL),
        json={"action": "approve"},
    )
    return created


def _cleanup(db, initiative_id: str) -> None:
    db.execute(text("DELETE FROM approval_actions WHERE spend_request_id IN "
                     "(SELECT id FROM spend_requests WHERE initiative_id = :id)"), {"id": initiative_id})
    db.execute(text("DELETE FROM activity_logs WHERE entity_id = :id"), {"id": initiative_id})
    db.execute(text("DELETE FROM spend_requests WHERE initiative_id = :id"), {"id": initiative_id})
    db.execute(text("DELETE FROM initiatives WHERE id = :id"), {"id": initiative_id})
    db.commit()


def test_employee_cannot_record_actual(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(EMPLOYEE_EMAIL), json={"name": "__test__ Employee Cannot Record Actual"}
    ).json()
    try:
        sr = _approved_spend_request(client, initiative["id"])
        resp = client.post(
            f"/api/spend-requests/{sr['id']}/actual",
            headers=headers(EMPLOYEE_EMAIL),
            json={"actual_amount": 180000},
        )
        assert resp.status_code == 403
    finally:
        _cleanup(db, initiative["id"])


def test_approver_cannot_record_actual(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(EMPLOYEE_EMAIL), json={"name": "__test__ Approver Cannot Record Actual"}
    ).json()
    try:
        sr = _approved_spend_request(client, initiative["id"])
        resp = client.post(
            f"/api/spend-requests/{sr['id']}/actual",
            headers=headers(APPROVER_EMAIL),
            json={"actual_amount": 180000},
        )
        assert resp.status_code == 403
    finally:
        _cleanup(db, initiative["id"])


def test_cannot_record_actual_before_approval(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(EMPLOYEE_EMAIL), json={"name": "__test__ Actual Before Approval"}
    ).json()
    try:
        category_id = _first_category_id(client)
        draft = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(EMPLOYEE_EMAIL),
            json={"category_id": category_id, "description": "Something", "requested_amount": 1000},
        ).json()
        client.post(f"/api/initiatives/{initiative['id']}/submit", headers=headers(EMPLOYEE_EMAIL))
        client.post(f"/api/spend-requests/{draft['id']}/submit", headers=headers(EMPLOYEE_EMAIL))

        resp = client.post(
            f"/api/spend-requests/{draft['id']}/actual",
            headers=headers(ADMIN_EMAIL),
            json={"actual_amount": 900},
        )
        assert resp.status_code == 409
    finally:
        _cleanup(db, initiative["id"])


def test_record_actual_transitions_to_spent(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(EMPLOYEE_EMAIL), json={"name": "__test__ Record Actual"}
    ).json()
    try:
        sr = _approved_spend_request(client, initiative["id"], amount=200000)

        resp = client.post(
            f"/api/spend-requests/{sr['id']}/actual",
            headers=headers(ADMIN_EMAIL),
            json={"actual_amount": 182500, "actual_spend_date": "2026-09-20T00:00:00Z"},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["status"] == "spent"
        assert body["actual_amount"] == "182500.00"
        assert body["spent_at"] is not None

        activity = client.get(
            f"/api/spend-requests/{sr['id']}/activity", headers=headers(APPROVER_EMAIL)
        ).json()
        assert any(entry["action"] == "actual_recorded" for entry in activity)
    finally:
        _cleanup(db, initiative["id"])
