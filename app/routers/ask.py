from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.llm import call_claude
from app.logging_setup import log_query
from app.rate_limit import ASK_ASSESS_RATE_LIMIT, limiter
from app.retrieval import retrieve, rewrite_query
from app.schemas import AskRequest, AskResponse

router = APIRouter()

ENDPOINT = "/api/ask"

# Per docs/02-TECHNICAL-DESIGN.md #7's prompt structure for grounded answers.
SYSTEM_PROMPT = (
    "You answer EU e-invoicing compliance questions using ONLY the provided "
    "context. If the context does not contain the answer, say so and point "
    "to the official source. Never state a date, threshold, or format not "
    "present in the context. Cite the source URL for every factual claim."
)

# No chunks survived retrieval - genuinely nothing to point to (we don't
# have a structured "official portal per country" field to fall back on
# outside retrieved content), so this stays generic rather than guessing.
REFUSAL_ANSWER = (
    "I don't have grounded information to answer this question. Please "
    "check the official source for your country's e-invoicing rules."
)

ANSWER_MAX_TOKENS = 1024


@router.post(ENDPOINT)
@limiter.limit(ASK_ASSESS_RATE_LIMIT)
def ask(request: Request, body: AskRequest, db: Session = Depends(get_db)) -> AskResponse:
    # Rewritten before embedding: a casually-typed question shares little
    # vocabulary with a compliance document ("when do i have to start?"
    # scored 0.098 against a 0.5 threshold; rewritten it scores 0.672).
    # The rewrite is used for retrieval only - the user's own words are what
    # we log and what the answering model is asked to address.
    search_query = rewrite_query(db, country=body.country, question=body.question)
    chunks = retrieve(db, country=body.country, question=search_query)
    retrieved_ids = [chunk.id for chunk in chunks]

    if not chunks:
        # No LLM call on refusal - both for cost, and to guarantee there is
        # no code path where an ungrounded answer could reach the user.
        # Still logged: a refusal is the outcome most worth auditing, and
        # before Task 18 this path left no trace at all.
        log_query(
            db,
            endpoint=ENDPOINT,
            request_payload={**body.model_dump(mode="json"), "search_query": search_query},
            retrieved_ids=[],
            response_text=REFUSAL_ANSWER,
            refused=True,
        )
        return AskResponse(answer=REFUSAL_ANSWER, citations=[], refused=True)

    context = "\n\n".join(f"{chunk.content}\n(Source: {chunk.source_url})" for chunk in chunks)
    user_message = f"{context}\n\nQuestion: {body.question}"

    answer = call_claude(
        db,
        endpoint=ENDPOINT,
        model="claude-sonnet-5",
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
        max_tokens=ANSWER_MAX_TOKENS,
        retrieved_ids=retrieved_ids,
        refused=False,
    )

    # Citations come from the retrieved chunks' own source_url column, not
    # parsed from the LLM's free text - the chunks are the source of truth.
    citations = sorted({chunk.source_url for chunk in chunks})

    return AskResponse(answer=answer, citations=citations, refused=False)
