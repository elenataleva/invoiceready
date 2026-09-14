from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Country
from app.schemas import CountryOut

router = APIRouter()

ENDPOINT = "/api/countries"


@router.get(ENDPOINT)
def list_countries(db: Session = Depends(get_db)) -> list[CountryOut]:
    """Coverage + last-reviewed date per country, so a client never hardcodes
    what the knowledge base actually contains (docs/04-FRONTEND-DESIGN.md #7.5).
    """
    countries = db.execute(select(Country).order_by(Country.name)).scalars().all()
    return [CountryOut.model_validate(country, from_attributes=True) for country in countries]
