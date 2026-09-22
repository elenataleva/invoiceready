import asyncio
import json
from datetime import date
from decimal import Decimal
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from fastmcp import Client
from fastmcp.client.client import CallToolResult
from mcp.types import Tool
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.main import app
from app.models import Country, Rule
from app.rules_engine import get_applicable_rules
from mcp_server.schemas import DISCLAIMER
from mcp_server.server import _coverage, _lookup, mcp

# Runs against the real countries seeded by ingest.py/seed_rules.py (BE, FR,
# PL) - same "test against real dev data" decision as test_countries_api.py.

UNCOVERED_COUNTRY = "IT"
TEST_COUNTRY = "ZZ"

# One profile per seeded country. Every seeded rule is segment 'all', so
# these exercise the pass-through but not the turnover threshold - the
# 'turnover_above' segment gets its own test with a rule seeded for it.
PROFILES: list[dict[str, Any]] = [
    {
        "country": "BE",
        "vat_registered": True,
        "employee_count": 4,
        "annual_turnover_eur": 380000.0,
        "invoices_to": ["B2B", "B2C"],
    },
    {
        "country": "FR",
        "vat_registered": True,
        "employee_count": 120,
        "annual_turnover_eur": 9500000.0,
        "invoices_to": ["B2B"],
    },
    {
        "country": "PL",
        "vat_registered": False,
        "employee_count": 1,
        "annual_turnover_eur": None,
        "invoices_to": ["B2C"],
    },
]


def _seed_country(db: Session) -> None:
    db.add(
        Country(code=TEST_COUNTRY, name="Testland", last_reviewed=date(2026, 2, 1), status="live")
    )
    db.flush()


def _test_profile(annual_turnover_eur: float | None) -> dict[str, Any]:
    return {
        "country": TEST_COUNTRY,
        "vat_registered": True,
        "employee_count": 4,
        "annual_turnover_eur": annual_turnover_eur,
        "invoices_to": ["B2B"],
    }


def _facts(obligation: Any) -> tuple:
    """The fields that must be identical whichever front door served them."""
    return (
        obligation.rule_type,
        obligation.applies_from,
        obligation.format_required,
        obligation.network,
        obligation.source_url,
        obligation.source_reviewed_at,
    )


def _list_tools() -> list[Tool]:
    async def run() -> list[Tool]:
        async with Client(mcp) as client:
            return await client.list_tools()

    return asyncio.run(run())


def _call_tool(name: str, arguments: dict[str, Any]) -> CallToolResult:
    async def run() -> CallToolResult:
        async with Client(mcp) as client:
            return await client.call_tool(name, arguments)

    return asyncio.run(run())


def _tool(name: str) -> Tool:
    return next(tool for tool in _list_tools() if tool.name == name)


def test_the_server_exposes_the_two_tools_and_nothing_else() -> None:
    """A small, well-described surface beats a large vague one: every tool
    description spends the client's context window."""
    assert sorted(tool.name for tool in _list_tools()) == [
        "check_country_coverage",
        "get_einvoicing_rules",
    ]


def test_the_rules_tool_description_is_one_a_model_can_act_on() -> None:
    # The docstring is the prompt the model reads when deciding whether to
    # call this, so an empty or country-free one is a real defect, not a
    # documentation nit.
    description = _tool("get_einvoicing_rules").description or ""

    assert "BE" in description
    assert "source_url" in description
    assert "covered" in description


def test_the_tool_advertises_the_arguments_the_plan_specifies() -> None:
    schema = _tool("get_einvoicing_rules").input_schema

    assert set(schema["required"]) >= {
        "country",
        "vat_registered",
        "employee_count",
        "invoices_to",
    }
    assert set(schema["properties"]) == {
        "country",
        "vat_registered",
        "employee_count",
        "annual_turnover_eur",
        "invoices_to",
    }


@pytest.mark.parametrize("profile", PROFILES, ids=lambda profile: str(profile["country"]))
def test_the_tool_returns_exactly_what_the_rules_engine_returns(
    db_session: Session, profile: dict[str, Any]
) -> None:
    """Parity, which is the whole architectural claim: no second rules brain."""
    result = _lookup(db_session, **profile)

    expected = get_applicable_rules(
        db_session,
        country=str(profile["country"]),
        employee_count=int(profile["employee_count"]),
        annual_turnover_eur=profile["annual_turnover_eur"],
        invoices_to=list(profile["invoices_to"]),
    )

    assert result.covered is True
    assert result.in_scope is bool(expected)
    assert sorted(_facts(obligation) for obligation in result.obligations) == sorted(
        _facts(rule) for rule in expected
    )


def test_the_tool_matches_the_assess_endpoint_for_the_same_belgian_profile(
    monkeypatch: pytest.MonkeyPatch, db_session: Session
) -> None:
    """The acceptance criterion for this task, as a test rather than by hand."""
    monkeypatch.setattr(
        "app.routers.assess.call_claude",
        MagicMock(return_value=json.dumps({"explanations": [], "next_steps": []})),
    )
    profile = PROFILES[0]

    response = TestClient(app).post("/api/assess", json=profile)
    assert response.status_code == 200
    body = response.json()

    result = _lookup(db_session, **profile)

    assert result.in_scope is body["in_scope"]
    assert sorted(_facts(obligation) for obligation in result.obligations) == sorted(
        (
            obligation["rule_type"],
            date.fromisoformat(obligation["applies_from"]),
            obligation["format_required"],
            obligation["network"],
            obligation["source_url"],
            date.fromisoformat(obligation["source_reviewed_at"]),
        )
        for obligation in body["obligations"]
    )


@pytest.mark.parametrize("profile", PROFILES, ids=lambda profile: str(profile["country"]))
def test_every_obligation_carries_a_source_and_a_review_date(
    db_session: Session, profile: dict[str, Any]
) -> None:
    """CLAUDE.md: every factual claim carries a source URL - across the
    protocol boundary too, where the client has no other framing for it."""
    result = _lookup(db_session, **profile)

    for obligation in result.obligations:
        assert obligation.source_url.startswith("https://")
        assert obligation.source_reviewed_at


def test_an_uncovered_country_is_a_refusal_rather_than_an_error_or_a_guess(
    db_session: Session,
) -> None:
    result = _lookup(
        db_session,
        country=UNCOVERED_COUNTRY,
        vat_registered=True,
        employee_count=4,
        annual_turnover_eur=380000.0,
        invoices_to=["B2B"],
    )

    assert result.covered is False
    assert result.in_scope is False
    assert result.obligations == []
    assert {"BE", "FR", "PL"} <= set(result.covered_countries)
    # Naming them in the prose too: the client's model may surface the notice
    # to a user without the structured fields alongside it.
    for code in result.covered_countries:
        assert code in result.notice
    assert result.disclaimer == DISCLAIMER


def test_a_covered_country_with_no_matching_rule_is_not_reported_as_uncovered(
    db_session: Session,
) -> None:
    """Conflating the two would let the server say "nothing applies to you"
    about a country it has never heard of."""
    _seed_country(db_session)

    result = _lookup(db_session, **_test_profile(380000.0))

    assert result.covered is True
    assert result.in_scope is False
    assert result.obligations == []


def test_a_turnover_threshold_is_compared_against_the_number_the_client_sent(
    db_session: Session,
) -> None:
    """The tool takes a float because JSON has one number type, while
    thresholds are stored as Numeric - so the boundary is worth pinning down."""
    _seed_country(db_session)
    db_session.add(
        Rule(
            country_code=TEST_COUNTRY,
            rule_type="issue",
            applies_from=date(2026, 1, 1),
            applies_to_segment="turnover_above",
            threshold_amount=Decimal(200000),
            threshold_currency="EUR",
            source_url="https://example.com/zz-rules",
            source_reviewed_at=date(2026, 2, 1),
        )
    )
    db_session.flush()

    assert _lookup(db_session, **_test_profile(200000.01)).in_scope is True
    assert _lookup(db_session, **_test_profile(199999.99)).in_scope is False
    # Unknown turnover must not be treated as clearing the threshold.
    assert _lookup(db_session, **_test_profile(None)).in_scope is False


def test_a_lowercase_country_code_is_the_same_lookup(db_session: Session) -> None:
    assert _lookup(db_session, **{**PROFILES[0], "country": "be"}) == _lookup(
        db_session, **PROFILES[0]
    )


def test_calling_the_tool_over_the_protocol_returns_the_obligations_and_the_disclaimer() -> None:
    """End to end through JSON-RPC, so the wiring is covered and not just the
    function behind it - this one opens its own session, as a real client would."""
    result = _call_tool("get_einvoicing_rules", PROFILES[0])

    assert result.data.covered is True
    assert result.data.in_scope is True
    assert result.data.disclaimer == DISCLAIMER
    for obligation in result.data.obligations:
        assert obligation.source_url.startswith("https://")


def test_the_disclaimer_is_the_one_the_rest_api_uses() -> None:
    """Guards the copy in mcp_server/schemas.py, which exists so this package
    does not have to import the HTTP layer to get one string."""
    from app.routers.assess import DISCLAIMER as REST_DISCLAIMER

    assert DISCLAIMER == REST_DISCLAIMER


def test_coverage_with_no_argument_lists_exactly_the_countries_table(
    db_session: Session,
) -> None:
    rows = db_session.execute(select(Country).order_by(Country.code)).scalars().all()

    result = _coverage(db_session)

    assert result.requested_country is None
    assert result.covered is None
    assert [entry.code for entry in result.countries] == [row.code for row in rows]
    assert [(entry.name, entry.status, entry.last_reviewed) for entry in result.countries] == [
        (row.name, row.status, row.last_reviewed) for row in rows
    ]
    # The review date is the point of the tool: a covered country whose
    # source was checked two years ago is not the same as a current one.
    for entry in result.countries:
        assert entry.last_reviewed


def test_coverage_names_a_covered_country_with_its_review_date(db_session: Session) -> None:
    result = _coverage(db_session, "BE")

    assert result.requested_country == "BE"
    assert result.covered is True
    belgium = next(entry for entry in result.countries if entry.code == "BE")
    assert str(belgium.last_reviewed) in result.notice


def test_coverage_of_an_uncovered_country_is_a_plain_no_rather_than_an_error(
    db_session: Session,
) -> None:
    result = _coverage(db_session, UNCOVERED_COUNTRY)

    assert result.covered is False
    assert UNCOVERED_COUNTRY not in {entry.code for entry in result.countries}
    # The alternatives travel with the refusal, so a client never has to make
    # a second call to find out what it could have asked instead.
    assert {"BE", "FR", "PL"} <= {entry.code for entry in result.countries}
    for entry in result.countries:
        assert entry.code in result.notice


def test_coverage_is_case_insensitive(db_session: Session) -> None:
    assert _coverage(db_session, "be") == _coverage(db_session, "BE")


def test_a_country_added_to_the_database_shows_up_with_no_code_change(
    db_session: Session,
) -> None:
    """The country list lives in the countries table, never in this module."""
    before = {entry.code for entry in _coverage(db_session).countries}
    assert TEST_COUNTRY not in before

    _seed_country(db_session)

    after = _coverage(db_session)
    assert {entry.code for entry in after.countries} == before | {TEST_COUNTRY}
    assert _coverage(db_session, TEST_COUNTRY).covered is True


def test_the_coverage_tool_description_tells_the_model_to_call_it_when_unsure() -> None:
    description = _tool("check_country_coverage").description or ""

    assert "unsure" in description
    assert "last_reviewed" in description
    # Coverage is narrow, so the expensive mistake is a model treating
    # "not covered" as "no rules exist there".
    assert "not the same" in description


def test_the_coverage_tool_takes_an_optional_country_over_the_protocol() -> None:
    listed = _call_tool("check_country_coverage", {})
    one = _call_tool("check_country_coverage", {"country": "BE"})

    assert listed.data.covered is None
    assert {entry.code for entry in listed.data.countries} >= {"BE", "FR", "PL"}
    assert one.data.covered is True
    assert one.data.requested_country == "BE"
    assert "country" not in _tool("check_country_coverage").input_schema.get("required", [])
