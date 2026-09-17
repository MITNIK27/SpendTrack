from sqlalchemy import ColumnElement, or_

from app.models.initiative import Initiative
from app.models.user import User


def visible_initiatives_clause(user: User) -> ColumnElement[bool]:
    """SQL predicate for filtering an Initiative query to what `user` may see:
    a member only ever sees their own; anyone else sees everything except
    other people's drafts — a draft is a private scratchpad, invisible to
    everyone but its own creator, regardless of role, until submitted for
    approval. Mirrors `spend_request_visibility.visible_spend_requests_clause`."""
    if user.role == "member":
        return Initiative.owner_id == user.id
    return or_(Initiative.status != "draft", Initiative.owner_id == user.id)


def is_initiative_visible(initiative: Initiative, user: User) -> bool:
    """Same rule as `visible_initiatives_clause`, applied to an already-loaded instance."""
    if user.role == "member":
        return initiative.owner_id == user.id
    return initiative.status != "draft" or initiative.owner_id == user.id
