import os
import selectors
import subprocess
import sys
import time

import pytest

from mcp_server.server import DEFAULT_HOST, DEFAULT_PORT, _run_options

STARTUP_MARKER = "Starting MCP server"
STARTUP_TIMEOUT_SECONDS = 30


def test_no_environment_at_all_means_stdio() -> None:
    """The local default, and what `python -m mcp_server.server` must keep
    doing: a client spawning this as a subprocess passes no env of its own."""
    assert _run_options({}) == {"transport": "stdio"}


def test_stdio_is_not_given_a_host_or_port() -> None:
    """There is nothing to bind - the transport is the process's own stdin
    and stdout, and passing a host to it is an error."""
    assert _run_options({"MCP_TRANSPORT": "stdio", "MCP_HOST": "0.0.0.0"}) == {"transport": "stdio"}


@pytest.mark.parametrize("value", ["http", "streamable-http", "HTTP", " Http "])
def test_every_spelling_of_the_http_transport_selects_it(value: str) -> None:
    options = _run_options({"MCP_TRANSPORT": value})

    assert options["transport"] == "http"
    assert options["host"] == DEFAULT_HOST
    assert options["port"] == DEFAULT_PORT


def test_http_binds_where_the_environment_says() -> None:
    options = _run_options({"MCP_TRANSPORT": "http", "MCP_HOST": "0.0.0.0", "MCP_PORT": "9000"})

    assert options["host"] == "0.0.0.0"
    assert options["port"] == 9000


def test_the_port_the_platform_injects_is_used_when_no_port_is_set() -> None:
    """Render and most PaaS hosts set PORT and route to it; a server that
    ignored it would bind a port nothing forwards to."""
    assert _run_options({"MCP_TRANSPORT": "http", "PORT": "10000"})["port"] == 10000


def test_an_explicit_mcp_port_wins_over_the_platform_port() -> None:
    options = _run_options({"MCP_TRANSPORT": "http", "PORT": "10000", "MCP_PORT": "9000"})

    assert options["port"] == 9000


def test_the_default_host_is_loopback_so_local_http_is_not_published() -> None:
    assert DEFAULT_HOST == "127.0.0.1"


def test_an_unrecognised_transport_fails_loudly_instead_of_falling_back() -> None:
    """A silent fallback to stdio would look like a healthy deploy that no
    client can reach."""
    with pytest.raises(ValueError, match="sse"):
        _run_options({"MCP_TRANSPORT": "sse"})


def _wait_for_startup(process: subprocess.Popen[bytes]) -> str:
    """Block until the server logs that it has started, and return its stderr.

    Waiting for the marker rather than sleeping a fixed time is what makes
    the stdout assertion below mean something: an empty stdout proves
    nothing if the process had not finished importing yet.
    """
    selector = selectors.DefaultSelector()
    selector.register(process.stderr, selectors.EVENT_READ)  # type: ignore[arg-type]
    deadline = time.monotonic() + STARTUP_TIMEOUT_SECONDS
    stderr = ""

    while STARTUP_MARKER not in stderr and time.monotonic() < deadline:
        if selector.select(timeout=deadline - time.monotonic()):
            chunk = process.stderr.read1()  # type: ignore[union-attr]
            if not chunk:
                break
            stderr += chunk.decode(errors="replace")

    selector.close()
    return stderr


def test_the_stdio_server_writes_nothing_of_its_own_to_stdout() -> None:
    """In stdio mode stdout *is* the protocol, so one stray print corrupts
    the stream and hangs the client. This is the failure mode most likely to
    be introduced by an unrelated change, which is why it is pinned here.
    """
    process = subprocess.Popen(
        [sys.executable, "-m", "mcp_server.server"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        # Unbuffered, as the Dockerfile runs it. Without this, stdout to a
        # pipe is block-buffered and a stray print would sit in the buffer
        # until the process flushed it - discarded by the terminate() below,
        # leaving this test passing over exactly the bug it exists to catch.
        env={**os.environ, "PYTHONUNBUFFERED": "1"},
    )
    try:
        stderr = _wait_for_startup(process)
        assert STARTUP_MARKER in stderr, f"server never started: {stderr}"
        assert process.poll() is None, "server exited instead of serving"
    finally:
        process.terminate()
        stdout, _ = process.communicate(timeout=30)

    # The banner and the logs go to stderr; no client has spoken yet, so
    # every byte here would be pollution.
    assert stdout == b""
