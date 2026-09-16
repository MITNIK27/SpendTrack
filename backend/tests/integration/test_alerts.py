from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import text

from tests.conftest import ADMIN_EMAIL, APPROVER_EMAIL, EMPLOYEE_EMAIL, headers


def _first_category_id(client: TestClient) -> str:
    categories = client.get("/api/categories", headers=headers(ADMIN_EMAIL)).json()
    return categories[0]["id"]


def _cleanup(db, initiative_id: str) -> None:
    db.execute(text("DELETE FROM approval_actions WHERE spend_request_id IN "
                     "(SELECT id FROM spend_requests WHERE initiative_id = :id)"), {"id": initiative_id})
    db.execute(text("DELETE FROM activity_logs WHERE entity_id = :id"), {"id": initiative_id})
    db.execute(text("DELETE FROM spend_requests WHERE initiative_id = :id"), {"id": initiative_id})
    db.execute(text("DELETE FROM initiatives WHERE id = :id"), {"id": initiative_id})
    db.commit()


def test_employee_cannot_view_alerts(client: TestClient) -> None:
    assert client.get("/api/reports/alerts", headers=headers(EMPLOYEE_EMAIL)).status_code == 403


def test_approval_pending_too_long_alert(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(ADMIN_EMAIL), json={"name": "__test__ Pending Too Long"}
    ).json()
    try:
        category_id = _first_category_id(client)
        sr = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(ADMIN_EMAIL),
            json={"category_id": category_id, "description": "Stale Request", "requested_amount": 1000},
        ).json()
        client.post(f"/api/initiatives/{initiative['id']}/submit", headers=headers(ADMIN_EMAIL))
        client.post(f"/api/spend-requests/{sr['id']}/submit", headers=headers(ADMIN_EMAIL))
        db.execute(
            text("UPDATE spend_requests SET submitted_at = now() - interval '5 days' WHERE id = :id"),
            {"id": sr["id"]},
        )
        db.commit()

        alerts = client.get("/api/reports/alerts", headers=headers(APPROVER_EMAIL)).json()
        matching = [a for a in alerts if a["type"] == "approval_pending" and a["entity_id"] == sr["id"]]
        assert len(matching) == 1
        assert matching[0]["severity"] == "warning"
    finally:
        _cleanup(db, initiative["id"])


def test_overspend_alert(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(ADMIN_EMAIL), json={"name": "__test__ Overspend"}
    ).json()
    try:
        category_id = _first_category_id(client)
        sr = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(ADMIN_EMAIL),
            json={"category_id": category_id, "description": "Overspent Request", "requested_amount": 100000},
        ).json()
        client.post(f"/api/initiatives/{initiative['id']}/submit", headers=headers(ADMIN_EMAIL))
        client.post(f"/api/spend-requests/{sr['id']}/submit", headers=headers(ADMIN_EMAIL))
        client.post(
            f"/api/spend-requests/{sr['id']}/decisions", headers=headers(APPROVER_EMAIL), json={"action": "approve"}
        )
        db.execute(text("UPDATE spend_requests SET actual_amount = 150000 WHERE id = :id"), {"id": sr["id"]})
        db.commit()

        alerts = client.get("/api/reports/alerts", headers=headers(APPROVER_EMAIL)).json()
        matching = [a for a in alerts if a["type"] == "overspend" and a["entity_id"] == sr["id"]]
        assert len(matching) == 1
        assert matching[0]["severity"] == "critical"
    finally:
        _cleanup(db, initiative["id"])


def test_initiative_ending_soon_alert(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(ADMIN_EMAIL), json={"name": "__test__ Ending Soon"}
    ).json()
    try:
        category_id = _first_category_id(client)
        client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(ADMIN_EMAIL),
            json={"category_id": category_id, "description": "Something", "requested_amount": 1000},
        )
        client.post(f"/api/initiatives/{initiative['id']}/submit", headers=headers(ADMIN_EMAIL))

        soon = (date.today() + timedelta(days=5)).isoformat()
        client.patch(f"/api/initiatives/{initiative['id']}", headers=headers(ADMIN_EMAIL), json={"event_date": soon})

        alerts = client.get("/api/reports/alerts", headers=headers(APPROVER_EMAIL)).json()
        matching = [a for a in alerts if a["type"] == "initiative_ending_soon" and a["entity_id"] == initiative["id"]]
        assert len(matching) == 1
    finally:
        _cleanup(db, initiative["id"])


def test_unutilized_budget_alert(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(ADMIN_EMAIL), json={"name": "__test__ Unutilized Budget"}
    ).json()
    try:
        category_id = _first_category_id(client)
        sr = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(ADMIN_EMAIL),
            json={"category_id": category_id, "description": "Never Spent", "requested_amount": 200000},
        ).json()
        client.post(f"/api/initiatives/{initiative['id']}/submit", headers=headers(ADMIN_EMAIL))
        client.post(f"/api/spend-requests/{sr['id']}/submit", headers=headers(ADMIN_EMAIL))
        client.post(
            f"/api/spend-requests/{sr['id']}/decisions", headers=headers(APPROVER_EMAIL), json={"action": "approve"}
        )

        past = (date.today() - timedelta(days=5)).isoformat()
        client.patch(f"/api/initiatives/{initiative['id']}", headers=headers(ADMIN_EMAIL), json={"event_date": past})

        alerts = client.get("/api/reports/alerts", headers=headers(APPROVER_EMAIL)).json()
        matching = [a for a in alerts if a["type"] == "unutilized_budget" and a["entity_id"] == initiative["id"]]
        assert len(matching) == 1
    finally:
        _cleanup(db, initiative["id"])
