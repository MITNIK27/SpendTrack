from fastapi.testclient import TestClient
from sqlalchemy import text

from tests.conftest import ADMIN_EMAIL, headers


def _other_category_id(client: TestClient) -> str:
    categories = client.get("/api/categories", headers=headers(ADMIN_EMAIL)).json()
    return next(c["id"] for c in categories if c["code"] == "Q")


def _first_category_id(client: TestClient) -> str:
    categories = client.get("/api/categories", headers=headers(ADMIN_EMAIL)).json()
    return categories[0]["id"]


def test_full_submit_and_lock_cycle(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives",
        headers=headers(ADMIN_EMAIL),
        json={"name": "__test__ Gartner Conference 2026"},
    ).json()

    try:
        client.post(f"/api/initiatives/{initiative['id']}/submit", headers=headers(ADMIN_EMAIL))
        category_id = _first_category_id(client)

        create_resp = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(ADMIN_EMAIL),
            json={
                "category_id": category_id,
                "description": "Conference Registration",
                "vendor": "Gartner",
                "requested_amount": 200000,
            },
        )
        assert create_resp.status_code == 201, create_resp.text
        spend_request = create_resp.json()
        assert spend_request["status"] == "draft"
        assert spend_request["requested_amount"] == "200000.00"
        assert spend_request["variance"] is None

        submit_resp = client.post(
            f"/api/spend-requests/{spend_request['id']}/submit", headers=headers(ADMIN_EMAIL)
        )
        assert submit_resp.status_code == 200
        assert submit_resp.json()["status"] == "submitted"
        assert submit_resp.json()["submitted_at"] is not None

        # Financial fields lock once submitted — editing must 409, not silently succeed.
        locked_resp = client.patch(
            f"/api/spend-requests/{spend_request['id']}",
            headers=headers(ADMIN_EMAIL),
            json={"requested_amount": 999999},
        )
        assert locked_resp.status_code == 409

        # Submitting again from a non-draft/non-changes_requested status must also 409.
        resubmit_resp = client.post(
            f"/api/spend-requests/{spend_request['id']}/submit", headers=headers(ADMIN_EMAIL)
        )
        assert resubmit_resp.status_code == 409
    finally:
        db.execute(text("DELETE FROM activity_logs WHERE entity_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM spend_requests WHERE initiative_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM initiatives WHERE id = :id"), {"id": initiative["id"]})
        db.commit()


def test_other_category_requires_description(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(ADMIN_EMAIL), json={"name": "__test__ Misc Initiative"}
    ).json()

    try:
        other_id = _other_category_id(client)

        missing_desc = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(ADMIN_EMAIL),
            json={"category_id": other_id, "description": "Something", "requested_amount": 1000},
        )
        assert missing_desc.status_code == 400

        with_desc = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(ADMIN_EMAIL),
            json={
                "category_id": other_id,
                "other_description": "Team offsite catering",
                "description": "Something",
                "requested_amount": 1000,
            },
        )
        assert with_desc.status_code == 201
    finally:
        db.execute(text("DELETE FROM activity_logs WHERE entity_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM spend_requests WHERE initiative_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM initiatives WHERE id = :id"), {"id": initiative["id"]})
        db.commit()


def test_line_items_must_sum_to_requested_amount(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(ADMIN_EMAIL), json={"name": "__test__ ITC Vegas 2026"}
    ).json()

    try:
        category_id = _first_category_id(client)

        mismatched = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(ADMIN_EMAIL),
            json={
                "category_id": category_id,
                "description": "Booth",
                "requested_amount": 900000,
                "line_items": [{"item": "Registration", "amount": 200000}, {"item": "Booth", "amount": 500000}],
            },
        )
        assert mismatched.status_code == 400

        matched = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(ADMIN_EMAIL),
            json={
                "category_id": category_id,
                "description": "Booth",
                "requested_amount": 700000,
                "line_items": [{"item": "Registration", "amount": 200000}, {"item": "Booth", "amount": 500000}],
            },
        )
        assert matched.status_code == 201, matched.text
        spend_request = matched.json()
        assert len(spend_request["line_items"]) == 2
        assert spend_request["requested_amount"] == "700000.00"
    finally:
        db.execute(text("DELETE FROM activity_logs WHERE entity_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM spend_requests WHERE initiative_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM initiatives WHERE id = :id"), {"id": initiative["id"]})
        db.commit()
