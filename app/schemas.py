from datetime import date

from pydantic import BaseModel


class AskRequest(BaseModel):
    country: str
    question: str


class AskResponse(BaseModel):
    answer: str
    citations: list[str]
    refused: bool


class CountryOut(BaseModel):
    """What a frontend needs to render country choices without hardcoding coverage."""

    code: str
    name: str
    status: str
    last_reviewed: date


class RuleOut(BaseModel):
    """One `rules` row, verbatim, with no profile applied and no LLM involved.

    This is what a country looks like *before* anyone describes their
    business - the intake preview (docs/04-FRONTEND-DESIGN.md #3.2) shows
    it the moment a country is picked, which is why it must stay free to
    serve: no generation, no per-request cost.
    """

    rule_type: str
    applies_from: date
    format_required: str | None
    network: str | None
    penalty_summary: str | None
    source_url: str
    source_reviewed_at: date


class AssessRequest(BaseModel):
    country: str
    vat_registered: bool
    employee_count: int
    annual_turnover_eur: int | None = None
    invoices_to: list[str]


class Obligation(BaseModel):
    """One applicable rule, rendered for the API.

    Every field except `explanation` is copied verbatim from a `rules` row -
    the LLM never decides a date, threshold, format, or network (CLAUDE.md).
    """

    rule_type: str
    applies_from: date
    format_required: str | None
    network: str | None
    explanation: str
    source_url: str
    source_reviewed_at: date


class AssessResponse(BaseModel):
    in_scope: bool
    obligations: list[Obligation]
    next_steps: list[str]
    disclaimer: str
