import json
from collections.abc import Iterator
from datetime import date
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db import get_db
from app.main import app
from app.models import Country, Rule

TEST_COUNTRY = "XX"
EMPTY_COUNTRY = "ZZ"
SOURCE_URL = "https://example.com/xx-rules"
APPLIES_FROM = date(2026, 1, 1)
REVIEWED_ON = date(2026, 2, 1)

GENERATED = {
    "explanations": ["You must issue structured e-invoices from the date shown."],
    "next_steps": ["Pick a Peppol provider", "Update your invoicing tool", "Test one invoice"],
}


@pytest.fixture
def seeded_client(db_session: Session) -> Iterator[TestClient]:
    """A TestClient whose endpoints run inside the test's rolled-back transaction.

    Without the dependency override the endpoint would open its own session
    on a separate connection and never see rows seeded here.
    """
    db_session.add(
        Country(code=TEST_COUNTRY, name="Testland", last_reviewed=REVIEWED_ON, status="live")
    )
    db_session.add(
        Rule(
            country_code=TEST_COUNTRY,
            rule_type="issue",
            applies_from=APPLIES_FROM,
            applies_to_segment="all",
            format_required="Peppol BIS 3.0",
            network="Peppol",
            source_url=SOURCE_URL,
            source_reviewed_at=REVIEWED_ON,
        )
    )
    db_session.flush()

    app.dependency_overrides[get_db] = lambda: db_session
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def mock_call_claude(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    mock = MagicMock(return_value=json.dumps(GENERATED))
    monkeypatch.setattr("app.routers.assess.call_claude", mock)
    return mock


def _profile(country: str) -> dict:
    return {
        "country": country,
        "vat_registered": True,
        "employee_count": 4,
        "annual_turnover_eur": 380000,
        "invoices_to": ["B2B", "B2C"],
    }


def test_matching_profile_returns_obligations_copied_verbatim_from_the_rules_row(
    seeded_client: TestClient, mock_call_claude: MagicMock
) -> None:
    response = seeded_client.post("/api/assess", json=_profile(TEST_COUNTRY))

    assert response.status_code == 200
    body = response.json()
    assert body["in_scope"] is True
    assert len(body["obligations"]) == 1

    obligation = body["obligations"][0]
    # Exact equality, not just presence: these must come from the database
    # row, never from the LLM.
    assert obligation["rule_type"] == "issue"
    assert obligation["applies_from"] == APPLIES_FROM.isoformat()
    assert obligation["format_required"] == "Peppol BIS 3.0"
    assert obligation["network"] == "Peppol"
    assert obligation["source_url"] == SOURCE_URL
    assert obligation["source_reviewed_at"] == REVIEWED_ON.isoformat()

    # Only the prose comes from the LLM.
    assert obligation["explanation"] == GENERATED["explanations"][0]
    assert body["next_steps"] == GENERATED["next_steps"]
    assert body["disclaimer"] == "Informational guidance only, not tax or legal advice."


def test_profile_matching_no_rules_is_out_of_scope_and_makes_no_llm_call(
    seeded_client: TestClient, mock_call_claude: MagicMock
) -> None:
    response = seeded_client.post("/api/assess", json=_profile(EMPTY_COUNTRY))

    assert response.status_code == 200
    body = response.json()
    assert body["in_scope"] is False
    assert body["obligations"] == []
    assert body["next_steps"] == []
    mock_call_claude.assert_not_called()


def test_fenced_json_from_the_model_is_still_parsed(
    seeded_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Regression: claude-sonnet-5 really does wrap replies in ```json fences."""
    fenced = f"```json\n{json.dumps(GENERATED)}\n```"
    monkeypatch.setattr("app.routers.assess.call_claude", MagicMock(return_value=fenced))

    response = seeded_client.post("/api/assess", json=_profile(TEST_COUNTRY))

    body = response.json()
    assert body["obligations"][0]["explanation"] == GENERATED["explanations"][0]
    assert body["next_steps"] == GENERATED["next_steps"]


def test_unparseable_generation_degrades_to_facts_only(
    seeded_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Prose can fail; the compliance-critical fields must still be correct."""
    monkeypatch.setattr("app.routers.assess.call_claude", MagicMock(return_value="not json at all"))

    response = seeded_client.post("/api/assess", json=_profile(TEST_COUNTRY))

    assert response.status_code == 200
    body = response.json()
    assert body["obligations"][0]["applies_from"] == APPLIES_FROM.isoformat()
    assert body["obligations"][0]["format_required"] == "Peppol BIS 3.0"
    assert body["obligations"][0]["explanation"] == ""
    assert body["next_steps"] == []


def test_identical_payload_twice_only_generates_once(
    seeded_client: TestClient, mock_call_claude: MagicMock
) -> None:
    first = seeded_client.post("/api/assess", json=_profile(TEST_COUNTRY))
    second = seeded_client.post("/api/assess", json=_profile(TEST_COUNTRY))

    assert first.json() == second.json()
    mock_call_claude.assert_called_once()
