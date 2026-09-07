"""Populate rule_chunks (and upsert the matching countries row) from
knowledge_base/*.md.

Safe to re-run: for each country found, existing rule_chunks rows for that
country are deleted and reinserted, so running this twice in a row never
creates duplicates. New country files (PL.md, FR.md - Task 16) are picked
up automatically since this loops over every *.md file in knowledge_base/,
rather than hardcoding "BE".
"""

import re
from datetime import date
from pathlib import Path

from sqlalchemy import delete

from app.db import SessionLocal
from app.embeddings import embed_batch
from app.models import Country, RuleChunk

KNOWLEDGE_BASE_DIR = Path(__file__).resolve().parent.parent / "knowledge_base"

# ~500 tokens per chunk, ~50 token overlap when a section must be
# sub-split, per docs/02-TECHNICAL-DESIGN.md #6.
MAX_CHUNK_TOKENS = 500
OVERLAP_TOKENS = 50

TITLE_PATTERN = re.compile(r"^#\s+(.+?)\s+—", re.MULTILINE)
CODE_PATTERN = re.compile(r"^-\s+\*\*Country code:\*\*\s+(\w+)", re.MULTILINE)
STATUS_PATTERN = re.compile(r"^-\s+\*\*Status:\*\*\s+(\w+)", re.MULTILINE)
REVIEWED_PATTERN = re.compile(r"^-\s+\*\*Last reviewed:\*\*\s+(\d{4}-\d{2}-\d{2})", re.MULTILINE)
SECTION_PATTERN = re.compile(r"^##\s+(.+)$", re.MULTILINE)
URL_PATTERN = re.compile(r"https?://\S+")


def _estimate_tokens(text: str) -> int:
    """Word-count-based approximation (~0.75 words per token in English).

    No real tokenizer dependency added for this - CLAUDE.md requires
    asking before new dependencies, and this only needs to decide when a
    section is large enough to sub-split, not produce an exact count.
    """
    return int(len(text.split()) / 0.75)


def parse_metadata(content: str) -> dict[str, str | date]:
    title_match = TITLE_PATTERN.search(content)
    code_match = CODE_PATTERN.search(content)
    status_match = STATUS_PATTERN.search(content)
    reviewed_match = REVIEWED_PATTERN.search(content)
    if not (title_match and code_match and status_match and reviewed_match):
        raise ValueError("Could not parse required metadata header fields")
    return {
        "name": title_match.group(1).strip(),
        "code": code_match.group(1).strip(),
        "status": status_match.group(1).strip(),
        "last_reviewed": date.fromisoformat(reviewed_match.group(1)),
    }


def split_into_sections(content: str) -> list[tuple[str, str]]:
    """Split the markdown body into (heading, body) pairs on '## ' headings.

    body excludes the heading line itself and runs up to the next '## '
    heading or end of file.
    """
    headings = list(SECTION_PATTERN.finditer(content))
    sections = []
    for i, match in enumerate(headings):
        heading = match.group(1).strip()
        body_start = match.end()
        body_end = headings[i + 1].start() if i + 1 < len(headings) else len(content)
        body = content[body_start:body_end].strip()
        sections.append((heading, body))
    return sections


def extract_source_url(section_body: str) -> str | None:
    """The first URL in the section's '**Sources:**' block is the chunk's
    source_url - rule_chunks has one source_url column, not a list, so a
    single primary source is chosen deliberately rather than concatenating.
    """
    if "**Sources:**" not in section_body:
        return None
    sources_block = section_body.split("**Sources:**", 1)[1]
    urls = URL_PATTERN.findall(sources_block)
    return urls[0] if urls else None


def strip_sources_block(section_body: str) -> str:
    return section_body.split("**Sources:**", 1)[0].strip()


def chunk_section(heading: str, body: str) -> list[str]:
    """Split one section into ~500-token chunks with ~50-token overlap.

    Most sections fit under MAX_CHUNK_TOKENS and become exactly one chunk
    (the '## ' section boundary IS the chunk boundary, per the design
    doc). Only a section that exceeds the limit gets sub-split further,
    on paragraph breaks, never mid-sentence.
    """
    full_text = f"## {heading}\n\n{body}" if body else f"## {heading}"
    if _estimate_tokens(full_text) <= MAX_CHUNK_TOKENS:
        return [full_text]

    paragraphs = [p for p in body.split("\n\n") if p.strip()]
    chunks: list[str] = []
    current = [f"## {heading}"]
    current_tokens = _estimate_tokens(current[0])

    for paragraph in paragraphs:
        paragraph_tokens = _estimate_tokens(paragraph)
        if current_tokens + paragraph_tokens > MAX_CHUNK_TOKENS and len(current) > 1:
            chunks.append("\n\n".join(current))
            overlap_words = " ".join(current[-1].split()[-OVERLAP_TOKENS:])
            current = [f"## {heading}", overlap_words]
            current_tokens = _estimate_tokens("\n\n".join(current))
        current.append(paragraph)
        current_tokens += paragraph_tokens

    if len(current) > 1:
        chunks.append("\n\n".join(current))

    return chunks


def ingest_file(path: Path) -> int:
    content = path.read_text()
    metadata = parse_metadata(content)
    country_code = str(metadata["code"])

    db = SessionLocal()
    try:
        country = db.get(Country, country_code)
        if country is None:
            country = Country(
                code=country_code,
                name=metadata["name"],
                last_reviewed=metadata["last_reviewed"],
                status=metadata["status"],
            )
            db.add(country)
        else:
            country.name = str(metadata["name"])
            country.last_reviewed = metadata["last_reviewed"]  # type: ignore[assignment]
            country.status = str(metadata["status"])

        # Full-replace per country: delete before reinserting, so re-running
        # this script never creates duplicate rule_chunks rows.
        db.execute(delete(RuleChunk).where(RuleChunk.country_code == country_code))

        chunk_texts: list[str] = []
        chunk_sources: list[str] = []
        for heading, section_body in split_into_sections(content):
            source_url = extract_source_url(section_body)
            if source_url is None:
                print(f"  Skipping section '{heading}' - no source URL found")
                continue
            body = strip_sources_block(section_body)
            for chunk_text in chunk_section(heading, body):
                chunk_texts.append(chunk_text)
                chunk_sources.append(source_url)

        embeddings = embed_batch(chunk_texts) if chunk_texts else []
        for text, source_url, embedding in zip(chunk_texts, chunk_sources, embeddings, strict=True):
            db.add(
                RuleChunk(
                    country_code=country_code,
                    content=text,
                    source_url=source_url,
                    embedding=embedding,
                )
            )

        db.commit()
        return len(chunk_texts)
    finally:
        db.close()


def main() -> None:
    for path in sorted(KNOWLEDGE_BASE_DIR.glob("*.md")):
        print(f"Ingesting {path.name}...")
        count = ingest_file(path)
        print(f"  Inserted {count} chunks")


if __name__ == "__main__":
    main()
