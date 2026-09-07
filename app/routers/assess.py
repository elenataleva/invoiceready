import hashlib
import json

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.llm import call_claude
from app.models import QueryLog, Rule
from app.rules_engine import get_applicable_rules
from app.schemas import AssessRequest, AssessResponse, Obligation

logger = structlog.get_logger()

router = APIRouter()

ENDPOINT = "/api/assess"

# Cache rows live in query_logs alongside the LLM call logs written by
# app/llm.py, so they need their own endpoint marker to be distinguishable
# (both for lookup here and for Task 18's logging audit).
CACHE_ENDPOINT = "/api/assess:cache"

# The LLM writes prose only. Every date, threshold, format and network in
# the response comes from the rules table (CLAUDE.md, non-negotiable).
SYSTEM_PROMPT = (
    "You explain EU e-invoicing compliance obligations in plain language to "
    "a small business owner with no finance team. You are given the exact "
    "obligations that already apply to them, determined by deterministic "
    "code - treat them as established fact.\n\n"
    "Never state a date, threshold, format, or network that is not present "
    "in the provided obligations. Never add obligations. Never give legal "
    "or tax advice.\n\n"
    "Respond with ONLY a JSON object and no markdown fences, shaped:\n"
    '{"explanations": ["one short paragraph per obligation, same order as '
    'given"], "next_steps": ["three short, concrete steps"]}'
)

DISCLAIMER = "Informational guidance only, not tax or legal advice."

EXPLANATION_MAX_TOKENS = 1024


def _profile_hash(request: AssessRequest, rules: list[Rule]) -> str:
    """Cache key: the request profile plus which rules matched it.

    The plan suggested hashing the request alone. Matched rule ids are
    folded in as well so that editing the rules table (adding a rule, or a
    profile newly crossing a threshold) can't serve prose generated for a
    different set of obligations. It does not catch an edit *within* a rule
    that keeps the same id - see the report for that caveat.
    """
    payload = {
        "profile": request.model_dump(mode="json"),
        "rule_ids": sorted(rule.id for rule in rules),
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def _cached_generation(db: Session, profile_hash: str) -> dict | None:
    row = db.execute(
        select(QueryLog)
        .where(QueryLog.endpoint == CACHE_ENDPOINT)
        .where(QueryLog.request_payload["profile_hash"].astext == profile_hash)
        .order_by(QueryLog.id.desc())
        .limit(1)
    ).scalar_one_or_none()

    if row is None or row.response_text is None:
        return None

    try:
        return json.loads(row.response_text)
    except json.JSONDecodeError:
        return None


def _strip_code_fence(raw: str) -> str:
    """Unwrap ```json ... ``` if the model fenced its reply.

    Observed for real against claude-sonnet-5 even though SYSTEM_PROMPT
    forbids fences - the prompt is a request, not a guarantee, so parsing
    has to tolerate it.
    """
    text = raw.strip()
    if not text.startswith("```"):
        return text

    text = text.split("\n", 1)[1] if "\n" in text else ""
    return text.rstrip().removesuffix("```").strip()


def _generate(db: Session, request: AssessRequest, rules: list[Rule]) -> dict:
    """One LLM call producing explanations + next steps, grounded in `rules`."""
    grounding = [
        {
            "rule_type": rule.rule_type,
            "applies_from": rule.applies_from.isoformat(),
            "format_required": rule.format_required,
            "network": rule.network,
            "penalty_summary": rule.penalty_summary,
            "source_url": rule.source_url,
        }
        for rule in rules
    ]
    user_message = (
        f"Business profile:\n{json.dumps(request.model_dump(mode='json'), indent=2)}\n\n"
        f"Obligations that apply to them:\n{json.dumps(grounding, indent=2)}"
    )

    raw = call_claude(
        db,
        endpoint=ENDPOINT,
        model="claude-sonnet-5",
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
        max_tokens=EXPLANATION_MAX_TOKENS,
    )

    try:
        return json.loads(_strip_code_fence(raw))
    except json.JSONDecodeError:
        # Degrade to facts-only rather than failing the request or inventing
        # prose: the obligations themselves are the compliance-critical part.
        logger.warning("assess_generation_unparseable", endpoint=ENDPOINT, raw=raw[:200])
        return {"explanations": [], "next_steps": []}


@router.post(ENDPOINT)
def assess(request: AssessRequest, db: Session = Depends(get_db)) -> AssessResponse:
    rules = get_applicable_rules(
        db,
        country=request.country,
        employee_count=request.employee_count,
        annual_turnover_eur=request.annual_turnover_eur,
        invoices_to=request.invoices_to,
    )

    if not rules:
        # Nothing applies - no prose to generate, so no LLM call at all.
        return AssessResponse(in_scope=False, obligations=[], next_steps=[], disclaimer=DISCLAIMER)

    profile_hash = _profile_hash(request, rules)
    generated = _cached_generation(db, profile_hash)

    if generated is None:
        generated = _generate(db, request, rules)
        db.add(
            QueryLog(
                endpoint=CACHE_ENDPOINT,
                request_payload={
                    "profile_hash": profile_hash,
                    "profile": request.model_dump(mode="json"),
                },
                response_text=json.dumps(generated),
            )
        )
        db.commit()

    explanations = generated.get("explanations", [])
    obligations = [
        Obligation(
            rule_type=rule.rule_type,
            applies_from=rule.applies_from,
            format_required=rule.format_required,
            network=rule.network,
            explanation=explanations[i] if i < len(explanations) else "",
            source_url=rule.source_url,
            source_reviewed_at=rule.source_reviewed_at,
        )
        for i, rule in enumerate(rules)
    ]

    return AssessResponse(
        in_scope=True,
        obligations=obligations,
        next_steps=generated.get("next_steps", []),
        disclaimer=DISCLAIMER,
    )
