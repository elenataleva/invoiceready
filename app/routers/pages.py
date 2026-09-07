from pathlib import Path

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Country
from app.routers.assess import DISCLAIMER as API_DISCLAIMER
from app.routers.assess import assess
from app.schemas import AssessRequest

router = APIRouter()

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

# 01-BUSINESS-PLAN.md section 5 requires a prominent disclaimer on every page,
# including the "verify with a qualified advisor" clause that the JSON API's
# shorter version omits. Built from the API constant so the two cannot drift.
DISCLAIMER = f"{API_DISCLAIMER} Verify with a qualified advisor before acting."
templates.env.globals["disclaimer"] = DISCLAIMER

COUNTERPARTY_OPTIONS = ["B2B", "B2C", "B2G"]


def _parse_optional_int(raw: str) -> int | None:
    """An untouched number input posts an empty string, which is not `None` to FastAPI."""
    raw = raw.strip()
    return int(raw) if raw else None


@router.get("/", response_class=HTMLResponse)
def intake(request: Request, db: Session = Depends(get_db)) -> HTMLResponse:
    countries = db.execute(select(Country).order_by(Country.name)).scalars().all()
    return templates.TemplateResponse(
        request,
        "intake.html",
        {"countries": countries, "counterparty_options": COUNTERPARTY_OPTIONS},
    )


@router.post("/assess", response_class=HTMLResponse)
def submit_intake(
    request: Request,
    country: str = Form(...),
    vat_registered: bool = Form(...),
    employee_count: int = Form(...),
    annual_turnover_eur: str = Form(""),
    invoices_to: list[str] = Form([]),
    db: Session = Depends(get_db),
) -> HTMLResponse:
    profile = AssessRequest(
        country=country,
        vat_registered=vat_registered,
        employee_count=employee_count,
        annual_turnover_eur=_parse_optional_int(annual_turnover_eur),
        invoices_to=invoices_to,
    )
    # Calls the Task 13 endpoint function directly rather than over HTTP: same
    # logic, same caching, no second connection to our own server.
    result = assess(profile, db)
    return templates.TemplateResponse(
        request, "result.html", {"profile": profile, "result": result}
    )
