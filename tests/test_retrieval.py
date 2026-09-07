from sqlalchemy.orm import Session

from app.retrieval import retrieve

# These tests run against the real BE data committed by `python
# scripts/ingest.py` (Task 8), not a synthetic seeded fixture: the whole
# point of this layer is "does real content score as expected against
# real embeddings," which a hand-rolled fixture would just reimplement
# less faithfully. This means `scripts/ingest.py` must have been run
# against the dev database at least once before these tests can pass.


def test_close_question_returns_relevant_chunk(db_session: Session) -> None:
    results = retrieve(
        db_session, country="BE", question="What invoice format do I need to use in Belgium?"
    )

    assert len(results) >= 1
    assert any("Required format and network" in chunk.content for chunk in results)


def test_unrelated_question_returns_no_chunks(db_session: Session) -> None:
    results = retrieve(db_session, country="BE", question="how do I bake bread")

    assert results == []


def test_country_with_no_ingested_data_returns_no_chunks(db_session: Session) -> None:
    """Proves the country filter runs before similarity search: even a
    BE-relevant question returns nothing when filtered to a country with
    zero ingested rule_chunks rows.
    """
    results = retrieve(
        db_session, country="PL", question="What invoice format do I need to use in Belgium?"
    )

    assert results == []
