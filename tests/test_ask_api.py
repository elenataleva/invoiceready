from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

# These tests run against the real BE data committed by `python
# scripts/ingest.py` (Task 8) for retrieval, same decision as
# tests/test_retrieval.py. `call_claude` is mocked in every test so no
# real API calls or query_logs writes happen here - Task 10's own manual
# verification already covers the real call path.


@pytest.fixture
def mock_call_claude(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    mock = MagicMock(return_value="Belgium requires Peppol BIS 3.0 for structured invoices.")
    monkeypatch.setattr("app.routers.ask.call_claude", mock)
    return mock


def test_ask_returns_grounded_answer_with_citations_for_strong_match(
    mock_call_claude: MagicMock,
) -> None:
    response = client.post(
        "/api/ask",
        json={"country": "BE", "question": "what format do I need in Belgium"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["refused"] is False
    assert body["answer"] == "Belgium requires Peppol BIS 3.0 for structured invoices."
    assert len(body["citations"]) >= 1
    assert all(url.startswith("https://") for url in body["citations"])

    mock_call_claude.assert_called_once()
    sent_messages = mock_call_claude.call_args.kwargs["messages"]
    prompt_text = sent_messages[0]["content"]
    assert "Required format and network" in prompt_text


def test_ask_refuses_for_country_not_in_knowledge_base(mock_call_claude: MagicMock) -> None:
    response = client.post(
        "/api/ask",
        json={"country": "DE", "question": "what format do I need"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["refused"] is True
    assert body["citations"] == []
    mock_call_claude.assert_not_called()


def test_ask_refuses_for_out_of_scope_question_in_valid_country(
    mock_call_claude: MagicMock,
) -> None:
    response = client.post(
        "/api/ask",
        json={"country": "BE", "question": "what's the best pizza topping"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["refused"] is True
    assert body["citations"] == []
    mock_call_claude.assert_not_called()
