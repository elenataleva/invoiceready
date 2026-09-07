from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.llm import call_claude
from app.retrieval import retrieve
from app.schemas import AskRequest, AskResponse

router = APIRouter()

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


@router.post("/api/ask")
def ask(request: AskRequest, db: Session = Depends(get_db)) -> AskResponse:
    chunks = retrieve(db, country=request.country, question=request.question)

    if not chunks:
        # No LLM call on refusal - both for cost, and to guarantee there is
        # no code path where an ungrounded answer could reach the user.
        return AskResponse(answer=REFUSAL_ANSWER, citations=[], refused=True)

    context = "\n\n".join(f"{chunk.content}\n(Source: {chunk.source_url})" for chunk in chunks)
    user_message = f"{context}\n\nQuestion: {request.question}"

    answer = call_claude(
        db,
        endpoint="/api/ask",
        model="claude-sonnet-5",
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
        max_tokens=ANSWER_MAX_TOKENS,
    )

    # Citations come from the retrieved chunks' own source_url column, not
    # parsed from the LLM's free text - the chunks are the source of truth.
    citations = sorted({chunk.source_url for chunk in chunks})

    return AskResponse(answer=answer, citations=citations, refused=False)
