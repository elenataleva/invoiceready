import math

import pytest

from app.embeddings import embed, embed_batch


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot_product = sum(x * y for x, y in zip(a, b, strict=True))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    return dot_product / (norm_a * norm_b)


def test_embed_returns_384_floats() -> None:
    vector = embed("test")

    assert len(vector) == 384
    assert all(isinstance(x, float) for x in vector)


def test_embed_is_consistent_for_same_text() -> None:
    first = embed("Belgium mandatory e-invoicing")
    second = embed("Belgium mandatory e-invoicing")

    assert _cosine_similarity(first, second) == pytest.approx(1.0, abs=1e-6)


def test_near_duplicate_text_is_more_similar_than_unrelated_text() -> None:
    base = embed("Belgian businesses must issue structured e-invoices from 2026.")
    near_duplicate = embed(
        "Belgian companies must issue structured electronic invoices starting 2026."
    )
    unrelated = embed("The recipe calls for two cups of flour and a pinch of salt.")

    similarity_near = _cosine_similarity(base, near_duplicate)
    similarity_unrelated = _cosine_similarity(base, unrelated)

    assert similarity_near > similarity_unrelated


def test_embed_batch_matches_individual_embeddings() -> None:
    texts = ["Belgium", "Poland"]

    batch_result = embed_batch(texts)

    assert len(batch_result) == 2
    assert len(batch_result[0]) == 384
    assert len(batch_result[1]) == 384
    assert _cosine_similarity(batch_result[0], embed("Belgium")) == pytest.approx(1.0, abs=1e-6)
