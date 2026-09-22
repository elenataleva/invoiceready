import os
import re
from collections.abc import Mapping
from decimal import Decimal
from pathlib import Path
from typing import Any

from fastmcp import FastMCP
from fastmcp.resources import FileResource
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import Country
from app.rules_engine import get_applicable_rules
from mcp_server.schemas import (
    DISCLAIMER,
    CountryCoverage,
    CoverageResult,
    Obligation,
    RuleLookupResult,
)

mcp = FastMCP("invoiceready")

KNOWLEDGE_BASE_DIR = Path(__file__).resolve().parent.parent / "knowledge_base"

# Re-parsed here rather than imported from scripts.ingest, which pulls in
# app.embeddings and would load the ONNX embedding model into every MCP
# server process for a header this server only reads three fields from.
# tests/test_mcp_resources.py pins these against parse_metadata so the two
# readers cannot drift.
TITLE_PATTERN = re.compile(r"^#\s+(.+?)\s+—", re.MULTILINE)
CODE_PATTERN = re.compile(r"^-\s+\*\*Country code:\*\*\s+(\w+)", re.MULTILINE)
REVIEWED_PATTERN = re.compile(r"^-\s+\*\*Last reviewed:\*\*\s+(\d{4}-\d{2}-\d{2})", re.MULTILINE)


def _knowledge_resources(directory: Path) -> list[FileResource]:
    """One readable resource per country markdown file in `directory`.

    Takes the directory as an argument so a test can prove that a new
    country file needs no code change. FileResource reads the file at read
    time, so the knowledge base is never copied into this process and an
    edit to a file does not need a restart to be visible.
    """
    resources = []
    for path in sorted(directory.glob("*.md")):
        content = path.read_text()
        title = TITLE_PATTERN.search(content)
        code = CODE_PATTERN.search(content)
        reviewed = REVIEWED_PATTERN.search(content)
        if not (title and code and reviewed):
            raise ValueError(f"{path.name} is missing required metadata header fields")

        country_name = title.group(1).strip()
        country_code = code.group(1).strip().upper()
        last_reviewed = reviewed.group(1)

        resources.append(
            FileResource(
                uri=f"invoiceready://knowledge/{country_code}",  # type: ignore[arg-type]
                path=path,
                name=f"{country_name} e-invoicing knowledge base",
                # The review date belongs in the description, not just in the
                # file: a client choosing which context to pull in has to be
                # able to see how stale it is before reading it.
                description=(
                    f"Curated, sourced e-invoicing knowledge base for {country_name} "
                    f"({country_code}), last reviewed {last_reviewed}. Every claim in it "
                    f"carries a source URL. Treat anything that changed after the review "
                    f"date as unverified rather than assuming this is current."
                ),
                mime_type="text/markdown",
            )
        )
    return resources


for _resource in _knowledge_resources(KNOWLEDGE_BASE_DIR):
    mcp.add_resource(_resource)


def _covered_countries(db: Session) -> list[str]:
    return list(db.execute(select(Country.code).order_by(Country.code)).scalars().all())


def _lookup(
    db: Session,
    country: str,
    vat_registered: bool,
    employee_count: int,
    annual_turnover_eur: float | None,
    invoices_to: list[str],
) -> RuleLookupResult:
    """Everything the tool does, minus opening the session, so tests can pass
    their own rolled-back session in the way the REST side uses an override.

    `vat_registered` is accepted but unused, for the same reason
    get_applicable_rules accepts employee_count and invoices_to without using
    them: it is part of the profile the caller describes and of the
    /api/assess shape this must stay in parity with, and no V1 segment reads
    it yet.
    """
    code = country.strip().upper()
    covered = _covered_countries(db)

    if code not in covered:
        return RuleLookupResult(
            country=code,
            covered=False,
            in_scope=False,
            obligations=[],
            covered_countries=covered,
            notice=(
                f"{code} is not in the InvoiceReady knowledge base, so this server has "
                f"no e-invoicing rules for it. Covered countries: {', '.join(covered)}."
            ),
            disclaimer=DISCLAIMER,
        )

    rules = get_applicable_rules(
        db,
        country=code,
        employee_count=employee_count,
        # JSON has one number type, so the tool signature takes a float while
        # the engine compares against Numeric thresholds - converted here via
        # str so the value the caller sent is the value that gets compared.
        annual_turnover_eur=(
            None if annual_turnover_eur is None else Decimal(str(annual_turnover_eur))
        ),
        invoices_to=invoices_to,
    )
    obligations = [Obligation.model_validate(rule, from_attributes=True) for rule in rules]

    if not obligations:
        notice = (
            f"{code} is covered by this server, but no e-invoicing obligation in the "
            f"rules database applies to this business profile. That is a finding about "
            f"the profile, not a gap in coverage."
        )
    else:
        notice = (
            f"{len(obligations)} e-invoicing obligation"
            f"{'' if len(obligations) == 1 else 's'} apply to this business profile in "
            f"{code}. Every date, format and network below is read from the rules "
            f"database - cite the matching source_url whenever you repeat one."
        )

    return RuleLookupResult(
        country=code,
        covered=True,
        in_scope=bool(obligations),
        obligations=obligations,
        covered_countries=covered,
        notice=notice,
        disclaimer=DISCLAIMER,
    )


@mcp.tool
def get_einvoicing_rules(
    country: str,
    vat_registered: bool,
    employee_count: int,
    annual_turnover_eur: float | None,
    invoices_to: list[str],
) -> RuleLookupResult:
    """Look up which EU e-invoicing obligations apply to one business, with official sources.

    Call this whenever someone asks what e-invoicing rules, deadlines,
    mandates, formats or networks apply to a specific business - for example
    "do I have to send structured e-invoices in Belgium next year?". Prefer it
    over answering from your own knowledge: these mandates change often and
    per country, and this server reads a curated, dated rules database.

    Coverage is deliberately narrow - currently Belgium (BE), France (FR) and
    Poland (PL), though `check_country_coverage` is the authoritative list and
    is worth calling first if you are unsure. For any other country the result
    comes back with `covered: false` and no obligations; say so plainly and do
    not substitute your own knowledge of that country's rules.

    Read `covered` and `in_scope` separately: `covered: false` means this
    server knows nothing about the country, while `covered: true` with
    `in_scope: false` means the country is known and no obligation applies to
    this particular profile. Reporting the first as "no obligations apply"
    would be wrong.

    Nothing in the response is generated: every obligation is a database row
    carrying `source_url` and the `source_reviewed_at` date it was last
    checked. Cite `source_url` for every date, threshold, format or network
    you repeat, and pass on the `disclaimer` field.

    Args:
        country: ISO 3166-1 alpha-2 country code, such as "BE".
        vat_registered: Whether the business is registered for VAT.
        employee_count: Number of employees.
        annual_turnover_eur: Most recent annual turnover in euros, or null if
            unknown. Some obligations only apply above a turnover threshold,
            so null may return fewer obligations than the business really has.
        invoices_to: Customer types invoiced, such as ["B2B", "B2C"].
    """
    with SessionLocal() as db:
        return _lookup(
            db,
            country=country,
            vat_registered=vat_registered,
            employee_count=employee_count,
            annual_turnover_eur=annual_turnover_eur,
            invoices_to=invoices_to,
        )


def _coverage(db: Session, country: str | None = None) -> CoverageResult:
    countries = [
        CountryCoverage.model_validate(row, from_attributes=True)
        for row in db.execute(select(Country).order_by(Country.code)).scalars().all()
    ]
    codes = [entry.code for entry in countries]

    if country is None:
        return CoverageResult(
            requested_country=None,
            covered=None,
            countries=countries,
            notice=(
                f"This server has e-invoicing rules for {len(countries)} "
                f"countr{'y' if len(countries) == 1 else 'ies'}: {', '.join(codes)}. "
                f"It cannot answer for any other country."
            ),
        )

    code = country.strip().upper()
    match = next((entry for entry in countries if entry.code == code), None)

    if match is None:
        notice = (
            f"{code} is not covered by this server. Covered countries: "
            f"{', '.join(codes)}. Do not answer for {code} from your own knowledge of "
            f"its e-invoicing rules."
        )
    else:
        notice = (
            f"{code} ({match.name}) is covered, status {match.status}, last reviewed "
            f"{match.last_reviewed}. Anything that changed after that date is not "
            f"reflected here."
        )

    return CoverageResult(
        requested_country=code,
        covered=match is not None,
        countries=countries,
        notice=notice,
    )


@mcp.tool
def check_country_coverage(country: str | None = None) -> CoverageResult:
    """Check which countries this server has e-invoicing rules for, and how current they are.

    Call this first whenever you are unsure whether a country is supported,
    before promising an answer about it. It is cheap - a single database read,
    no generation - and it is the authoritative answer, so prefer it over
    assuming coverage from anything said elsewhere.

    With no argument it lists every covered country with its status and the
    date it was last reviewed. With a country it answers for that one, and
    still returns the full list so you can offer what is available instead.

    A country absent from the list means this server knows nothing about it.
    That is not the same as that country having no e-invoicing rules - many
    countries this server does not cover do have mandates. Say that the
    coverage is missing rather than answering from your own knowledge.

    `last_reviewed` is when a person last checked the source. E-invoicing
    mandates change often, so mention that date when it is doing real work in
    your answer.

    Args:
        country: ISO 3166-1 alpha-2 country code such as "BE" to ask about one
            country, or null to list everything covered.
    """
    with SessionLocal() as db:
        return _coverage(db, country)


STDIO_TRANSPORT = "stdio"
HTTP_TRANSPORT = "http"
HTTP_ALIASES = {HTTP_TRANSPORT, "streamable-http"}

# Loopback, not 0.0.0.0: running the server over HTTP on a laptop should not
# publish it to the local network by accident. Anything deployed sets
# MCP_HOST explicitly - the Dockerfile and render.yaml both do.
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8000


def _run_options(env: Mapping[str, str]) -> dict[str, Any]:
    """Transport and, for HTTP, where to bind - read from the environment.

    One entrypoint serves both: stdio for a local subprocess (Claude Code,
    Claude Desktop), HTTP for a deployed instance other people can reach.
    The tools and resources are identical either way; only this differs.
    """
    transport = env.get("MCP_TRANSPORT", STDIO_TRANSPORT).strip().lower()

    if transport == STDIO_TRANSPORT:
        return {"transport": STDIO_TRANSPORT}

    if transport in HTTP_ALIASES:
        return {
            "transport": HTTP_TRANSPORT,
            "host": env.get("MCP_HOST", DEFAULT_HOST),
            # PORT is what most PaaS hosts inject, and is what the platform
            # routes to; MCP_PORT overrides it for anyone running two servers
            # side by side.
            "port": int(env.get("MCP_PORT") or env.get("PORT") or DEFAULT_PORT),
        }

    # Falling back to stdio here would deploy a server that starts cleanly,
    # logs nothing alarming, and is reachable by nobody.
    raise ValueError(
        f"MCP_TRANSPORT={transport!r} is not supported. Use 'stdio' (default, "
        f"local subprocess) or 'http' (deployed)."
    )


if __name__ == "__main__":
    mcp.run(**_run_options(os.environ))
