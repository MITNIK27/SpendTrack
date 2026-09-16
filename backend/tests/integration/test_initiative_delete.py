from fastapi.testclient import TestClient
from sqlalchemy import text

from tests.conftest import ADMIN_EMAIL, APPROVER_EMAIL, EMPLOYEE_EMAIL, headers


def _first_category_id(client: TestClient) -> str:
    categories = client.get("/api/categories", headers=headers(ADMIN_EMAIL)).json()
    return categories[0]["id"]


def test_owner_can_delete_a_draft_only_initiative(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(EMPLOYEE_EMAIL), json={"name": "__test__ Delete Me"}
    ).json()
    category_id = _first_category_id(client)
    client.post(
        f"/api/initiatives/{initiative['id']}/spend-requests",
        headers=headers(EMPLOYEE_EMAIL),
        json={"category_id": category_id, "description": "Still a draft", "requested_amount": 500},
    )

    resp = client.delete(f"/api/initiatives/{initiative['id']}", headers=headers(EMPLOYEE_EMAIL))
    assert resp.status_code == 204

    assert client.get(f"/api/initiatives/{initiative['id']}", headers=headers(EMPLOYEE_EMAIL)).status_code == 404


def test_owner_cannot_delete_initiative_with_submitted_spend(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(EMPLOYEE_EMAIL), json={"name": "__test__ Already Submitted"}
    ).json()
    try:
        category_id = _first_category_id(client)
        sr = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(EMPLOYEE_EMAIL),
            json={
                "category_id": category_id,
                "description": "Booth",
                "requested_amount": 1000,
            },
        ).json()
        client.post(f"/api/initiatives/{initiative['id']}/submit", headers=headers(EMPLOYEE_EMAIL))
        client.post(f"/api/spend-requests/{sr['id']}/submit", headers=headers(EMPLOYEE_EMAIL))

        resp = client.delete(f"/api/initiatives/{initiative['id']}", headers=headers(EMPLOYEE_EMAIL))
        assert resp.status_code == 409

        # Still there — the failed delete must not have partially applied.
        assert client.get(f"/api/initiatives/{initiative['id']}", headers=headers(EMPLOYEE_EMAIL)).status_code == 200
    finally:
        db.execute(text("DELETE FROM activity_logs WHERE entity_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM spend_requests WHERE initiative_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM initiatives WHERE id = :id"), {"id": initiative["id"]})
        db.commit()


def test_non_owner_non_admin_cannot_delete_initiative(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(EMPLOYEE_EMAIL), json={"name": "__test__ Not Yours"}
    ).json()
    try:
        category_id = _first_category_id(client)
        client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(EMPLOYEE_EMAIL),
            json={"category_id": category_id, "description": "Still a draft", "requested_amount": 500},
        )
        client.post(f"/api/initiatives/{initiative['id']}/submit", headers=headers(EMPLOYEE_EMAIL))

        resp = client.delete(f"/api/initiatives/{initiative['id']}", headers=headers(APPROVER_EMAIL))
        assert resp.status_code == 403

        assert client.get(f"/api/initiatives/{initiative['id']}", headers=headers(ADMIN_EMAIL)).status_code == 200
    finally:
        db.execute(text("DELETE FROM activity_logs WHERE entity_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM spend_requests WHERE initiative_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM initiatives WHERE id = :id"), {"id": initiative["id"]})
        db.commit()


def test_admin_can_delete_any_initiative(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(EMPLOYEE_EMAIL), json={"name": "__test__ Admin Deletes This"}
    ).json()
    category_id = _first_category_id(client)
    client.post(
        f"/api/initiatives/{initiative['id']}/spend-requests",
        headers=headers(EMPLOYEE_EMAIL),
        json={"category_id": category_id, "description": "Still a draft", "requested_amount": 500},
    )
    client.post(f"/api/initiatives/{initiative['id']}/submit", headers=headers(EMPLOYEE_EMAIL))

    resp = client.delete(f"/api/initiatives/{initiative['id']}", headers=headers(ADMIN_EMAIL))
    assert resp.status_code == 204

    assert client.get(f"/api/initiatives/{initiative['id']}", headers=headers(ADMIN_EMAIL)).status_code == 404
