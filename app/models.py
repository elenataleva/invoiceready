from datetime import date, datetime
from decimal import Decimal

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    CHAR,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Country(Base):
    __tablename__ = "countries"

    code: Mapped[str] = mapped_column(CHAR(2), primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    last_reviewed: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)


class Rule(Base):
    __tablename__ = "rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    country_code: Mapped[str | None] = mapped_column(CHAR(2), ForeignKey("countries.code"))
    rule_type: Mapped[str] = mapped_column(Text, nullable=False)
    applies_from: Mapped[date] = mapped_column(Date, nullable=False)
    applies_to_segment: Mapped[str] = mapped_column(Text, nullable=False)
    threshold_amount: Mapped[Decimal | None] = mapped_column(Numeric)
    threshold_currency: Mapped[str | None] = mapped_column(CHAR(3))
    format_required: Mapped[str | None] = mapped_column(Text)
    network: Mapped[str | None] = mapped_column(Text)
    penalty_summary: Mapped[str | None] = mapped_column(Text)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    source_reviewed_at: Mapped[date] = mapped_column(Date, nullable=False)


class RuleChunk(Base):
    __tablename__ = "rule_chunks"

    id: Mapped[int] = mapped_column(primary_key=True)
    country_code: Mapped[str | None] = mapped_column(CHAR(2), ForeignKey("countries.code"))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(384))


class QueryLog(Base):
    __tablename__ = "query_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    endpoint: Mapped[str | None] = mapped_column(Text)
    request_payload: Mapped[dict | None] = mapped_column(JSONB)
    retrieved_ids: Mapped[list[int] | None] = mapped_column(ARRAY(Integer))
    response_text: Mapped[str | None] = mapped_column(Text)
    input_tokens: Mapped[int | None] = mapped_column(Integer)
    output_tokens: Mapped[int | None] = mapped_column(Integer)
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    refused: Mapped[bool | None] = mapped_column(Boolean, server_default=text("false"))
