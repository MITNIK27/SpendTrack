import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.associations import initiative_team_members

INITIATIVE_STATUSES = ("draft", "active", "closed", "archived")
INITIATIVE_BUDGET_DECISIONS = ("approved", "rejected")


class Initiative(Base):
    __tablename__ = "initiatives"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str | None] = mapped_column(String, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    event_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(
        Enum(*INITIATIVE_STATUSES, name="initiative_status"), nullable=False, default="draft"
    )
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")

    # The taxonomy category this initiative belongs to (same A-Q list used by
    # spend breakdown rows). Nullable so existing initiatives aren't broken —
    # the frontend requires it going forward. Used for reporting when this
    # initiative has no spend breakdown of its own (each breakdown row's own
    # category drives reporting once one exists).
    category_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True)

    target_audience: Mapped[str | None] = mapped_column(Text, nullable=True)
    objective: Mapped[str | None] = mapped_column(Text, nullable=True)
    estimated_total_budget: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    expected_leads_meetings: Mapped[str | None] = mapped_column(Text, nullable=True)

    # The initiative's own budget decision — used only when it has no spend
    # breakdown rows of its own (a budget backed by a real breakdown is
    # decided per-line instead, via SpendRequest/ApprovalAction). One-shot:
    # once set, this initiative's budget is never re-decided.
    budget_decision: Mapped[str | None] = mapped_column(
        Enum(*INITIATIVE_BUDGET_DECISIONS, name="initiative_budget_decision"), nullable=True
    )
    budget_approved_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    budget_decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    budget_decided_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    budget_decision_comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Message-ID of the "new initiative submitted" approver email (see
    # notification_service.build_initiative_submitted_email) — stored so a
    # later "spend request added to this initiative" email can thread as a
    # reply (In-Reply-To/References) under the same conversation in the
    # approver's inbox. Nullable: older initiatives predate this column, and
    # a missing value just means that later email starts a fresh thread.
    notification_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner: Mapped["User"] = relationship(foreign_keys=[owner_id])  # noqa: F821
    category: Mapped["Category | None"] = relationship()  # noqa: F821
    budget_decided_by: Mapped["User | None"] = relationship(foreign_keys=[budget_decided_by_id])  # noqa: F821
    spend_requests: Mapped[list["SpendRequest"]] = relationship(  # noqa: F821
        back_populates="initiative", order_by="SpendRequest.created_at"
    )
    team_members: Mapped[list["User"]] = relationship(secondary=initiative_team_members)  # noqa: F821

    @property
    def _submitted_spend_requests(self) -> list["SpendRequest"]:  # noqa: F821
        """Every spend request under this initiative that has actually left
        draft — a draft is a private scratchpad, never counted toward "does
        this initiative have a breakdown" anywhere else in the app (report
        totals, has_submitted_spend, visibility filtering), so these four
        properties must agree, or a leftover/abandoned draft silently blocks
        the initiative's own budget-decision flow (decide_budget) while also
        hiding the fact that there's nothing left for an approver to act on."""
        return [sr for sr in self.spend_requests if sr.status != "draft"]

    @property
    def spend_request_count(self) -> int:
        return len(self._submitted_spend_requests)

    @property
    def approval_progress(self) -> str | None:
        """"not_started" | "partial" | "approved" | "rejected" across this initiative's
        spend-breakdown rows, or None when there's no breakdown to judge (a budget-only
        initiative keeps using budget_decision instead — this is purely a display signal,
        never stored)."""
        submitted = self._submitted_spend_requests
        if not submitted:
            return None
        total = len(submitted)
        approved = sum(1 for sr in submitted if sr.status in ("approved", "spent", "closed"))
        rejected = sum(1 for sr in submitted if sr.status == "rejected")
        if approved == total:
            return "approved"
        if rejected == total:
            return "rejected"
        if approved == 0 and rejected == 0:
            return "not_started"
        return "partial"

    def _sum_converted(self, rows: list, attr: str) -> Decimal:
        """Sums `attr` (e.g. "requested_amount") off each row, converting any
        row whose own `currency` differs from this initiative's into it first.
        A breakdown row can now carry its own currency (e.g. a USD leg within
        an otherwise-INR request), so a plain sum would silently add up
        mismatched currencies. Only reaches for a live/cached FX rate when a
        mix is actually present — the common single-currency case stays exactly
        as cheap as a bare sum()."""
        amounts = [(getattr(r, attr), r.currency) for r in rows if getattr(r, attr) is not None]
        needs_conversion = any(cur != self.currency for _, cur in amounts)
        total = Decimal("0")
        if not needs_conversion:
            for amount, _ in amounts:
                total += amount
            return total

        from app.services import fx_service  # local: models shouldn't import services at module scope

        rate, _, _ = fx_service.get_usd_inr_rate()
        for amount, cur in amounts:
            total += fx_service.convert(amount, cur, self.currency, rate)
        return total

    @property
    def total_requested_amount(self) -> Decimal | None:
        """Sum of every submitted spend request's requested_amount (converted
        into this initiative's own currency where a row's differs), or None
        when there's no breakdown at all yet — lets a caller tell "nothing
        requested" apart from "zero requested". Mirrors spend_request_count's
        simplification of summing over every spend request rather than only
        the ones visible to a particular viewer (that filtering only happens
        on the detail endpoint, where the full objects are already loaded
        per-request)."""
        submitted = self._submitted_spend_requests
        if not submitted:
            return None
        return self._sum_converted(submitted, "requested_amount")

    @property
    def total_approved_amount(self) -> Decimal:
        """Sum of every submitted spend request's approved_amount (skipping
        any not yet decided, converting into this initiative's own currency
        where a row's differs), or — for an initiative with no breakdown of
        its own — its own approved budget, if its budget has been approved.
        Mirrors the same fallback `_financial_summary` uses on the detail
        endpoint, so this always lines up with what that page shows."""
        submitted = self._submitted_spend_requests
        if submitted:
            return self._sum_converted(
                [sr for sr in submitted if sr.approved_amount is not None], "approved_amount"
            )
        if self.budget_decision == "approved" and self.budget_approved_amount is not None:
            return self.budget_approved_amount
        return Decimal("0")
