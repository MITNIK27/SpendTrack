from decimal import Decimal

from app.models.spend_request import SpendRequest


def test_variance_is_none_before_a_decision() -> None:
    sr = SpendRequest(requested_amount=Decimal("200000"), approved_amount=None)
    assert sr.variance is None


def test_variance_is_negative_when_approved_less_than_requested() -> None:
    sr = SpendRequest(requested_amount=Decimal("200000"), approved_amount=Decimal("150000"))
    assert sr.variance == Decimal("-50000")


def test_variance_is_zero_when_approved_matches_requested() -> None:
    sr = SpendRequest(requested_amount=Decimal("50000"), approved_amount=Decimal("50000"))
    assert sr.variance == Decimal("0")


def test_variance_is_positive_when_approved_more_than_requested() -> None:
    sr = SpendRequest(requested_amount=Decimal("100000"), approved_amount=Decimal("120000"))
    assert sr.variance == Decimal("20000")
