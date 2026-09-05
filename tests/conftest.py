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
