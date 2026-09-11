"""Seed the `rules` table for every supported country.

Why this is a separate script and not part of scripts/ingest.py: ingest.py
turns markdown prose into embedded `rule_chunks` for similarity search.
The `rules` table is the deterministic half of the product - the dates,
formats and networks that CLAUDE.md says the LLM must never decide.
Parsing those out of markdown prose with regexes would make the
compliance-critical values depend on sentence phrasing. They are written
here explicitly instead, each carrying the same source_url and
source_reviewed_at as the knowledge base section it came from.

Safe to re-run: existing rows for each country are deleted and reinserted.

Run scripts/ingest.py first - the countries rows it creates are this
table's foreign key.

NOTE on cohorts: app/rules_engine.py understands only two segments, 'all'
and 'turnover_above', and compares turnover against a single threshold
column with no currency conversion. That cannot express "Polish taxpayers
over PLN 200m" (the request carries EUR) or "French companies with 250+
employees". Rather than silently compare EUR against PLN, or mis-date an
obligation for a cohort it does not apply to, every rule below is seeded
as 'all' with the cohort named in rule_type. See the task report.
"""

from datetime import date

from sqlalchemy import delete

from app.db import SessionLocal
from app.models import Country, Rule

BE_SOURCE = (
    "https://finance.belgium.be/en/enterprises/vat/e-invoicing/"
    "mandatory-use-structured-electronic-invoices-2026"
)
BE_REVIEWED = date(2026, 9, 4)
BE_PENALTY = (
    "EUR 1,500 / 3,000 / 5,000 for a first / second / third infringement, "
    "escalating only if within three months of the previous one. No "
    "e-invoicing-specific penalties during the 1 January - 31 March 2026 "
    "tolerance period, if reasonable compliance effort can be shown."
)

PL_SOURCE = "https://ksef.podatki.gov.pl/"
PL_REVIEWED = date(2026, 9, 11)
PL_PENALTY = (
    "No penalties during 2026. From 1 January 2027: up to 100% of the VAT "
    "shown on an invoice issued outside KSeF, or up to 18.7% of the gross "
    "amount for an invoice showing no VAT."
)

FR_SOURCE = "https://entreprendre.service-public.gouv.fr/vosdroits/F23208"
FR_REVIEWED = date(2026, 9, 11)
FR_PENALTY = (
    "EUR 50 per invoice not issued electronically and EUR 500 per "
    "e-reporting breach, each capped at EUR 15,000 per calendar year "
    "(loi de finances 2026)."
)

RULES: list[dict] = [
    # --- Belgium: one date, no phase-in by size (knowledge_base/BE.md) ---
    {
        "country_code": "BE",
        "rule_type": "receive",
        "applies_from": date(2026, 1, 1),
        "applies_to_segment": "all",
        "format_required": "Peppol BIS Billing 3.0 (EN 16931)",
        "network": "Peppol",
        "penalty_summary": BE_PENALTY,
        "source_url": BE_SOURCE,
        "source_reviewed_at": BE_REVIEWED,
    },
    {
        "country_code": "BE",
        "rule_type": "issue",
        "applies_from": date(2026, 1, 1),
        "applies_to_segment": "all",
        "format_required": "Peppol BIS Billing 3.0 (EN 16931)",
        "network": "Peppol",
        "penalty_summary": BE_PENALTY,
        "source_url": BE_SOURCE,
        "source_reviewed_at": BE_REVIEWED,
    },
    # --- Poland: receiving is universal, issuing is phased ---
    {
        "country_code": "PL",
        "rule_type": "receive",
        "applies_from": date(2026, 2, 1),
        "applies_to_segment": "all",
        "format_required": "FA(3) structured XML",
        "network": "KSeF",
        "penalty_summary": PL_PENALTY,
        "source_url": PL_SOURCE,
        "source_reviewed_at": PL_REVIEWED,
    },
    {
        "country_code": "PL",
        "rule_type": "issue (large taxpayers: 2024 turnover over PLN 200 million)",
        "applies_from": date(2026, 2, 1),
        "applies_to_segment": "all",
        "format_required": "FA(3) structured XML",
        "network": "KSeF",
        "penalty_summary": PL_PENALTY,
        "source_url": PL_SOURCE,
        "source_reviewed_at": PL_REVIEWED,
    },
    {
        "country_code": "PL",
        "rule_type": "issue (all other VAT taxpayers, including sole traders and SMEs)",
        "applies_from": date(2026, 4, 1),
        "applies_to_segment": "all",
        "format_required": "FA(3) structured XML",
        "network": "KSeF",
        "penalty_summary": PL_PENALTY,
        "source_url": PL_SOURCE,
        "source_reviewed_at": PL_REVIEWED,
    },
    # --- France: receiving is universal, issuing is phased by company size ---
    {
        "country_code": "FR",
        "rule_type": "receive",
        "applies_from": date(2026, 9, 1),
        "applies_to_segment": "all",
        "format_required": "Factur-X, UBL 2.1 or CII (EN 16931)",
        "network": "Plateforme agreee (PA, formerly PDP)",
        "penalty_summary": FR_PENALTY,
        "source_url": FR_SOURCE,
        "source_reviewed_at": FR_REVIEWED,
    },
    {
        "country_code": "FR",
        "rule_type": "issue (large enterprises and ETI)",
        "applies_from": date(2026, 9, 1),
        "applies_to_segment": "all",
        "format_required": "Factur-X, UBL 2.1 or CII (EN 16931)",
        "network": "Plateforme agreee (PA, formerly PDP)",
        "penalty_summary": FR_PENALTY,
        "source_url": FR_SOURCE,
        "source_reviewed_at": FR_REVIEWED,
    },
    {
        "country_code": "FR",
        "rule_type": "issue (SMEs and micro-enterprises)",
        "applies_from": date(2027, 9, 1),
        "applies_to_segment": "all",
        "format_required": "Factur-X, UBL 2.1 or CII (EN 16931)",
        "network": "Plateforme agreee (PA, formerly PDP)",
        "penalty_summary": FR_PENALTY,
        "source_url": FR_SOURCE,
        "source_reviewed_at": FR_REVIEWED,
    },
]


def seed() -> int:
    country_codes = sorted({str(rule["country_code"]) for rule in RULES})

    db = SessionLocal()
    try:
        for code in country_codes:
            if db.get(Country, code) is None:
                raise SystemExit(
                    f"No countries row for {code!r}. Run `python scripts/ingest.py` "
                    "first - it creates the countries rows this table references."
                )

        # Full replace per run, so re-running never duplicates rows.
        db.execute(delete(Rule).where(Rule.country_code.in_(country_codes)))
        for rule in RULES:
            db.add(Rule(**rule))
        db.commit()
        return len(RULES)
    finally:
        db.close()


def main() -> None:
    count = seed()
    print(f"Seeded {count} rules across BE, PL, FR")


if __name__ == "__main__":
    main()
