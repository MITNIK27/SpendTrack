"""Builds recipient list + rendered subject/HTML for the four notification
emails: new initiative/spend request submitted (to approvers), and
initiative/spend request decisions (to the creator).

Each `build_*` function is synchronous and runs against the request's own
(still-open) DB session — cheap, and needed because a FastAPI dependency's
session is already closed by the time BackgroundTasks run. Callers should do
the actual `email_service.send_email(...)` call via BackgroundTasks so the
slow part (the SMTP round trip) never blocks the response:

    to, subject, html, message_id = notification_service.build_initiative_submitted_email(
        db, initiative=initiative, actor=user, spend_requests=submitted_spend_requests
    )
    initiative.notification_message_id = message_id
    db.commit()
    background_tasks.add_task(email_service.send_email, to, subject, html, message_id=message_id)

Failures during the actual send are logged inside email_service.send_email
and never raised — a build_* function itself does no I/O beyond the DB query
already needed for the response.
"""

from email.utils import make_msgid

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
# (to, subject, html, generated Message-ID) — the Message-ID must be handed
# back so the caller can persist it (Initiative.notification_message_id)
# *before* committing, since BackgroundTasks run after the DB session used to
# build this payload is gone.
_ThreadRootEmailPayload = tuple[list[str], str, str, str]
# (to, subject, html, In-Reply-To to pass through to email_service.send_email
# — None when there's no parent thread to attach to, e.g. an older initiative
# that predates notification_message_id).
_ThreadedReplyEmailPayload = tuple[list[str], str, str, str | None]


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
    rows = [("Request", initiative.name)]
    if initiative.estimated_total_budget is not None:
        rows.append(("Budget", email_templates.format_amount(initiative.estimated_total_budget, initiative.currency)))
    if initiative.type:
        rows.append(("Type", initiative.type))
    if initiative.event_date is not None:
        rows.append(("Event date", initiative.event_date.strftime("%d %b %Y")))
    if initiative.location:
        rows.append(("Location", initiative.location))
    if initiative.target_audience:
        rows.append(("Target audience", initiative.target_audience))
    if initiative.objective:
        rows.append(("Remarks", initiative.objective))
    if initiative.owner is not None:
        rows.append(("Submitted by", initiative.owner.name))
    return rows


def _category_label(spend_request: SpendRequest) -> str:
    if spend_request.category is None:
        return "—"
    label = spend_request.category.name
    if spend_request.subcategory is not None:
        label += f" – {spend_request.subcategory.name}"
    return label


def _spend_request_details(spend_request: SpendRequest, initiative: Initiative) -> list[tuple[str, str]]:
    """Mirrors the current spend form (SpendBreakdownFields.tsx): what it's
    for (category/subcategory), amount, and one freeform Remarks field
    (`other_description` — vendor is no longer collected by the form, hence
    the conditional check below rather than assuming it's always present)."""
    rows = [
        ("Request", initiative.name),
        ("Description", spend_request.description or "—"),
    ]
    if spend_request.category is not None:
        rows.append(("Category", _category_label(spend_request)))
    if spend_request.vendor:
        rows.append(("Vendor", spend_request.vendor))
    rows.append(("Requested amount", email_templates.format_amount(spend_request.requested_amount, spend_request.currency)))
    if spend_request.other_description:
        rows.append(("Remarks", spend_request.other_description))
    return rows


def build_initiative_submitted_email(
    db: Session, *, initiative: Initiative, actor: User, spend_requests: list[SpendRequest] | None = None
) -> _ThreadRootEmailPayload:
    """One consolidated email per initiative submission — covers the
    initiative itself plus every draft spend request bundled and submitted
    alongside it (previously each of those fired its own separate email; see
    submit_initiative). Returns a generated Message-ID so the caller can
    persist it as Initiative.notification_message_id *before* committing,
    letting a later "spend request added to this initiative" email thread as
    a reply under this one."""
    to = _approver_emails(db)
    url = f"{settings.frontend_base_url}/initiatives/{initiative.id}"
    breakdown = [
        (
            sr.description or "Spend request",
            _category_label(sr),
            email_templates.format_amount(sr.requested_amount, sr.currency),
        )
        for sr in (spend_requests or [])
    ]
    subject, body = email_templates.new_initiative_created(
        initiative_name=initiative.name,
        actor_name=actor.name,
        details=_initiative_details(initiative),
        url=url,
        spend_requests=breakdown,
    )
    return to, subject, body, make_msgid()


def build_spend_request_submitted_email(
    db: Session, *, spend_request: SpendRequest, initiative: Initiative, actor: User
) -> _ThreadedReplyEmailPayload:
    """Only reached for a spend request added to an initiative *after* its
    own submission email already went out (a request bundled into the
    initiative's own submission is covered by build_initiative_submitted_email
    instead — see submit_initiative). Links to the initiative page, same as
    every other approver-facing email, since that's where the approve/reject
    action actually lives (ApprovalTable on InitiativeDetail), not a
    standalone spend-request page. Threads under the initiative's own email
    when its Message-ID was captured; falls back to a normal, unthreaded send
    otherwise (e.g. an initiative created before this column existed)."""
    to = _approver_emails(db)
    url = f"{settings.frontend_base_url}/initiatives/{initiative.id}"
    in_reply_to = initiative.notification_message_id
    subject, body = email_templates.new_spend_request_created(
        spend_request_description=spend_request.description or "Spend request",
        initiative_name=initiative.name,
        actor_name=actor.name,
        details=_spend_request_details(spend_request, initiative),
        url=url,
    )
    if in_reply_to:
        subject = f"Re: New request for approval: {initiative.name}"
    return to, subject, body, in_reply_to


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
