import time

import anthropic
import structlog
from anthropic.types import MessageParam
from sqlalchemy.orm import Session

from app.config import Settings
from app.logging_setup import log_query

logger = structlog.get_logger()

_client = anthropic.Anthropic(api_key=Settings().anthropic_api_key)  # type: ignore[call-arg]


def call_claude(
    db: Session,
    endpoint: str,
    model: str,
    system: str,
    messages: list[MessageParam],
    max_tokens: int,
    retrieved_ids: list[int] | None = None,
    refused: bool = False,
) -> str:
    """Call Claude and log every call - tokens, latency, endpoint - per CLAUDE.md.

    max_tokens has no default on purpose: every caller must decide it
    explicitly, since the project's budget is a real constraint (see
    02-TECHNICAL-DESIGN.md #7).

    retrieved_ids lets the caller record which chunks or rules grounded
    this call. It is the caller's to supply because only the router knows
    what retrieval returned - but it is no longer optional in practice:
    an answer whose grounding was not recorded cannot be audited later.
    """
    start = time.monotonic()
    response = _client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system,
        messages=messages,
    )
    latency_ms = int((time.monotonic() - start) * 1000)

    text = "".join(block.text for block in response.content if block.type == "text")
    input_tokens = response.usage.input_tokens
    output_tokens = response.usage.output_tokens

    logger.info(
        "llm_call",
        endpoint=endpoint,
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        latency_ms=latency_ms,
    )

    log_query(
        db,
        endpoint=endpoint,
        request_payload={
            "model": model,
            "system": system,
            "messages": messages,
            "max_tokens": max_tokens,
        },
        retrieved_ids=retrieved_ids,
        response_text=text,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        latency_ms=latency_ms,
        refused=refused,
    )

    return text
