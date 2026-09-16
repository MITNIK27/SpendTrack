from datetime import date

# InfoBeans' fiscal year — assumed April-to-March (the common Indian FY convention),
# labeled by the calendar year it ends in (Apr 2025-Mar 2026 = FY2026). This is an
# open item to confirm with stakeholders (see docs/plan); change this one constant
# if it's wrong, everything downstream derives from it.
FISCAL_YEAR_START_MONTH = 4


def fiscal_year_of(d: date) -> int:
    return d.year + 1 if d.month >= FISCAL_YEAR_START_MONTH else d.year


def fiscal_quarter_of(d: date) -> int:
    months_since_start = (d.month - FISCAL_YEAR_START_MONTH) % 12
    return months_since_start // 3 + 1


def fiscal_month_of(d: date) -> int:
    """1-12 with the fiscal year's first month (April) as 1 — for ordering a
    monthly trend chart Apr→Mar instead of calendar Jan→Dec."""
    return (d.month - FISCAL_YEAR_START_MONTH) % 12 + 1


def current_fiscal_year() -> int:
    return fiscal_year_of(date.today())
