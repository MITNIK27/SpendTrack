"""Builds recipient list + rendered subject/HTML for the four notification
emails: new initiative/spend request submitted (to approvers), and
initiative/spend request decisions (to the creator).

Each `build_*` function is synchronous and runs against the request's own
(still-open) DB session — cheap, and needed because a FastAPI dependency's
session is already closed by the time BackgroundTasks run. Callers should do
the actual `email_service.send_email(...)` call via BackgroundTasks so the
slow part (the SMTP round trip) never blocks the response:

    to, subject, html = notification_service.build_initiative_submitted_email(
        db, initiative=initiative, actor=user
    )
    background_tasks.add_task(email_service.send_email, to, subject, html)

Failures during the actual send are logged inside email_service.send_email
and never raised — a build_* function itself does no I/O beyond the DB query
already needed for the response.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.initiative import Initiative
from app.models.spend_request import SpendRequest
from app.models.user import User
from app.services import email_templates

_SPEND_DECISION_LABELS = {
    "approved": "approved",
    "rejected": "rejected",
    "changes_requested": "sent back for changes",
}

_EmailPayload = tuple[list[str], str, str]


def _approver_emails(db: Session) -> list[str]:
    return list(
        db.scalars(
            select(User.email).where(User.role.in_(("approver", "admin"))).where(User.is_active.is_(True))
        ).all()
    )


def _initiative_details(initiative: Initiative) -> list[tuple[str, str]]:
    """Mirrors exactly what the current Create Initiative form collects
    (frontend/src/components/InitiativeForm.tsx): Name, Type, Budget,
    Currency, and one freeform Remarks box — date/location/target audience
    were folded into Remarks in the latest simplification round and are no
    longer separate fields, so a member typing "12 Jan, Las Vegas, ..." into
    Remarks is exactly where an approver should see that, not a blank
    'Location'/'Event date' row. event_date/location/target_audience are
    still shown when present only because older initiatives (created before
    this round) may still carry real values in those columns."""
    rows = [("Initiative", initiative.name)]
    if initiative.owner is not None:
        rows.append(("Submitted by", initiative.owner.name))
    if initiative.type:
        rows.append(("Type", initiative.type))
    if initiative.estimated_total_budget is not None:
        rows.append(("Budget", email_templates.format_amount(initiative.estimated_total_budget, initiative.currency)))
    if initiative.event_date is not None:
        rows.append(("Event date", initiative.event_date.strftime("%d %b %Y")))
    if initiative.location:
        rows.append(("Location", initiative.location))
    if initiative.target_audience:
        rows.append(("Target audience", initiative.target_audience))
    if initiative.objective:
        rows.append(("Remarks", initiative.objective))
    return rows


def _spend_request_details(spend_request: SpendRequest, initiative: Initiative) -> list[tuple[str, str]]:
    """Mirrors the current spend form (SpendBreakdownFields.tsx): what it's
    for (category/subcategory), amount, and one freeform Remarks field
    (`other_description` — vendor is no longer collected by the form, hence
    the conditional check below rather than assuming it's always present)."""
    rows = [
        ("Initiative", initiative.name),
        ("Description", spend_request.description or "—"),
    ]
    if spend_request.category is not None:
        category_label = spend_request.category.name
        if spend_request.subcategory is not None:
            category_label += f" – {spend_request.subcategory.name}"
        rows.append(("Category", category_label))
    if spend_request.vendor:
        rows.append(("Vendor", spend_request.vendor))
    rows.append(("Requested amount", email_templates.format_amount(spend_request.requested_amount, spend_request.currency)))
    if spend_request.other_description:
        rows.append(("Remarks", spend_request.other_description))
    return rows


def build_initiative_submitted_email(db: Session, *, initiative: Initiative, actor: User) -> _EmailPayload:
    to = _approver_emails(db)
    url = f"{settings.frontend_base_url}/initiatives/{initiative.id}"
    subject, body = email_templates.new_initiative_created(
        initiative_name=initiative.name, actor_name=actor.name, details=_initiative_details(initiative), url=url
    )
    return to, subject, body


def build_spend_request_submitted_email(
    db: Session, *, spend_request: SpendRequest, initiative: Initiative, actor: User
) -> _EmailPayload:
    to = _approver_emails(db)
    url = f"{settings.frontend_base_url}/spend-requests/{spend_request.id}"
    subject, body = email_templates.new_spend_request_created(
        spend_request_description=spend_request.description or "Spend request",
        initiative_name=initiative.name,
        actor_name=actor.name,
        details=_spend_request_details(spend_request, initiative),
        url=url,
    )
    return to, subject, body


def build_initiative_decision_email(
    db: Session, *, initiative: Initiative, decision: str, approver: User, comment: str | None
) -> _EmailPayload | None:
    owner = db.get(User, initiative.owner_id)
    if owner is None:
        return None
    url = f"{settings.frontend_base_url}/initiatives/{initiative.id}"
    subject, body = email_templates.initiative_decision_made(
        initiative_name=initiative.name, decision=decision, approver_name=approver.name, comment=comment, url=url
    )
    return [owner.email], subject, body


def build_spend_request_decision_email(
    db: Session, *, spend_request: SpendRequest, approver: User, comment: str | None
) -> _EmailPayload | None:
    creator = db.get(User, spend_request.created_by_id)
    if creator is None:
        return None
    decision_label = _SPEND_DECISION_LABELS.get(spend_request.status, spend_request.status)
    url = f"{settings.frontend_base_url}/spend-requests/{spend_request.id}"
    subject, body = email_templates.spend_request_decision_made(
        spend_request_description=spend_request.description or "Spend request",
        decision_label=decision_label,
        approver_name=approver.name,
        comment=comment,
        url=url,
    )
    return [creator.email], subject, body
