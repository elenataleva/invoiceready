"""Task 18: every request leaves a queryable query_logs row.

Before this task, `retrieved_ids` was NULL on every row ever written, and
the two paths that make no LLM call - an /api/ask refusal and an
out-of-scope /api/assess - left no row at all. These tests pin all three.
"""

import json
from collections.abc import Iterator
from datetime import date
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.main import app
from app.models import Country, QueryLog, Rule
from app.routers.ask import ENDPOINT as ASK_ENDPOINT
from app.routers.assess import CACHE_ENDPOINT, CACHE_HIT_ENDPOINT
from app.routers.assess import ENDPOINT as ASSESS_ENDPOINT

TEST_COUNTRY = "XX"
SOURCE_URL = "https://example.com/xx-rules"
APPLIES_FROM = date(2026, 1, 1)
REVIEWED_ON = date(2026, 2, 1)

GENERATED = {
    "explanations": ["You must issue structured e-invoices from the date shown."],
    "next_steps": ["Pick a provider", "Update your tool", "Test one invoice"],
}


@pytest.fixture
def seeded_client(db_session: Session, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
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

    monkeypatch.setattr(
        "app.routers.assess.call_claude", MagicMock(return_value=json.dumps(GENERATED))
    )
    app.dependency_overrides[get_db] = lambda: db_session
    yield TestClient(app)
    app.dependency_overrides.clear()


def _rows(db: Session, endpoint: str) -> list[QueryLog]:
    return list(
        db.execute(select(QueryLog).where(QueryLog.endpoint == endpoint).order_by(QueryLog.id))
        .scalars()
        .all()
    )


def _profile(country: str) -> dict:
    return {
        "country": country,
        "vat_registered": True,
        "employee_count": 4,
        "annual_turnover_eur": 380000,
        "invoices_to": ["B2B"],
    }


def test_ask_refusal_is_logged_with_empty_retrieved_ids_and_refused_true(
    seeded_client: TestClient, db_session: Session
) -> None:
    """The path that makes no LLM call used to leave no trace at all."""
    before = len(_rows(db_session, ASK_ENDPOINT))

    response = seeded_client.post(
        "/api/ask", json={"country": TEST_COUNTRY, "question": "what's the best pizza topping"}
    )
    assert response.json()["refused"] is True

    rows = _rows(db_session, ASK_ENDPOINT)
    assert len(rows) == before + 1

    row = rows[-1]
    assert row.refused is True
    # [] not NULL: "retrieved nothing" differs from "nobody recorded it".
    assert row.retrieved_ids == []
    assert row.request_payload["question"] == "what's the best pizza topping"
    assert row.request_payload["country"] == TEST_COUNTRY


def test_ask_grounded_answer_passes_the_retrieved_chunk_ids_to_be_logged(
    seeded_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The router owns retrieved_ids - only it knows what retrieval returned."""
    mock = MagicMock(return_value="Belgium requires Peppol BIS 3.0.")
    monkeypatch.setattr("app.routers.ask.call_claude", mock)

    response = seeded_client.post(
        "/api/ask",
        json={"country": "BE", "question": "What invoice format do I need to use in Belgium?"},
    )
    assert response.json()["refused"] is False

    kwargs = mock.call_args.kwargs
    assert kwargs["refused"] is False
    assert kwargs["retrieved_ids"], "a grounded answer must record which chunks grounded it"
    assert all(isinstance(chunk_id, int) for chunk_id in kwargs["retrieved_ids"])


def test_assess_writes_a_row_whose_payload_matches_the_submitted_profile(
    seeded_client: TestClient, db_session: Session
) -> None:
    profile = _profile(TEST_COUNTRY)
    before = len(_rows(db_session, CACHE_ENDPOINT))

    response = seeded_client.post("/api/assess", json=profile)
    assert response.json()["in_scope"] is True

    rows = _rows(db_session, CACHE_ENDPOINT)
    assert len(rows) == before + 1
    assert rows[-1].request_payload is not None
    assert rows[-1].request_payload["profile"] == profile


def test_assess_out_of_scope_is_logged_even_though_no_llm_runs(
    seeded_client: TestClient, db_session: Session
) -> None:
    """ "No rule matched" is the signal that the rules table has a gap."""
    before = len(_rows(db_session, ASSESS_ENDPOINT))

    response = seeded_client.post("/api/assess", json=_profile("ZZ"))
    assert response.json()["in_scope"] is False

    rows = _rows(db_session, ASSESS_ENDPOINT)
    assert len(rows) == before + 1

    row = rows[-1]
    assert row.request_payload["in_scope"] is False
    assert row.request_payload["profile"]["country"] == "ZZ"
    assert row.retrieved_ids == []


def test_repeat_assess_served_from_cache_is_still_logged(
    seeded_client: TestClient, db_session: Session
) -> None:
    """Caching must not make the endpoint look unused."""
    profile = _profile(TEST_COUNTRY)
    before = len(_rows(db_session, CACHE_HIT_ENDPOINT))

    seeded_client.post("/api/assess", json=profile)
    seeded_client.post("/api/assess", json=profile)

    hits = _rows(db_session, CACHE_HIT_ENDPOINT)
    assert len(hits) == before + 1
    assert hits[-1].request_payload["profile"] == profile
    assert hits[-1].retrieved_ids, "the cache hit still knows which rules applied"
