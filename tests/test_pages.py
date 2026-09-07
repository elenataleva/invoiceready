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
from app.routers.pages import DISCLAIMER

COUNTRY = "BE"
SOURCE_URL = "https://example.com/be-page-test"
APPLIES_FROM = date(2026, 1, 1)
REVIEWED_ON = date(2026, 2, 1)

GENERATED = {
    "explanations": ["You must issue structured e-invoices from the date shown."],
    "next_steps": ["Pick a Peppol provider", "Update your invoicing tool", "Test one invoice"],
}


@pytest.fixture
def seeded_client(db_session: Session, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    """A TestClient sharing the test's rolled-back transaction, with a BE rule seeded.

    The rules table is empty in the real database until Task 16, so the
    obligation this test renders has to be seeded here.
    """
    if db_session.get(Country, COUNTRY) is None:
        db_session.add(
            Country(code=COUNTRY, name="Belgium", last_reviewed=REVIEWED_ON, status="live")
        )
    db_session.add(
        Rule(
            country_code=COUNTRY,
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

    monkeypatch.setattr(
        "app.routers.assess.call_claude", MagicMock(return_value=json.dumps(GENERATED))
    )
    app.dependency_overrides[get_db] = lambda: db_session
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_intake_page_renders_the_form_and_the_disclaimer(seeded_client: TestClient) -> None:
    response = seeded_client.get("/")

    assert response.status_code == 200
    html = response.text
    assert DISCLAIMER in html
    for field in (
        "country",
        "vat_registered",
        "employee_count",
        "annual_turnover_eur",
        "invoices_to",
    ):
        assert f'name="{field}"' in html


def test_submitting_a_be_profile_renders_obligations_with_sources(
    seeded_client: TestClient,
) -> None:
    response = seeded_client.post(
        "/assess",
        data={
            "country": COUNTRY,
            "vat_registered": "true",
            "employee_count": "4",
            "annual_turnover_eur": "380000",
            "invoices_to": ["B2B", "B2C"],
        },
    )

    assert response.status_code == 200
    html = response.text
    assert SOURCE_URL in html
    assert APPLIES_FROM.isoformat() in html
    assert "Peppol BIS 3.0" in html
    assert GENERATED["next_steps"][0] in html
    assert DISCLAIMER in html


def test_blank_turnover_is_accepted_rather_than_rejected(seeded_client: TestClient) -> None:
    """An untouched optional number input posts "", not a missing field."""
    response = seeded_client.post(
        "/assess",
        data={
            "country": COUNTRY,
            "vat_registered": "false",
            "employee_count": "0",
            "annual_turnover_eur": "",
            "invoices_to": [],
        },
    )

    assert response.status_code == 200
    assert SOURCE_URL in response.text


def test_result_page_wires_up_the_follow_up_question_form(seeded_client: TestClient) -> None:
    """The JS itself is verified manually (no JS test runner); this guards the wiring."""
    response = seeded_client.post(
        "/assess",
        data={
            "country": COUNTRY,
            "vat_registered": "true",
            "employee_count": "4",
            "annual_turnover_eur": "380000",
            "invoices_to": ["B2B"],
        },
    )

    html = response.text
    assert 'id="ask-form"' in html
    # The country is carried over so the user never re-types it.
    assert f'data-country="{COUNTRY}"' in html
    assert 'id="ask-answer"' in html
    assert "/static/ask.js" in html
