from fastapi.testclient import TestClient
from sqlalchemy import text

from tests.conftest import ADMIN_EMAIL, APPROVER_EMAIL, EMPLOYEE_EMAIL, headers


def _category_ids(client: TestClient) -> list[str]:
    categories = client.get("/api/categories", headers=headers(ADMIN_EMAIL)).json()
    return [c["id"] for c in categories]


def test_initiative_name_filter(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(EMPLOYEE_EMAIL), json={"name": "__test__ Orion Roadshow"}
    ).json()
    try:
        category_id = _category_ids(client)[0]
        client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(EMPLOYEE_EMAIL),
            json={"category_id": category_id, "description": "Something", "requested_amount": 500},
        )
        client.post(f"/api/initiatives/{initiative['id']}/submit", headers=headers(EMPLOYEE_EMAIL))

        matches = client.get("/api/initiatives?name=Orion", headers=headers(APPROVER_EMAIL)).json()
        assert any(i["id"] == initiative["id"] for i in matches)

        no_matches = client.get("/api/initiatives?name=Zzzznope", headers=headers(APPROVER_EMAIL)).json()
        assert all(i["id"] != initiative["id"] for i in no_matches)
    finally:
        db.execute(text("DELETE FROM activity_logs WHERE entity_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM spend_requests WHERE initiative_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM initiatives WHERE id = :id"), {"id": initiative["id"]})
        db.commit()


def test_initiative_category_cascade_filter(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(EMPLOYEE_EMAIL), json={"name": "__test__ Cascade Filter"}
    ).json()
    try:
        category_a, category_b, *_ = _category_ids(client)

        sr = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(EMPLOYEE_EMAIL),
            json={"category_id": category_a, "description": "Booth", "requested_amount": 1000},
        ).json()
        client.post(f"/api/initiatives/{initiative['id']}/submit", headers=headers(EMPLOYEE_EMAIL))
        client.post(f"/api/spend-requests/{sr['id']}/submit", headers=headers(EMPLOYEE_EMAIL))

        # This initiative has a spend request in category_a — it should appear.
        in_category = client.get(
            f"/api/initiatives?category_id={category_a}", headers=headers(APPROVER_EMAIL)
        ).json()
        assert any(i["id"] == initiative["id"] for i in in_category)

        # It has none in category_b — cascading to an empty (not error) result.
        not_in_category = client.get(
            f"/api/initiatives?category_id={category_b}", headers=headers(APPROVER_EMAIL)
        ).json()
        assert all(i["id"] != initiative["id"] for i in not_in_category)

        # A draft in category_b must not make the initiative appear for a non-owner either.
        draft = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(EMPLOYEE_EMAIL),
            json={"category_id": category_b, "description": "Still draft", "requested_amount": 500},
        ).json()
        still_not_in_category = client.get(
            f"/api/initiatives?category_id={category_b}", headers=headers(APPROVER_EMAIL)
        ).json()
        assert all(i["id"] != initiative["id"] for i in still_not_in_category)

        # But the owner, who can see their own draft, does see it match.
        owner_view = client.get(
            f"/api/initiatives?category_id={category_b}", headers=headers(EMPLOYEE_EMAIL)
        ).json()
        assert any(i["id"] == initiative["id"] for i in owner_view)
        assert draft["id"]  # keep the reference alive/used
    finally:
        db.execute(text("DELETE FROM activity_logs WHERE entity_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM spend_requests WHERE initiative_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM initiatives WHERE id = :id"), {"id": initiative["id"]})
        db.commit()
