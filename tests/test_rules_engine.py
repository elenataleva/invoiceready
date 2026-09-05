from datetime import date

from sqlalchemy.orm import Session

from app.models import Country, Rule
from app.rules_engine import get_applicable_rules

TEST_COUNTRY = "XX"
EMPTY_COUNTRY = "YY"
SOURCE_URL = "https://example.com/source"
REVIEWED_ON = date(2026, 1, 1)


def _seed_country(db_session: Session, code: str) -> None:
    db_session.add(
        Country(code=code, name="Test Country", last_reviewed=REVIEWED_ON, status="live")
    )
    db_session.flush()


def _make_rule(
    country_code: str,
    rule_type: str,
    applies_to_segment: str,
    applies_from: date = date(2026, 1, 1),
    threshold_amount: int | None = None,
) -> Rule:
    return Rule(
        country_code=country_code,
        rule_type=rule_type,
        applies_from=applies_from,
        applies_to_segment=applies_to_segment,
        threshold_amount=threshold_amount,
        source_url=SOURCE_URL,
        source_reviewed_at=REVIEWED_ON,
    )


def test_all_segment_always_matches(db_session: Session) -> None:
    _seed_country(db_session, TEST_COUNTRY)
    rule = _make_rule(TEST_COUNTRY, "issue", "all")
    db_session.add(rule)
    db_session.flush()

    result = get_applicable_rules(
        db_session,
        country=TEST_COUNTRY,
        employee_count=1,
        annual_turnover_eur=0,
        invoices_to=["B2B"],
    )

    assert [r.id for r in result] == [rule.id]


def test_turnover_above_matches_when_above_threshold(db_session: Session) -> None:
    _seed_country(db_session, TEST_COUNTRY)
    rule = _make_rule(TEST_COUNTRY, "issue", "turnover_above", threshold_amount=100_000)
    db_session.add(rule)
    db_session.flush()

    result = get_applicable_rules(
        db_session,
        country=TEST_COUNTRY,
        employee_count=5,
        annual_turnover_eur=100_001,
        invoices_to=["B2B"],
    )

    assert [r.id for r in result] == [rule.id]


def test_turnover_above_does_not_match_at_exact_threshold(db_session: Session) -> None:
    _seed_country(db_session, TEST_COUNTRY)
    rule = _make_rule(TEST_COUNTRY, "issue", "turnover_above", threshold_amount=100_000)
    db_session.add(rule)
    db_session.flush()

    result = get_applicable_rules(
        db_session,
        country=TEST_COUNTRY,
        employee_count=5,
        annual_turnover_eur=100_000,
        invoices_to=["B2B"],
    )

    assert result == []


def test_turnover_above_does_not_match_below_threshold(db_session: Session) -> None:
    _seed_country(db_session, TEST_COUNTRY)
    rule = _make_rule(TEST_COUNTRY, "issue", "turnover_above", threshold_amount=100_000)
    db_session.add(rule)
    db_session.flush()

    result = get_applicable_rules(
        db_session,
        country=TEST_COUNTRY,
        employee_count=5,
        annual_turnover_eur=99_999,
        invoices_to=["B2B"],
    )

    assert result == []


def test_multiple_rules_across_rule_types_returned_together(db_session: Session) -> None:
    _seed_country(db_session, TEST_COUNTRY)
    issue_rule = _make_rule(TEST_COUNTRY, "issue", "all")
    report_rule = _make_rule(TEST_COUNTRY, "report", "turnover_above", threshold_amount=50_000)
    db_session.add_all([issue_rule, report_rule])
    db_session.flush()

    result = get_applicable_rules(
        db_session,
        country=TEST_COUNTRY,
        employee_count=10,
        annual_turnover_eur=60_000,
        invoices_to=["B2B", "B2C"],
    )

    assert {r.id for r in result} == {issue_rule.id, report_rule.id}


def test_country_with_zero_seeded_rules_returns_empty(db_session: Session) -> None:
    _seed_country(db_session, EMPTY_COUNTRY)

    result = get_applicable_rules(
        db_session,
        country=EMPTY_COUNTRY,
        employee_count=5,
        annual_turnover_eur=1_000_000,
        invoices_to=["B2B"],
    )

    assert result == []


def test_rule_with_future_applies_from_is_still_returned(db_session: Session) -> None:
    """Documented assumption: a rule is 'applicable' once the profile matches
    its segment, regardless of whether applies_from is already in effect -
    this endpoint answers "what applies to you", not "what's in effect today".
    """
    _seed_country(db_session, TEST_COUNTRY)
    future_rule = _make_rule(TEST_COUNTRY, "issue", "all", applies_from=date(2030, 1, 1))
    db_session.add(future_rule)
    db_session.flush()

    result = get_applicable_rules(
        db_session,
        country=TEST_COUNTRY,
        employee_count=1,
        annual_turnover_eur=0,
        invoices_to=["B2B"],
    )

    assert [r.id for r in result] == [future_rule.id]
