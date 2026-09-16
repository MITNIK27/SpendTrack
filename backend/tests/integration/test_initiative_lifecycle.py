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


def test_new_initiative_is_draft_and_hidden_from_approver(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(EMPLOYEE_EMAIL), json={"name": "__test__ Fresh Draft"}
    ).json()
    try:
        assert initiative["status"] == "draft"

        assert client.get(f"/api/initiatives/{initiative['id']}", headers=headers(APPROVER_EMAIL)).status_code == 404
        assert client.get(f"/api/initiatives/{initiative['id']}", headers=headers(ADMIN_EMAIL)).status_code == 404
        listing = client.get("/api/initiatives", headers=headers(APPROVER_EMAIL)).json()
        assert all(i["id"] != initiative["id"] for i in listing)

        # Owner still sees their own draft, of course.
        assert client.get(f"/api/initiatives/{initiative['id']}", headers=headers(EMPLOYEE_EMAIL)).status_code == 200
    finally:
        _cleanup(db, initiative["id"])


def test_cannot_submit_a_spend_request_while_its_initiative_is_still_draft(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(EMPLOYEE_EMAIL), json={"name": "__test__ Spend Before Initiative Submit"}
    ).json()
    try:
        category_id = _first_category_id(client)
        sr = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(EMPLOYEE_EMAIL),
            json={"category_id": category_id, "description": "Late Addition", "requested_amount": 1000},
        ).json()

        # This is the exact bug: submitting the spend request on its own must
        # not let it slip into Siddharth's queue "under no initiative" while
        # the initiative itself is still an invisible draft.
        resp = client.post(f"/api/spend-requests/{sr['id']}/submit", headers=headers(EMPLOYEE_EMAIL))
        assert resp.status_code == 409, resp.text
        assert client.get(f"/api/spend-requests/{sr['id']}", headers=headers(EMPLOYEE_EMAIL)).json()["status"] == "draft"
        assert client.get(f"/api/spend-requests/{sr['id']}", headers=headers(APPROVER_EMAIL)).status_code == 404

        # Once the initiative itself is submitted (bundling this spend in), it works.
        submit_resp = client.post(
            f"/api/initiatives/{initiative['id']}/submit",
            headers=headers(EMPLOYEE_EMAIL),
            json={"spend_request_ids": [sr["id"]]},
        )
        assert submit_resp.status_code == 200, submit_resp.text
        assert client.get(f"/api/spend-requests/{sr['id']}", headers=headers(APPROVER_EMAIL)).json()["status"] == "submitted"
    finally:
        _cleanup(db, initiative["id"])


def test_can_submit_initiative_with_zero_spend_requests(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(EMPLOYEE_EMAIL), json={"name": "__test__ Budget Only Submit"}
    ).json()
    try:
        resp = client.post(f"/api/initiatives/{initiative['id']}/submit", headers=headers(EMPLOYEE_EMAIL))
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "active"
        assert client.get(f"/api/initiatives/{initiative['id']}", headers=headers(APPROVER_EMAIL)).status_code == 200
    finally:
        _cleanup(db, initiative["id"])


def test_submit_makes_initiative_visible_to_approver(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(EMPLOYEE_EMAIL), json={"name": "__test__ Submit Me"}
    ).json()
    try:
        category_id = _first_category_id(client)
        client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(EMPLOYEE_EMAIL),
            json={"category_id": category_id, "description": "Something", "requested_amount": 1000},
        )
        assert client.get(f"/api/initiatives/{initiative['id']}", headers=headers(APPROVER_EMAIL)).status_code == 404

        resp = client.post(f"/api/initiatives/{initiative['id']}/submit", headers=headers(EMPLOYEE_EMAIL))
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"

        assert client.get(f"/api/initiatives/{initiative['id']}", headers=headers(APPROVER_EMAIL)).status_code == 200

        # Not a draft anymore — can't submit twice.
        again = client.post(f"/api/initiatives/{initiative['id']}/submit", headers=headers(EMPLOYEE_EMAIL))
        assert again.status_code == 409
    finally:
        _cleanup(db, initiative["id"])


def test_submit_without_bundling_leaves_spend_requests_as_drafts(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(EMPLOYEE_EMAIL), json={"name": "__test__ Submit No Bundle"}
    ).json()
    try:
        category_id = _first_category_id(client)
        sr = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(EMPLOYEE_EMAIL),
            json={"category_id": category_id, "description": "Something", "requested_amount": 1000},
        ).json()

        resp = client.post(f"/api/initiatives/{initiative['id']}/submit", headers=headers(EMPLOYEE_EMAIL))
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"

        # Initiative is visible now, but its still-draft spend request is not —
        # confirms nothing gets auto-submitted unless explicitly requested.
        assert client.get(f"/api/spend-requests/{sr['id']}", headers=headers(APPROVER_EMAIL)).status_code == 404
        detail = client.get(f"/api/initiatives/{initiative['id']}", headers=headers(APPROVER_EMAIL)).json()
        assert detail["financial_summary"]["spend_request_count"] == 0
    finally:
        _cleanup(db, initiative["id"])


def test_submit_bundles_selected_draft_spend_requests(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(EMPLOYEE_EMAIL), json={"name": "__test__ Submit Bundle"}
    ).json()
    try:
        category_id = _first_category_id(client)
        sr1 = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(EMPLOYEE_EMAIL),
            json={"category_id": category_id, "description": "Bundle Me", "requested_amount": 1000},
        ).json()
        sr2 = client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(EMPLOYEE_EMAIL),
            json={"category_id": category_id, "description": "Leave As Draft", "requested_amount": 500},
        ).json()

        resp = client.post(
            f"/api/initiatives/{initiative['id']}/submit",
            headers=headers(EMPLOYEE_EMAIL),
            json={"spend_request_ids": [sr1["id"]]},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["status"] == "active"
        by_id = {sr["id"]: sr for sr in body["spend_requests"]}
        assert by_id[sr1["id"]]["status"] == "submitted"
        assert by_id[sr2["id"]]["status"] == "draft"

        # From the approver's side, only the bundled one is visible at all.
        approver_view = client.get(f"/api/initiatives/{initiative['id']}", headers=headers(APPROVER_EMAIL)).json()
        assert [sr["id"] for sr in approver_view["spend_requests"]] == [sr1["id"]]

        assert client.get(f"/api/spend-requests/{sr1['id']}", headers=headers(APPROVER_EMAIL)).json()["status"] == "submitted"
        # The deselected one stays a draft, still hidden from the approver.
        assert client.get(f"/api/spend-requests/{sr2['id']}", headers=headers(APPROVER_EMAIL)).status_code == 404
        assert client.get(f"/api/spend-requests/{sr2['id']}", headers=headers(EMPLOYEE_EMAIL)).json()["status"] == "draft"
    finally:
        _cleanup(db, initiative["id"])


def test_non_owner_cannot_submit_initiative(client: TestClient, db) -> None:
    initiative = client.post(
        "/api/initiatives", headers=headers(EMPLOYEE_EMAIL), json={"name": "__test__ Not Yours To Submit"}
    ).json()
    try:
        category_id = _first_category_id(client)
        client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(EMPLOYEE_EMAIL),
            json={"category_id": category_id, "description": "Something", "requested_amount": 1000},
        )
        resp = client.post(f"/api/initiatives/{initiative['id']}/submit", headers=headers(ADMIN_EMAIL))
        assert resp.status_code in (403, 404)
    finally:
        _cleanup(db, initiative["id"])


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
    # Bundle all of them into the initiative's own submit — a spend request
    # can't be submitted on its own while its initiative is still a draft.
    client.post(
        f"/api/initiatives/{initiative['id']}/submit",
        headers=headers(EMPLOYEE_EMAIL),
        json={"spend_request_ids": [sr["id"] for sr in srs]},
    )
    initiative["spend_request_ids"] = [sr["id"] for sr in srs]
    return initiative


def test_initiative_auto_completes_once_all_spend_decided(client: TestClient, db) -> None:
    initiative = _submitted_initiative_with_pending_spend(client, "__test__ Auto Complete", [100000, 50000])
    try:
        sr1, sr2 = initiative["spend_request_ids"]

        client.post(f"/api/spend-requests/{sr1}/decisions", headers=headers(APPROVER_EMAIL), json={"action": "approve"})
        # One still pending — initiative must stay active.
        mid = client.get(f"/api/initiatives/{initiative['id']}", headers=headers(APPROVER_EMAIL)).json()
        assert mid["status"] == "active"

        client.post(
            f"/api/spend-requests/{sr2}/decisions",
            headers=headers(APPROVER_EMAIL),
            json={"action": "reject", "comment": "Not needed"},
        )
        # Approved + rejected — both terminal — initiative auto-closes.
        done = client.get(f"/api/initiatives/{initiative['id']}", headers=headers(APPROVER_EMAIL)).json()
        assert done["status"] == "closed"

        # Adding a new spend request reopens it.
        category_id = _first_category_id(client)
        client.post(
            f"/api/initiatives/{initiative['id']}/spend-requests",
            headers=headers(EMPLOYEE_EMAIL),
            json={"category_id": category_id, "description": "One more", "requested_amount": 20000},
        )
        reopened = client.get(f"/api/initiatives/{initiative['id']}", headers=headers(APPROVER_EMAIL)).json()
        assert reopened["status"] == "active"
    finally:
        _cleanup(db, initiative["id"])


