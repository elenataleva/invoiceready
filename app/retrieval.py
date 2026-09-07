from sqlalchemy import select
from sqlalchemy.orm import Session

from app.embeddings import embed
from app.models import RuleChunk

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
