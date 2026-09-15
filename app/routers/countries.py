from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Country, Rule
from app.schemas import CountryOut, RuleOut

router = APIRouter()

ENDPOINT = "/api/countries"
RULES_ENDPOINT = "/api/countries/{code}/rules"


@router.get(ENDPOINT)
def list_countries(db: Session = Depends(get_db)) -> list[CountryOut]:
    """Coverage + last-reviewed date per country, so a client never hardcodes
    what the knowledge base actually contains (docs/04-FRONTEND-DESIGN.md #7.5).
    """
    countries = db.execute(select(Country).order_by(Country.name)).scalars().all()
    return [CountryOut.model_validate(country, from_attributes=True) for country in countries]


@router.get(RULES_ENDPOINT)
def country_rules(code: str, db: Session = Depends(get_db)) -> list[RuleOut]:
    """Every rule for one country, unfiltered by any business profile.

    Deliberately not rate-limited alongside /api/ask and /api/assess: this
    is a plain SELECT with no LLM call behind it, so it costs nothing to
    serve and the intake preview can fire it on every country click.
    """
    code = code.upper()
    if db.get(Country, code) is None:
        raise HTTPException(status_code=404, detail=f"No country {code!r} in the knowledge base")

    rules = (
        db.execute(
            select(Rule)
            .where(Rule.country_code == code)
            .order_by(Rule.applies_from, Rule.rule_type)
        )
        .scalars()
        .all()
    )
    return [RuleOut.model_validate(rule, from_attributes=True) for rule in rules]
