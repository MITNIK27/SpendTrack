from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import text

from tests.conftest import ADMIN_EMAIL, APPROVER_EMAIL, EMPLOYEE_EMAIL, headers


def _first_category_id(client: TestClient) -> str:
    categories = client.get("/api/categories", headers=headers(ADMIN_EMAIL)).json()
    return categories[0]["id"]


def test_employee_cannot_view_leadership_report(client: TestClient) -> None:
    resp = client.get("/api/reports/spend-summary", headers=headers(EMPLOYEE_EMAIL))
    assert resp.status_code == 403


def test_spend_summary_excludes_drafts_and_out_of_fiscal_year_requests(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(ADMIN_EMAIL), json={"name": "__test__ Reporting Fixture"}
    ).json()

    try:
        client.post(f"/api/initiatives/{initiative['id']}/submit", headers=headers(ADMIN_EMAIL))
        category_id = _first_category_id(client)

        # In the current FY, submitted and approved — should count.
        in_fy = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(ADMIN_EMAIL),
            json={"category_id": category_id, "description": "In FY", "requested_amount": 100000},
        ).json()
        client.post(f"/api/spend-requests/{in_fy['id']}/submit", headers=headers(ADMIN_EMAIL))

        # A draft in the same window — must never appear in a leadership report.
        client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(ADMIN_EMAIL),
            json={"category_id": category_id, "description": "Still a draft", "requested_amount": 999999},
        )

        # Clearly outside any plausible current FY — must not count either. Classification
        # is by created_at, so backdate it directly rather than via a form field.
        far_future = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(ADMIN_EMAIL),
            json={"category_id": category_id, "description": "Far future FY", "requested_amount": 50000},
        ).json()
        client.post(f"/api/spend-requests/{far_future['id']}/submit", headers=headers(ADMIN_EMAIL))
        db.execute(
            text("UPDATE spend_requests SET created_at = :dt WHERE id = :id"),
            {"dt": date(2099, 5, 1), "id": far_future["id"]},
        )
        db.commit()

        resp = client.get(f"/api/reports/spend-summary?initiative_id={initiative['id']}", headers=headers(APPROVER_EMAIL))
        assert resp.status_code == 200
        body = resp.json()
        assert body["matched_spend_request_count"] == 1

        summary_csv = client.get(
            f"/api/reports/spend-summary/export?initiative_id={initiative['id']}", headers=headers(APPROVER_EMAIL)
        )
        assert summary_csv.status_code == 200
        assert summary_csv.headers["content-type"].startswith("text/csv")
        assert "Category Code,Category Name,Approved,Actual,Balance" in summary_csv.text

        requests_csv = client.get(
            f"/api/reports/spend-requests/export?initiative_id={initiative['id']}", headers=headers(APPROVER_EMAIL)
        )
        assert requests_csv.status_code == 200
        assert requests_csv.headers["content-type"].startswith("text/csv")
        assert "In FY" in requests_csv.text
        assert "Still a draft" not in requests_csv.text
        assert "Far future FY" not in requests_csv.text

        forbidden = client.get("/api/reports/spend-requests/export", headers=headers(EMPLOYEE_EMAIL))
        assert forbidden.status_code == 403
    finally:
        db.execute(text("DELETE FROM activity_logs WHERE entity_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM spend_requests WHERE initiative_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM initiatives WHERE id = :id"), {"id": initiative["id"]})
        db.commit()


def test_spend_requests_drilldown_includes_decision_details(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(ADMIN_EMAIL), json={"name": "__test__ Drilldown Fixture"}
    ).json()
    try:
        client.post(f"/api/initiatives/{initiative['id']}/submit", headers=headers(ADMIN_EMAIL))
        category_id = _first_category_id(client)
        sr = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(ADMIN_EMAIL),
            json={
                "category_id": category_id,
                "description": "Booth",
                "requested_amount": 100000,
            },
        ).json()
        client.post(f"/api/spend-requests/{sr['id']}/submit", headers=headers(ADMIN_EMAIL))
        client.post(
            f"/api/spend-requests/{sr['id']}/decisions",
            headers=headers(APPROVER_EMAIL),
            json={"action": "approve_different_amount", "approved_amount": 80000, "comment": "Trim scope"},
        )

        resp = client.get(
            f"/api/reports/spend-requests?initiative_id={initiative['id']}", headers=headers(APPROVER_EMAIL)
        )
        assert resp.status_code == 200
        rows = resp.json()
        assert len(rows) == 1
        row = rows[0]
        assert row["approved_amount"] == "80000.00"
        assert row["decided_by"] == "Siddharth Sethi"
        assert row["decision_comment"] == "Trim scope"

        forbidden = client.get("/api/reports/spend-requests", headers=headers(EMPLOYEE_EMAIL))
        assert forbidden.status_code == 403
    finally:
        db.execute(text("DELETE FROM approval_actions WHERE spend_request_id IN "
                         "(SELECT id FROM spend_requests WHERE initiative_id = :id)"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM activity_logs WHERE entity_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM spend_requests WHERE initiative_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM initiatives WHERE id = :id"), {"id": initiative["id"]})
        db.commit()


def test_spend_trends_buckets_by_month_quarter_and_category(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(ADMIN_EMAIL), json={"name": "__test__ Trends Fixture"}
    ).json()
    try:
        client.post(f"/api/initiatives/{initiative['id']}/submit", headers=headers(ADMIN_EMAIL))
        category_id = _first_category_id(client)
        sr = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(ADMIN_EMAIL),
            json={
                "category_id": category_id,
                "description": "Trend point",
                "requested_amount": 20000,
            },
        ).json()
        client.post(f"/api/spend-requests/{sr['id']}/submit", headers=headers(ADMIN_EMAIL))
        client.post(
            f"/api/spend-requests/{sr['id']}/decisions",
            headers=headers(APPROVER_EMAIL),
            json={"action": "approve", "comment": None},
        )

        resp = client.get(
            f"/api/reports/spend-trends?initiative_id={initiative['id']}", headers=headers(APPROVER_EMAIL)
        )
        assert resp.status_code == 200
        body = resp.json()

        assert len(body["monthly"]) == 1
        assert body["monthly"][0]["approved"] == "20000.00"

        this_quarter = next(q for q in body["quarterly"] if q["approved"] == "20000.00")
        assert this_quarter["quarter"] in (1, 2, 3, 4)

        assert len(body["category_monthly_average"]) == 1
        assert body["category_monthly_average"][0]["average_monthly_approved"] == "20000.00"

        # month/quarter filters are ignored for trends — a specific-month filter must
        # not collapse the chart to a single point that happens to exclude this row.
        other_month = 1 if date.today().month != 1 else 2
        still_present = client.get(
            f"/api/reports/spend-trends?initiative_id={initiative['id']}&month={other_month}",
            headers=headers(APPROVER_EMAIL),
        ).json()
        assert len(still_present["monthly"]) == 1

        forbidden = client.get("/api/reports/spend-trends", headers=headers(EMPLOYEE_EMAIL))
        assert forbidden.status_code == 403
    finally:
        db.execute(text("DELETE FROM approval_actions WHERE spend_request_id IN "
                         "(SELECT id FROM spend_requests WHERE initiative_id = :id)"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM activity_logs WHERE entity_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM spend_requests WHERE initiative_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM initiatives WHERE id = :id"), {"id": initiative["id"]})
        db.commit()


def test_spend_request_is_reportable_by_created_at(client: TestClient, db) -> None:
    """Spend requests are classified into fiscal periods purely by `created_at` —
    there's no separate expected-spend-date field to fall back from."""
    initiative = client.post(
        "/api/initiatives", headers=headers(ADMIN_EMAIL), json={"name": "__test__ No Expected Date"}
    ).json()
    try:
        client.post(f"/api/initiatives/{initiative['id']}/submit", headers=headers(ADMIN_EMAIL))
        category_id = _first_category_id(client)
        sr = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(ADMIN_EMAIL),
            json={"category_id": category_id, "description": "No date given", "requested_amount": 5000},
        ).json()
        client.post(f"/api/spend-requests/{sr['id']}/submit", headers=headers(ADMIN_EMAIL))

        current_fy = client.get(
            f"/api/reports/spend-requests?initiative_id={initiative['id']}", headers=headers(APPROVER_EMAIL)
        ).json()
        assert any(row["id"] == sr["id"] for row in current_fy)

        all_time = client.get(
            f"/api/reports/spend-summary?initiative_id={initiative['id']}&all_time=true",
            headers=headers(APPROVER_EMAIL),
        ).json()
        assert all_time["fiscal_year"] is None
        assert all_time["matched_spend_request_count"] == 1
    finally:
        db.execute(text("DELETE FROM activity_logs WHERE entity_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM spend_requests WHERE initiative_id = :id"), {"id": initiative["id"]})
        db.execute(text("DELETE FROM initiatives WHERE id = :id"), {"id": initiative["id"]})
        db.commit()
