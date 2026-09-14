from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.fixture
def mock_call_claude(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    mock = MagicMock(return_value="answer")
    monkeypatch.setattr("app.routers.ask.call_claude", mock)
    return mock


def test_eleventh_request_in_a_minute_is_rate_limited(mock_call_claude: MagicMock) -> None:
    # DE has no knowledge base, so every call refuses before touching
    # call_claude - cheapest possible way to exercise the limiter without
    # spending on the mocked LLM path or writing ten query_logs rows.
    payload = {"country": "DE", "question": "what format do I need"}

    for _ in range(10):
        response = client.post("/api/ask", json=payload)
        assert response.status_code == 200

    limited = client.post("/api/ask", json=payload)
    assert limited.status_code == 429


def test_cors_allows_configured_local_origin() -> None:
    response = client.options(
        "/api/countries",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_cors_rejects_unlisted_origin() -> None:
    response = client.options(
        "/api/countries",
        headers={
            "Origin": "http://evil.example.com",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert "access-control-allow-origin" not in response.headers
