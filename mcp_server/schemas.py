from datetime import date

from pydantic import BaseModel

# Kept identical to app.routers.assess.DISCLAIMER by a test, rather than
# imported from it: importing a router would make the MCP server depend on
# the HTTP layer, and the two front doors are meant to be siblings over one
# engine (docs/04-MCP-IMPLEMENTATION-PLAN.md #2).
DISCLAIMER = "Informational guidance only, not tax or legal advice."


class Obligation(BaseModel):
    """One applicable rule, copied verbatim from a `rules` row.

    Deliberately has no `explanation` field, unlike app.schemas.Obligation:
    the REST API spends an LLM call turning a rule into prose because a
    browser cannot, whereas an MCP client already has a model of its own on
    the other side of the call. This server ships facts and sources only.
    """

    rule_type: str
    applies_from: date
    format_required: str | None
    network: str | None
    source_url: str
    source_reviewed_at: date


class RuleLookupResult(BaseModel):
    """E-invoicing obligations for one business profile, with their sources.

    `covered` and `in_scope` mean different things and must not be conflated:
    `covered` is whether this country exists in the knowledge base at all,
    `in_scope` is whether any obligation applies to this particular business.
    An uncovered country is an admission of ignorance; a covered country with
    no obligations is a finding.
    """

    country: str
    covered: bool
    in_scope: bool
    obligations: list[Obligation]
    covered_countries: list[str]
    notice: str
    disclaimer: str


class CountryCoverage(BaseModel):
    """What this server knows about one country, and how stale it is.

    `status` and `last_reviewed` are reported rather than acted on: a row
    that exists is covered, and how much to trust it on a given date is the
    caller's judgement to make, not this server's to make silently.
    """

    code: str
    name: str
    status: str
    last_reviewed: date


class CoverageResult(BaseModel):
    """Which countries this server can answer for.

    `countries` is always the complete covered set, whether or not a
    specific country was asked about, so that a "no" is never delivered
    without the alternatives alongside it. `requested_country` and `covered`
    are null when no particular country was asked about.
    """

    requested_country: str | None
    covered: bool | None
    countries: list[CountryCoverage]
    notice: str
