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


def test_country_rules_returns_seeded_rules_verbatim() -> None:
    response = client.get("/api/countries/BE/rules")

    assert response.status_code == 200
    rules = response.json()
    assert len(rules) >= 2

    # Ordered by applies_from, so the earliest obligation leads - the
    # intake preview relies on that to show "what starts first".
    assert rules == sorted(rules, key=lambda rule: rule["applies_from"])

    for rule in rules:
        assert rule["rule_type"]
        assert rule["applies_from"]
        assert rule["source_url"].startswith("https://")
        assert rule["source_reviewed_at"]


def test_country_rules_is_case_insensitive() -> None:
    assert (
        client.get("/api/countries/be/rules").json() == client.get("/api/countries/BE/rules").json()
    )


def test_country_rules_404s_for_a_country_not_in_the_knowledge_base() -> None:
    response = client.get("/api/countries/DE/rules")

    assert response.status_code == 404
    assert "DE" in response.json()["detail"]
