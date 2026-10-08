import re

from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.category import Category
from app.models.initiative import Initiative
from app.models.spend_request import SpendRequest
from app.models.user import User
from app.schemas.search import SearchRequestResult, SearchResponse
from app.services.initiative_visibility import visible_initiatives_clause
from app.services.spend_request_visibility import visible_spend_requests_clause

MIN_QUERY_LENGTH = 2
RESULT_LIMIT = 20


def _normalize_amount_query(query: str) -> str:
    """Strips every character that isn't a digit, regardless of what currency
    notation surrounds it — symbol (₹, $), code (Rs, Rs., INR, USD), grouping
    commas, or plain spaces. Currency-agnostic by construction: it has no
    knowledge of "Rs" or "$" specifically, it just discards anything that
    isn't 0-9, so any prefix/suffix/punctuation a user types falls away and
    only the figure itself is left to match against."""
    return re.sub(r"\D", "", query)


def search(db: Session, *, query: str, user: User) -> SearchResponse:
    """Global search is request-first: every match — whether it hit the
    request's own name/category/owner/amount, or one of its spend-breakdown
    rows' description/vendor/category — collapses to a single summary row
    for the parent request. Never surfaces a bare breakdown line, so there's
    no risk of a request's name and a breakdown item's text looking like two
    separate, confusingly similar results."""
    query = query.strip()
    if len(query) < MIN_QUERY_LENGTH:
        return SearchResponse(requests=[])

    pattern = f"%{query}%"
    amount_digits = _normalize_amount_query(query)

    breakdown_match = (
        select(SpendRequest.initiative_id)
        .join(Category, SpendRequest.category_id == Category.id)
        .where(visible_spend_requests_clause(user))
        .where(
            or_(
                SpendRequest.description.ilike(pattern),
                SpendRequest.vendor.ilike(pattern),
                Category.name.ilike(pattern),
            )
        )
    )

    conditions = [
        Initiative.name.ilike(pattern),
        Initiative.id.in_(breakdown_match),
        User.name.ilike(pattern),
        Category.name.ilike(pattern),
    ]
    if amount_digits:
        # The Requests page's "Requested"/"Approved" columns show each
        # initiative's *total* across every submitted spend-breakdown row
        # (Initiative.total_requested_amount/total_approved_amount), not any
        # single row's own amount — a request built from several line items
        # (e.g. 10000 + 5000 + 3000 + 500 = 18500) never has a single row that
        # equals the number shown on screen, so matching must sum the same
        # way those properties do (minus their cross-currency conversion,
        # which is rare enough not to warrant replicating in SQL here).
        amount_totals = (
            select(
                SpendRequest.initiative_id.label("initiative_id"),
                func.sum(SpendRequest.requested_amount).label("total_requested"),
                func.sum(SpendRequest.approved_amount).label("total_approved"),
            )
            .where(SpendRequest.status != "draft")
            .group_by(SpendRequest.initiative_id)
            .subquery()
        )
        amount_match = select(amount_totals.c.initiative_id).where(
            or_(
                cast(amount_totals.c.total_requested, String).ilike(f"%{amount_digits}%"),
                cast(amount_totals.c.total_approved, String).ilike(f"%{amount_digits}%"),
            )
        )
        conditions.append(Initiative.id.in_(amount_match))
        # Covers a budget-only initiative (no breakdown rows of its own yet),
        # whose "Total Budget"/"Approved" columns fall back to these two
        # fields instead (mirrors Initiative.total_approved_amount's own
        # fallback).
        conditions.append(cast(Initiative.estimated_total_budget, String).ilike(f"%{amount_digits}%"))
        conditions.append(cast(Initiative.budget_approved_amount, String).ilike(f"%{amount_digits}%"))

    stmt = (
        select(Initiative)
        .outerjoin(User, Initiative.owner_id == User.id)
        .outerjoin(Category, Initiative.category_id == Category.id)
        .options(
            joinedload(Initiative.owner),
            joinedload(Initiative.category),
            selectinload(Initiative.spend_requests),
        )
        .where(visible_initiatives_clause(user))
        .where(or_(*conditions))
        .order_by(Initiative.created_at.desc())
        .limit(RESULT_LIMIT)
    )
    initiatives = db.scalars(stmt).unique().all()

    return SearchResponse(
        requests=[
            SearchRequestResult(
                id=i.id,
                name=i.name,
                status=i.status,
                budget_decision=i.budget_decision,
                approval_progress=i.approval_progress,
                spend_request_count=i.spend_request_count,
                category_name=i.category.name if i.category else None,
                estimated_total_budget=i.estimated_total_budget,
                currency=i.currency,
                owner_name=i.owner.name if i.owner else None,
            )
            for i in initiatives
        ]
    )
