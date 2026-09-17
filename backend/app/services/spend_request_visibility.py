from sqlalchemy import ColumnElement, or_

from app.models.spend_request import SpendRequest
from app.models.user import User


def visible_spend_requests_clause(user: User) -> ColumnElement[bool]:
    """SQL predicate for filtering a SpendRequest query to what `user` may see:
    a member only ever sees their own; anyone else sees everything except
    other people's drafts — a draft is a private scratchpad, invisible to
    everyone but its own creator, regardless of role, until submitted."""
    if user.role == "member":
        return SpendRequest.created_by_id == user.id
    return or_(SpendRequest.status != "draft", SpendRequest.created_by_id == user.id)


def is_spend_request_visible(spend_request: SpendRequest, user: User) -> bool:
    """Same rule as `visible_spend_requests_clause`, applied to an already-loaded
    instance (e.g. one loaded via a relationship rather than a fresh query)."""
    if user.role == "member":
        return spend_request.created_by_id == user.id
    return spend_request.status != "draft" or spend_request.created_by_id == user.id
