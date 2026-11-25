"""Our own FX rate service — everything else in the backend prices money
through here rather than reaching out to an external provider directly, so
swapping the data source later only ever touches this file.

Rates are stored as "INR per 1 unit of <currency>" in the `fx_rates` table,
one row per currency per day, so a report re-run later converts each spend at
the rate logged for its own date rather than today's. INR is the pivot: any
pair converts via INR, so adding a currency never needs new pair logic.

Sources (Frankfurter = ECB daily reference rates: free, keyless):
- USD, EUR: fetched from Frankfurter.
- AED: not published by the ECB. The UAE Dirham is officially pegged to the
  US Dollar, so it's derived exactly from the day's USD rate.

No scheduler exists in this codebase, so the first request of the day that
needs a rate logs that day's rates (in its own short session, never inside
the caller's transaction).
"""

import bisect
import logging
import uuid
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import SessionLocal
from app.models.fx_rate import FxRate

logger = logging.getLogger(__name__)

BASE_CURRENCY = "INR"
PRICED_CURRENCIES = ("USD", "AED", "EUR")
_FETCHED_CURRENCIES = ("USD", "EUR")
AED_PER_USD = Decimal("3.6725")
# While the provider is down, don't stall every request on a 5s timeout.
_RETRY_AFTER = timedelta(minutes=15)

_logged_on: date | None = None
_last_failed_attempt: datetime | None = None


@dataclass(frozen=True)
class Rate:
    rate_to_inr: Decimal
    as_of: date
    is_stale: bool


def _fetch_rate_to_inr(currency: str) -> Decimal:
    response = httpx.get(settings.fx_rate_api_url, params={"from": currency, "to": BASE_CURRENCY}, timeout=5.0)
    response.raise_for_status()
    return Decimal(str(response.json()["rates"][BASE_CURRENCY]))


def ensure_todays_rates() -> None:
    """Logs today's rate for every priced currency that doesn't have one yet."""
    global _logged_on, _last_failed_attempt
    today = date.today()
    if _logged_on == today:
        return
    if _last_failed_attempt is not None and datetime.now() - _last_failed_attempt < _RETRY_AFTER:
        return

    with SessionLocal() as db:
        logged = dict(db.execute(select(FxRate.currency, FxRate.rate_to_inr).where(FxRate.as_of == today)).all())
        new_rows: dict[str, Decimal] = {}
        for currency in _FETCHED_CURRENCIES:
            if currency in logged:
                continue
            try:
                new_rows[currency] = _fetch_rate_to_inr(currency)
            except Exception:
                logger.warning("FX fetch failed for %s->INR", currency, exc_info=True)

        usd = new_rows.get("USD") or logged.get("USD")
        if "AED" not in logged and usd is not None:
            new_rows["AED"] = usd / AED_PER_USD

        if new_rows:
            db.execute(
                insert(FxRate)
                .values(
                    [
                        {"id": uuid.uuid4(), "currency": c, "as_of": today, "rate_to_inr": r}
                        for c, r in new_rows.items()
                    ]
                )
                .on_conflict_do_nothing(constraint="uq_fx_rates_currency_as_of")
            )
            db.commit()

    if all(c in logged or c in new_rows for c in PRICED_CURRENCIES):
        _logged_on = today
        _last_failed_attempt = None
    else:
        _last_failed_attempt = datetime.now()


class RateBook:
    """Every logged rate, loaded once (the table is ~3 rows/day) so a report
    can price hundreds of rows at their own dates without a query per row."""

    def __init__(self, rows: list[tuple[str, date, Decimal]]):
        self._dates: dict[str, list[date]] = {}
        self._rates: dict[str, list[Decimal]] = {}
        for currency, as_of, rate in sorted(rows, key=lambda r: (r[0], r[1])):
            self._dates.setdefault(currency, []).append(as_of)
            self._rates.setdefault(currency, []).append(rate)

    @classmethod
    def load(cls, db: Session) -> "RateBook":
        ensure_todays_rates()
        return cls(list(db.execute(select(FxRate.currency, FxRate.as_of, FxRate.rate_to_inr)).all()))

    def rate(self, currency: str, on: date) -> Rate:
        """Latest rate logged on or before `on`; before logging began, the
        earliest one logged; with nothing logged at all, the static fallback."""
        if currency == BASE_CURRENCY:
            return Rate(Decimal("1"), on, False)
        dates = self._dates.get(currency)
        if not dates:
            return Rate(settings.fx_fallback_rates_to_inr[currency], on, True)
        i = bisect.bisect_right(dates, on) - 1
        if i < 0:
            i = 0
        return Rate(self._rates[currency][i], dates[i], dates[i] != on)

    def rates_on(self, on: date) -> dict[str, Decimal]:
        return {c: self.rate(c, on).rate_to_inr for c in (BASE_CURRENCY, *PRICED_CURRENCIES)}


def current_rates(db: Session) -> dict[str, Decimal]:
    """Today's rate_to_inr for every supported currency (INR included, as 1)."""
    return RateBook.load(db).rates_on(date.today())


def convert(amount: Decimal, from_currency: str, to_currency: str, rates_to_inr: Mapping[str, Decimal]) -> Decimal:
    if from_currency == to_currency:
        return amount
    return amount * rates_to_inr[from_currency] / rates_to_inr[to_currency]
