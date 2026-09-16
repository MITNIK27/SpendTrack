from datetime import date

from app.core.fiscal import fiscal_quarter_of, fiscal_year_of


def test_fiscal_year_starts_in_april() -> None:
    assert fiscal_year_of(date(2025, 4, 1)) == 2026
    assert fiscal_year_of(date(2025, 12, 31)) == 2026
    assert fiscal_year_of(date(2026, 3, 31)) == 2026
    assert fiscal_year_of(date(2026, 4, 1)) == 2027


def test_fiscal_quarter_mapping() -> None:
    assert fiscal_quarter_of(date(2025, 4, 15)) == 1
    assert fiscal_quarter_of(date(2025, 6, 30)) == 1
    assert fiscal_quarter_of(date(2025, 7, 1)) == 2
    assert fiscal_quarter_of(date(2025, 9, 30)) == 2
    assert fiscal_quarter_of(date(2025, 10, 1)) == 3
    assert fiscal_quarter_of(date(2025, 12, 31)) == 3
    assert fiscal_quarter_of(date(2026, 1, 1)) == 4
    assert fiscal_quarter_of(date(2026, 3, 31)) == 4
