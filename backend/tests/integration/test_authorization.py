from fastapi.testclient import TestClient
from sqlalchemy import text

from tests.conftest import ADMIN_EMAIL, APPROVER_EMAIL, EMPLOYEE_EMAIL, headers


def _first_category_id(client: TestClient) -> str:
    categories = client.get("/api/categories", headers=headers(ADMIN_EMAIL)).json()
    return categories[0]["id"]


def test_employee_cannot_see_another_employees_initiative(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(ADMIN_EMAIL), json={"name": "__test__ Private Initiative"}
    ).json()

    try:
        resp = client.get(f"/api/initiatives/{initiative['id']}", headers=headers(EMPLOYEE_EMAIL))
        assert resp.status_code == 404

        listing = client.get("/api/initiatives", headers=headers(EMPLOYEE_EMAIL)).json()
        assert all(i["id"] != initiative["id"] for i in listing)
    finally:
        db.execute(text("DELETE FROM initiatives WHERE id = :id"), {"id": initiative["id"]})
        db.commit()


def test_draft_spend_request_hidden_from_approver_and_admin(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(EMPLOYEE_EMAIL), json={"name": "__test__ Draft Visibility"}
    ).json()

    try:
        category_id = _first_category_id(client)
        draft = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(EMPLOYEE_EMAIL),
            json={"category_id": category_id, "description": "Something", "requested_amount": 1000},
        ).json()
        client.post(f"/api/initiatives/{initiative['id']}/submit", headers=headers(EMPLOYEE_EMAIL))

        # Owner can always see their own draft.
        assert client.get(f"/api/spend-requests/{draft['id']}", headers=headers(EMPLOYEE_EMAIL)).status_code == 200

        # Neither the approver nor an admin should see it — it hasn't been submitted yet.
        for viewer in (APPROVER_EMAIL, ADMIN_EMAIL):
            assert client.get(f"/api/spend-requests/{draft['id']}", headers=headers(viewer)).status_code == 404
            listing = client.get("/api/spend-requests", headers=headers(viewer)).json()
            assert all(sr["id"] != draft["id"] for sr in listing)

        # It also shouldn't leak into the initiative's detail view or financial summary for them.
        for viewer in (APPROVER_EMAIL, ADMIN_EMAIL):
            detail = client.get(f"/api/initiatives/{initiative['id']}", headers=headers(viewer)).json()
            assert all(sr["id"] != draft["id"] for sr in detail["spend_requests"])
            assert detail["financial_summary"]["spend_request_count"] == 0

        # Once submitted, it becomes visible to everyone.
        client.post(f"/api/spend-requests/{draft['id']}/submit", headers=headers(EMPLOYEE_EMAIL))
        assert client.get(f"/api/spend-requests/{draft['id']}", headers=headers(APPROVER_EMAIL)).status_code == 200
    finally:
        db.execute(text("DELETE FROM activity_logs WHERE entity_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM spend_requests WHERE initiative_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM initiatives WHERE id = :id"), {"id": initiative["id"]})
        db.commit()


def test_unknown_dev_user_is_rejected(client: TestClient) -> None:
    resp = client.get("/api/me", headers=headers("nobody@infobeans.com"))
    assert resp.status_code == 404


def test_missing_dev_header_is_unauthorized(client: TestClient) -> None:
    resp = client.get("/api/me")
    assert resp.status_code == 401
