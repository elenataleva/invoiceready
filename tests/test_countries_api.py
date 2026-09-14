from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

# Runs against the real countries seeded by ingest.py/seed_rules.py (BE, FR,
# PL) - same "test against real dev data" decision as test_retrieval.py.


def test_list_countries_returns_coverage_and_last_reviewed() -> None:
    response = client.get("/api/countries")

    assert response.status_code == 200
    body = response.json()
    assert len(body) >= 3

    codes = {country["code"] for country in body}
    assert {"BE", "FR", "PL"} <= codes

    for country in body:
        assert country["name"]
        assert country["status"]
        assert country["last_reviewed"]
