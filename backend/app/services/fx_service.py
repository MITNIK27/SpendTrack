"""Our own FX rate service — everything else in the backend calls
`get_usd_inr_rate()`/`convert()` here rather than reaching out to an external
provider directly, so swapping the data source later only ever touches this
file. Currently backed by the Frankfurter API (ECB official daily reference
rates: free, keyless, ToS-compliant) — not Google, not an ERP, not a scraper.

No Redis/APScheduler exists in this codebase yet, so this uses the simplest
correct pattern instead of introducing one: an in-process cache, lazily
refreshed once per calendar day.
"""
from datetime import date
from decimal import Decimal

import httpx

from app.core.config import settings

# Keyed by "<from>_<to>" (currently only ever "USD_INR") -> (rate, as_of).
_cache: dict[str, tuple[Decimal, date]] = {}


def get_usd_inr_rate() -> tuple[Decimal, date, bool]:
    """Returns (rate, as_of, is_stale). `is_stale` is True whenever the
    returned rate did NOT come from a fetch that succeeded just now — either
    because Frankfurter was unreachable and we fell back to the last known
    rate (however old), or, only if there has never been a successful fetch
    since this process started, the static `settings.fx_fallback_usd_inr`."""
    key = "USD_INR"
    today = date.today()
    cached = _cache.get(key)
    if cached is not None and cached[1] == today:
        return cached[0], cached[1], False

    try:
        response = httpx.get(settings.fx_rate_api_url, params={"from": "USD", "to": "INR"}, timeout=5.0)
        response.raise_for_status()
        rate = Decimal(str(response.json()["rates"]["INR"]))
        _cache[key] = (rate, today)
        return rate, today, False
    except Exception:
        if cached is not None:
            return cached[0], cached[1], True
        return settings.fx_fallback_usd_inr, today, True


def convert(amount: Decimal, from_currency: str, to_currency: str, rate_usd_inr: Decimal) -> Decimal:
    """Converts `amount` between currencies using the given USD→INR rate.
    Identity if the currencies already match; a no-op for any pair other than
    USD/INR (the only two currencies the app supports today)."""
    if from_currency == to_currency:
        return amount
    if from_currency == "USD" and to_currency == "INR":
        return amount * rate_usd_inr
    if from_currency == "INR" and to_currency == "USD":
        return amount / rate_usd_inr
    return amount
