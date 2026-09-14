"""Structured logging: one JSON line per event on stdout, plus the single
owner of `query_logs` inserts.

Both halves live here because they are the same concern seen twice - what
happened, recorded somewhere a human can query later. stdout is captured by
the host (02-TECHNICAL-DESIGN.md #2); query_logs is the durable record used
to debug a bad answer after the fact.
"""

import sys

import structlog
from sqlalchemy.orm import Session

from app.models import QueryLog


def configure_logging() -> None:
    """Emit one JSON object per line on stdout. Called once at app startup.

    No log shipper or vendor at V1 scale - the host captures stdout and
    that is the whole pipeline.
    """
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )


def log_query(
    db: Session,
    *,
    endpoint: str,
    request_payload: dict,
    retrieved_ids: list[int] | None = None,
    response_text: str | None = None,
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    latency_ms: int | None = None,
    refused: bool = False,
) -> None:
    """Write one `query_logs` row.

    Every insert into that table goes through here, so a caller cannot
    quietly omit a column the way tasks 10/11/13 each omitted
    `retrieved_ids`.

    `retrieved_ids` defaults to `[]`, never NULL: "retrieval returned
    nothing" and "nobody recorded what retrieval returned" are different
    facts, and before this task every row asserted the second one.
    """
    db.add(
        QueryLog(
            endpoint=endpoint,
            request_payload=request_payload,
            retrieved_ids=[] if retrieved_ids is None else retrieved_ids,
            response_text=response_text,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency_ms,
            refused=refused,
        )
    )
    db.commit()
