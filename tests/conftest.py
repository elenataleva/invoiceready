import pytest
from sqlalchemy.orm import Session

from app.db import engine


@pytest.fixture
def db_session():
    """A DB session bound to a transaction that's rolled back after the test.

    Runs against the real (dev) Postgres database configured via
    DATABASE_URL - not sqlite - since app.models uses pgvector's Vector
    type, which sqlite can't represent. Rolling back the transaction
    means test-inserted rows never actually persist.
    """
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture(autouse=True)
def no_real_query_rewrite(monkeypatch: pytest.MonkeyPatch) -> None:
    """Stub out the /api/ask query rewriter for every test.

    rewrite_query() calls Haiku for real. It is reached through retrieval
    rather than through the `call_claude` name the endpoint tests already
    mock, so without this the suite quietly makes paid API calls and writes
    rows to the real database - it did exactly that once before this fixture
    existed. autouse so a future test cannot reintroduce the problem by
    forgetting to opt in.

    The stub is the identity function: tests then exercise retrieval against
    the question as written, which is what they asserted against before
    rewriting existed. scripts/run_eval.py is unaffected and still measures
    the real rewriter.
    """
    monkeypatch.setattr("app.routers.ask.rewrite_query", lambda db, country, question: question)
    monkeypatch.setattr("app.retrieval.rewrite_query", lambda db, country, question: question)
