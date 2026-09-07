from datetime import date

from scripts.ingest import (
    chunk_section,
    extract_source_url,
    parse_metadata,
    split_into_sections,
    strip_sources_block,
)

SAMPLE_DOC = """# Testland — E-Invoicing Compliance

- **Country code:** TL
- **Status:** live
- **Last reviewed:** 2026-01-15

Intro paragraph, not part of any section.

## Who is in scope

Everyone registered for VAT in Testland.

**Sources:**
- https://example.com/scope (reviewed 2026-01-15)

## Penalties

Fines apply for non-compliance.

**Sources:**
- https://example.com/penalties (reviewed 2026-01-15)
- https://example.com/penalties-secondary (reviewed 2026-01-15)
"""


def test_parse_metadata_extracts_all_fields() -> None:
    metadata = parse_metadata(SAMPLE_DOC)

    assert metadata == {
        "name": "Testland",
        "code": "TL",
        "status": "live",
        "last_reviewed": date(2026, 1, 15),
    }


def test_split_into_sections_finds_each_heading() -> None:
    sections = split_into_sections(SAMPLE_DOC)

    assert [heading for heading, _ in sections] == ["Who is in scope", "Penalties"]
    assert "Everyone registered for VAT" in dict(sections)["Who is in scope"]


def test_extract_source_url_returns_first_url_only() -> None:
    sections = dict(split_into_sections(SAMPLE_DOC))

    assert extract_source_url(sections["Who is in scope"]) == "https://example.com/scope"
    assert extract_source_url(sections["Penalties"]) == "https://example.com/penalties"


def test_extract_source_url_returns_none_without_sources_block() -> None:
    assert extract_source_url("Just some text with no sources block.") is None


def test_strip_sources_block_removes_trailing_sources() -> None:
    sections = dict(split_into_sections(SAMPLE_DOC))

    body = strip_sources_block(sections["Who is in scope"])

    assert body == "Everyone registered for VAT in Testland."
    assert "Sources" not in body


def test_chunk_section_returns_single_chunk_when_small() -> None:
    chunks = chunk_section("Who is in scope", "Everyone registered for VAT in Testland.")

    assert len(chunks) == 1
    assert chunks[0].startswith("## Who is in scope")
    assert "Everyone registered for VAT" in chunks[0]


def test_chunk_section_splits_oversized_section_into_multiple_chunks() -> None:
    # Build a section body well over MAX_CHUNK_TOKENS, as separate paragraphs.
    long_paragraph = "This sentence repeats to pad out the section. " * 40
    body = "\n\n".join([long_paragraph] * 5)

    chunks = chunk_section("Long Section", body)

    assert len(chunks) > 1
    for chunk in chunks:
        assert chunk.startswith("## Long Section")
