from fastapi.testclient import TestClient
from sqlalchemy import text

from tests.conftest import ADMIN_EMAIL, APPROVER_EMAIL, EMPLOYEE_EMAIL, headers


def _first_category_id(client: TestClient) -> str:
    categories = client.get("/api/categories", headers=headers(ADMIN_EMAIL)).json()
    return categories[0]["id"]


def test_search_hides_draft_initiative_from_approver(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(EMPLOYEE_EMAIL), json={"name": "__test__ Unpublished Roadshow"}
    ).json()
    try:
        by_approver = client.get("/api/search?q=Unpublished", headers=headers(APPROVER_EMAIL)).json()
        assert all(i["id"] != initiative["id"] for i in by_approver["initiatives"])

        by_owner = client.get("/api/search?q=Unpublished", headers=headers(EMPLOYEE_EMAIL)).json()
        assert any(i["id"] == initiative["id"] for i in by_owner["initiatives"])
    finally:
        db.execute(text("DELETE FROM initiatives WHERE id = :id"), {"id": initiative["id"]})
        db.commit()


def test_search_matches_by_initiative_name_and_spend_request_fields(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(EMPLOYEE_EMAIL), json={"name": "__test__ Zephyr Conference 2026"}
    ).json()

    try:
        category_id = _first_category_id(client)
        submitted = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(EMPLOYEE_EMAIL),
            json={
                "category_id": category_id,
                "description": "Booth construction",
                "vendor": "Acme Events Co",
                "requested_amount": 100000,
            },
        ).json()
        client.post(f"/api/initiatives/{initiative['id']}/submit", headers=headers(EMPLOYEE_EMAIL))
        client.post(f"/api/spend-requests/{submitted['id']}/submit", headers=headers(EMPLOYEE_EMAIL))

        draft = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(EMPLOYEE_EMAIL),
            json={
                "category_id": category_id,
                "description": "Zephyr swag order",
                "requested_amount": 5000,
            },
        ).json()

        # Initiative name match.
        by_initiative = client.get("/api/search?q=Zephyr", headers=headers(APPROVER_EMAIL)).json()
        assert any(i["id"] == initiative["id"] for i in by_initiative["initiatives"])

        # Vendor match, and the draft must not leak to the approver.
        by_vendor = client.get("/api/search?q=Acme", headers=headers(APPROVER_EMAIL)).json()
        assert any(sr["id"] == submitted["id"] for sr in by_vendor["spend_requests"])
        assert all(sr["id"] != draft["id"] for sr in by_vendor["spend_requests"])

        # The owner can still find their own draft.
        by_owner = client.get("/api/search?q=Zephyr swag", headers=headers(EMPLOYEE_EMAIL)).json()
        assert any(sr["id"] == draft["id"] for sr in by_owner["spend_requests"])

        # A short query is ignored rather than scanning everything.
        too_short = client.get("/api/search?q=Z", headers=headers(APPROVER_EMAIL)).json()
        assert too_short == {"initiatives": [], "spend_requests": []}
    finally:
        db.execute(text("DELETE FROM activity_logs WHERE entity_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM spend_requests WHERE initiative_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM initiatives WHERE id = :id"), {"id": initiative["id"]})
        db.commit()
