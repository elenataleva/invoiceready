import structlog
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.embeddings import embed
from app.llm import call_claude
from app.models import Country, RuleChunk

logger = structlog.get_logger()

DEFAULT_TOP_K = 4

# Tuned against tests/eval_set.yaml (Task 12): the 26-case grounded eval
# set's lowest max-similarity was 0.59; the eval's refusal cases topped out
# at 0.43 (a tangentially-worded but out-of-scope question shared enough
# BE-related vocabulary to score higher than the earlier 0.11-0.47 probe
# set from Task 9 suggested). 0.3 let that case through as a false
# grounded answer - see scripts/run_eval.py. 0.5 sits in the middle of the
# real 0.43/0.59 gap, with margin on both sides.
DEFAULT_SIMILARITY_THRESHOLD = 0.5


def retrieve(
    db: Session,
    country: str,
    question: str,
    top_k: int = DEFAULT_TOP_K,
    threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
) -> list[RuleChunk]:
    """Structured filter first, semantic search second (see design doc #1).

    1. Filter rule_chunks by country_code - cheap, exact, runs in SQL.
    2. Embed the question locally.
    3. Within that filtered set, take the top_k closest by cosine distance.
    4. Discard any of those top_k below the similarity threshold.

    Returns an empty list if nothing survives - the caller (Task 11) turns
    that into a refusal rather than falling back to unsourced knowledge.
    """
    query_embedding = embed(question)
    distance = RuleChunk.embedding.cosine_distance(query_embedding)

    stmt = (
        select(RuleChunk, distance.label("distance"))
        .where(RuleChunk.country_code == country)
        .order_by(distance)
        .limit(top_k)
    )

    results = db.execute(stmt).all()

    chunks = []
    for chunk, dist in results:
        similarity = 1 - dist
        if similarity >= threshold:
            chunks.append(chunk)

    return chunks


# --- Query rewriting -------------------------------------------------------

REWRITE_ENDPOINT = "/api/ask:rewrite"

# Haiku, not Sonnet: this is a one-line reformulation, and it runs on every
# question including ones we go on to refuse.
REWRITE_MODEL = "claude-haiku-4-5-20251001"
REWRITE_MAX_TOKENS = 100

# The pass-through instruction is the whole safety property. Measured: adding
# country context to *every* question indiscriminately lifted "How do I bake
# sourdough bread?" from 0.060 to 0.553 - over the threshold. Rewriting only
# helps questions that were already on-topic, so junk keeps scoring as junk.
REWRITE_SYSTEM_PROMPT = (
    "Rewrite the user's question as a single formal search query about "
    "e-invoicing compliance in the named country. Preserve the user's actual "
    "meaning exactly - if the question is not about e-invoicing, invoicing, "
    "tax or business compliance, repeat it back unchanged rather than "
    "inventing a compliance topic. Reply with the rewritten query only."
)


def rewrite_query(db: Session, country: str, question: str) -> str:
    """Reformulate a casually-worded question into one the embeddings can match.

    Real users type "when do i have to start?", which shares almost no
    vocabulary with a compliance document and scored 0.098 against a 0.5
    threshold - a refusal on a question we can answer well. Rewritten, the
    same question scores 0.672.

    Never raises: a failed rewrite falls back to the original question, so
    the worst case is the retrieval quality we had before this existed.
    """
    country_row = db.get(Country, country)
    country_name = country_row.name if country_row else country

    try:
        rewritten = call_claude(
            db,
            endpoint=REWRITE_ENDPOINT,
            model=REWRITE_MODEL,
            system=REWRITE_SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": f"Country: {country_name}\nQuestion: {question}"}
            ],
            max_tokens=REWRITE_MAX_TOKENS,
            retrieved_ids=[],
        ).strip()
    except Exception as exc:  # noqa: BLE001 - degrade, never fail the request
        logger.warning("query_rewrite_failed", error=str(exc), country=country)
        return question

    if not rewritten:
        return question

    logger.info("query_rewritten", country=country, original=question, rewritten=rewritten)
    return rewritten
