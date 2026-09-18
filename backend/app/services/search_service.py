from sqlalchemy import String, cast, or_, select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.initiative import Initiative
from app.models.spend_request import SpendRequest
from app.models.user import User
from app.schemas.search import SearchInitiativeResult, SearchResponse, SearchSpendRequestResult
from app.services.initiative_visibility import visible_initiatives_clause
from app.services.spend_request_visibility import visible_spend_requests_clause

MIN_QUERY_LENGTH = 2
RESULT_LIMIT = 20


def search(db: Session, *, query: str, user: User) -> SearchResponse:
    query = query.strip()
    if len(query) < MIN_QUERY_LENGTH:
        return SearchResponse(initiatives=[], spend_requests=[])

    pattern = f"%{query}%"

    initiative_stmt = (
        select(Initiative)
        .where(Initiative.name.ilike(pattern))
        .where(visible_initiatives_clause(user))
        .order_by(Initiative.created_at.desc())
        .limit(RESULT_LIMIT)
    )
    initiatives = db.scalars(initiative_stmt).all()

    spend_request_stmt = (
        select(SpendRequest)
        .join(Category, SpendRequest.category_id == Category.id)
        .join(User, SpendRequest.created_by_id == User.id)
        .where(visible_spend_requests_clause(user))
        .where(
            or_(
                cast(SpendRequest.id, String).ilike(pattern),
                SpendRequest.description.ilike(pattern),
                SpendRequest.vendor.ilike(pattern),
                Category.name.ilike(pattern),
                User.name.ilike(pattern),
            )
        )
        .order_by(SpendRequest.created_at.desc())
        .limit(RESULT_LIMIT)
    )
    spend_requests = db.scalars(spend_request_stmt).all()

    return SearchResponse(
        initiatives=[
            SearchInitiativeResult(id=i.id, name=i.name, status=i.status) for i in initiatives
        ],
        spend_requests=[
            SearchSpendRequestResult(
                id=sr.id,
                description=sr.description,
                initiative_id=sr.initiative_id,
                initiative_name=sr.initiative.name,
                category_name=sr.category.name,
                vendor=sr.vendor,
                status=sr.status,
                requested_amount=sr.requested_amount,
            )
            for sr in spend_requests
        ],
    )
