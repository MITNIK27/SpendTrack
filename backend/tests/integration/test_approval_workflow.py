from fastapi.testclient import TestClient
from sqlalchemy import text

from tests.conftest import ADMIN_EMAIL, APPROVER_EMAIL, EMPLOYEE_EMAIL, headers


def _first_category_id(client: TestClient) -> str:
    categories = client.get("/api/categories", headers=headers(ADMIN_EMAIL)).json()
    return categories[0]["id"]


def _submitted_spend_request(client: TestClient, initiative_id: str, amount: int = 200000) -> dict:
    category_id = _first_category_id(client)
    created = client.post(
        f"/api/initiatives/{initiative_id}/spend-requests",
        headers=headers(EMPLOYEE_EMAIL),
        json={"category_id": category_id, "description": "Conference Registration", "requested_amount": amount},
    ).json()
    # No-op (409) if the initiative was already submitted by an earlier call in the same test.
    client.post(f"/api/initiatives/{initiative_id}/submit", headers=headers(EMPLOYEE_EMAIL))
    client.post(f"/api/spend-requests/{created['id']}/submit", headers=headers(EMPLOYEE_EMAIL))
    return created


def _cleanup(db, initiative_id: str) -> None:
    db.execute(text("DELETE FROM approval_actions WHERE spend_request_id IN "
                     "(SELECT id FROM spend_requests WHERE initiative_id = :id)"), {"id": initiative_id})
    db.execute(text("DELETE FROM activity_logs WHERE entity_id = :id"), {"id": initiative_id})
    db.execute(text("DELETE FROM spend_requests WHERE initiative_id = :id"), {"id": initiative_id})
    db.execute(text("DELETE FROM initiatives WHERE id = :id"), {"id": initiative_id})
    db.commit()


def test_employee_cannot_decide(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(EMPLOYEE_EMAIL), json={"name": "__test__ Employee Cannot Decide"}
    ).json()
    try:
        sr = _submitted_spend_request(client, initiative["id"])
        resp = client.post(
            f"/api/spend-requests/{sr['id']}/decisions",
            headers=headers(EMPLOYEE_EMAIL),
            json={"action": "approve"},
        )
        assert resp.status_code == 403
    finally:
        _cleanup(db, initiative["id"])


def test_approve_requested_amount(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(EMPLOYEE_EMAIL), json={"name": "__test__ Approve"}
    ).json()
    try:
        sr = _submitted_spend_request(client, initiative["id"], amount=200000)
        resp = client.post(
            f"/api/spend-requests/{sr['id']}/decisions",
            headers=headers(APPROVER_EMAIL),
            json={"action": "approve"},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["status"] == "approved"
        assert body["approved_amount"] == "200000.00"
        assert body["variance"] == "0.00"

        # Already decided — can't decide again.
        again = client.post(
            f"/api/spend-requests/{sr['id']}/decisions",
            headers=headers(APPROVER_EMAIL),
            json={"action": "approve"},
        )
        assert again.status_code == 409
    finally:
        _cleanup(db, initiative["id"])


def test_approve_different_amount_requires_amount_and_comment(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(EMPLOYEE_EMAIL), json={"name": "__test__ Approve Different Amount"}
    ).json()
    try:
        sr = _submitted_spend_request(client, initiative["id"], amount=500000)

        missing_amount = client.post(
            f"/api/spend-requests/{sr['id']}/decisions",
            headers=headers(APPROVER_EMAIL),
            json={"action": "approve_different_amount", "comment": "Trim the budget"},
        )
        assert missing_amount.status_code == 400

        missing_comment = client.post(
            f"/api/spend-requests/{sr['id']}/decisions",
            headers=headers(APPROVER_EMAIL),
            json={"action": "approve_different_amount", "approved_amount": 400000},
        )
        assert missing_comment.status_code == 400

        ok = client.post(
            f"/api/spend-requests/{sr['id']}/decisions",
            headers=headers(APPROVER_EMAIL),
            json={"action": "approve_different_amount", "approved_amount": 400000, "comment": "Trim the budget"},
        )
        assert ok.status_code == 200, ok.text
        body = ok.json()
        assert body["status"] == "approved"
        assert body["approved_amount"] == "400000.00"
        assert body["variance"] == "-100000.00"
    finally:
        _cleanup(db, initiative["id"])


def test_reject_requires_comment(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(EMPLOYEE_EMAIL), json={"name": "__test__ Reject"}
    ).json()
    try:
        sr = _submitted_spend_request(client, initiative["id"])

        no_comment = client.post(
            f"/api/spend-requests/{sr['id']}/decisions", headers=headers(APPROVER_EMAIL), json={"action": "reject"}
        )
        assert no_comment.status_code == 400

        rejected = client.post(
            f"/api/spend-requests/{sr['id']}/decisions",
            headers=headers(APPROVER_EMAIL),
            json={"action": "reject", "comment": "Not aligned with this quarter's priorities"},
        )
        assert rejected.status_code == 200
        assert rejected.json()["status"] == "rejected"
        assert rejected.json()["approved_amount"] is None
    finally:
        _cleanup(db, initiative["id"])


def test_request_changes_loops_back_to_editable(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(EMPLOYEE_EMAIL), json={"name": "__test__ Request Changes"}
    ).json()
    try:
        sr = _submitted_spend_request(client, initiative["id"])

        changes = client.post(
            f"/api/spend-requests/{sr['id']}/decisions",
            headers=headers(APPROVER_EMAIL),
            json={"action": "request_changes", "comment": "Please add a vendor quote"},
        )
        assert changes.status_code == 200
        body = changes.json()
        assert body["status"] == "changes_requested"
        assert body["approved_amount"] is None

        # Now the owner can edit and resubmit — the loop the data model documents.
        edited = client.patch(
            f"/api/spend-requests/{sr['id']}", headers=headers(EMPLOYEE_EMAIL), json={"vendor": "Acme Events"}
        )
        assert edited.status_code == 200

        resubmitted = client.post(f"/api/spend-requests/{sr['id']}/submit", headers=headers(EMPLOYEE_EMAIL))
        assert resubmitted.status_code == 200
        assert resubmitted.json()["status"] == "resubmitted"
        assert resubmitted.json()["current_cycle"] == 2
    finally:
        _cleanup(db, initiative["id"])


def test_cannot_decide_on_a_draft(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(EMPLOYEE_EMAIL), json={"name": "__test__ Draft Decision"}
    ).json()
    try:
        category_id = _first_category_id(client)
        draft = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(EMPLOYEE_EMAIL),
            json={"category_id": category_id, "description": "Something", "requested_amount": 1000},
        ).json()

        # The approver can't even see the draft, let alone decide on it (404, not 409).
        resp = client.post(
            f"/api/spend-requests/{draft['id']}/decisions",
            headers=headers(APPROVER_EMAIL),
            json={"action": "approve"},
        )
        assert resp.status_code == 404
    finally:
        _cleanup(db, initiative["id"])
