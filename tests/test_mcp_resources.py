import asyncio
from pathlib import Path
from typing import Any

import pytest
from fastmcp import Client
from mcp.types import Resource

from mcp_server.server import KNOWLEDGE_BASE_DIR, _knowledge_resources, mcp
from scripts.ingest import parse_metadata

URI_PREFIX = "invoiceready://knowledge/"

NEW_COUNTRY_FILE = """# Testland — E-Invoicing Compliance

- **Country code:** TL
- **Status:** live
- **Last reviewed:** 2026-03-09

## Who is in scope

Every Testland VAT-taxable person, from 1 January 2027.

**Sources:** https://example.gov.tl/e-invoicing
"""


def _list_resources() -> list[Resource]:
    async def run() -> list[Resource]:
        async with Client(mcp) as client:
            return await client.list_resources()

    return asyncio.run(run())


def _read_resource(uri: str) -> list[Any]:
    async def run() -> list[Any]:
        async with Client(mcp) as client:
            return await client.read_resource(uri)

    return asyncio.run(run())


def _knowledge_base_files() -> list[Path]:
    return sorted(KNOWLEDGE_BASE_DIR.glob("*.md"))


def test_one_resource_is_listed_per_knowledge_base_file() -> None:
    listed = {str(resource.uri) for resource in _list_resources()}

    expected = {
        f"{URI_PREFIX}{str(parse_metadata(path.read_text())['code']).upper()}"
        for path in _knowledge_base_files()
    }

    assert listed == expected
    assert f"{URI_PREFIX}BE" in listed


@pytest.mark.parametrize("path", _knowledge_base_files(), ids=lambda path: str(Path(path).stem))
def test_every_resource_reads_back_non_empty_content_carrying_a_source(path: Path) -> None:
    code = str(parse_metadata(path.read_text())["code"]).upper()

    contents = _read_resource(f"{URI_PREFIX}{code}")

    assert len(contents) == 1
    text = contents[0].text
    assert text.strip()
    # A knowledge base file with no source URL would violate the grounding
    # rule the moment a client pulled it in as context.
    assert "https://" in text


def test_reading_the_belgium_resource_returns_that_file_whole() -> None:
    """Not a prefix, not a summary: the client is pulling in the file itself."""
    contents = _read_resource(f"{URI_PREFIX}BE")

    assert contents[0].text == (KNOWLEDGE_BASE_DIR / "BE.md").read_text()


def test_each_description_carries_the_review_date_so_staleness_is_visible() -> None:
    by_uri = {str(resource.uri): resource for resource in _list_resources()}

    for path in _knowledge_base_files():
        metadata = parse_metadata(path.read_text())
        resource = by_uri[f"{URI_PREFIX}{str(metadata['code']).upper()}"]

        assert resource.description is not None
        assert str(metadata["last_reviewed"]) in resource.description
        assert str(metadata["name"]) in resource.description


def test_a_new_country_file_becomes_a_resource_with_no_code_change(tmp_path: Path) -> None:
    """The acceptance criterion for this task: coverage is whatever is on
    disk, never a list maintained in this module."""
    for path in _knowledge_base_files():
        (tmp_path / path.name).write_text(path.read_text())
    before = len(_knowledge_resources(tmp_path))

    (tmp_path / "TL.md").write_text(NEW_COUNTRY_FILE)
    after = _knowledge_resources(tmp_path)

    assert len(after) == before + 1
    new = [resource for resource in after if str(resource.uri) == f"{URI_PREFIX}TL"]
    assert len(new) == 1
    assert "Testland" in (new[0].description or "")
    assert "2026-03-09" in (new[0].description or "")


def test_a_file_missing_its_metadata_header_is_rejected_rather_than_half_registered(
    tmp_path: Path,
) -> None:
    (tmp_path / "XX.md").write_text("# No header here\n\nSome prose.\n")

    with pytest.raises(ValueError, match="XX.md"):
        _knowledge_resources(tmp_path)


def test_the_header_is_read_the_same_way_the_ingestion_script_reads_it() -> None:
    """Pins the regexes duplicated in mcp_server.server: if the header format
    changes, this fails instead of the two readers silently disagreeing."""
    resources = {
        str(resource.uri): resource for resource in _knowledge_resources(KNOWLEDGE_BASE_DIR)
    }

    for path in _knowledge_base_files():
        metadata = parse_metadata(path.read_text())
        resource = resources[f"{URI_PREFIX}{str(metadata['code']).upper()}"]

        assert str(metadata["name"]) in resource.name
        assert str(metadata["last_reviewed"]) in (resource.description or "")
