"""Snapshot real API responses into frontend/src/demo/fixtures/.

Per docs/04-FRONTEND-DESIGN.md #6: demo-mode fixtures must not be
hand-written, or they silently drift from what the real API actually
returns. Uses TestClient against the real app - same in-process approach
as scripts/run_eval.py - so there's no separate server to start, but it's
still the real FastAPI app, the real database, and (for the cases that
reach it) the real Claude call, not a stub.

Costs real money: the three "in scope" assess profiles and the grounded
ask question each trigger one Claude call (assess also caches by profile
server-side, but a fixture snapshot always wants fresh prose, so this
doesn't try to dodge that cache). The not-in-scope and refused cases are
free - both endpoints refuse before ever calling the LLM.

Safe to re-run: each fixture file is fully overwritten, never appended.
"""

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

FRONTEND_FIXTURES_DIR = Path(__file__).resolve().parent.parent / "frontend/src/demo/fixtures"

# One representative in-scope profile per seeded country, plus one profile
# for a country with no rules at all (DE - genuinely not in the knowledge
# base, not just "below every threshold" - see scripts/seed_rules.py's note
# that every seeded rule is an 'all'-segment cohort, so there is currently
# no in-country threshold boundary to demonstrate instead).
ASSESS_CASES: dict[str, dict] = {
    "be-in-scope": {
        "country": "BE",
        "vat_registered": True,
        "employee_count": 5,
        "annual_turnover_eur": 250_000,
        "invoices_to": ["B2B"],
    },
    "fr-in-scope": {
        "country": "FR",
        "vat_registered": True,
        "employee_count": 5,
        "annual_turnover_eur": 250_000,
        "invoices_to": ["B2B", "B2C"],
    },
    "pl-in-scope": {
        "country": "PL",
        "vat_registered": True,
        "employee_count": 5,
        "annual_turnover_eur": 250_000,
        "invoices_to": ["B2B"],
    },
    "not-in-scope": {
        "country": "DE",
        "vat_registered": True,
        "employee_count": 5,
        "annual_turnover_eur": 250_000,
        "invoices_to": ["B2B"],
    },
}

ASK_CASES: dict[str, dict] = {
    "grounded": {
        "country": "BE",
        "question": "What invoice format do I need to use in Belgium?",
    },
    "refused": {
        "country": "DE",
        "question": "what format do I need",
    },
}


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")


def snapshot() -> None:
    client = TestClient(app)

    countries = client.get("/api/countries")
    countries.raise_for_status()
    _write(FRONTEND_FIXTURES_DIR / "countries.json", countries.json())
    print(f"countries.json - {len(countries.json())} countries")

    # Per-country rules, for the intake preview. Free to snapshot and free
    # to serve - no LLM anywhere on this path.
    for country in countries.json():
        code = country["code"]
        rules = client.get(f"/api/countries/{code}/rules")
        rules.raise_for_status()
        _write(FRONTEND_FIXTURES_DIR / "rules" / f"{code}.json", rules.json())
        print(f"rules/{code}.json - {len(rules.json())} rules")

    for name, request_body in ASSESS_CASES.items():
        response = client.post("/api/assess", json=request_body)
        response.raise_for_status()
        _write(
            FRONTEND_FIXTURES_DIR / "assess" / f"{name}.json",
            {"request": request_body, "response": response.json()},
        )
        print(f"assess/{name}.json - in_scope={response.json()['in_scope']}")

    for name, request_body in ASK_CASES.items():
        response = client.post("/api/ask", json=request_body)
        response.raise_for_status()
        _write(
            FRONTEND_FIXTURES_DIR / "ask" / f"{name}.json",
            {"request": request_body, "response": response.json()},
        )
        print(f"ask/{name}.json - refused={response.json()['refused']}")


if __name__ == "__main__":
    snapshot()
