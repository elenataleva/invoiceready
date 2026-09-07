from datetime import date

from pydantic import BaseModel


class AskRequest(BaseModel):
    country: str
    question: str


class AskResponse(BaseModel):
    answer: str
    citations: list[str]
    refused: bool


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
