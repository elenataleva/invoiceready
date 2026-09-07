from sqlalchemy import select
from sqlalchemy.orm import Session

from app.embeddings import embed
from app.models import RuleChunk

DEFAULT_TOP_K = 4

# Empirically checked against real ingested BE content (Task 8/9): unrelated
# questions topped out around 0.11 cosine similarity, genuinely related
# questions scored 0.35-0.47. 0.3 sits in that gap.
# TODO: tune against eval set in Task 12, once out-of-scope test questions
# for all three countries exist.
DEFAULT_SIMILARITY_THRESHOLD = 0.3


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
