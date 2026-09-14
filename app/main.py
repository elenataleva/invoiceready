import time
from collections.abc import Awaitable, Callable
from pathlib import Path

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import Settings
from app.logging_setup import configure_logging
from app.rate_limit import limiter
from app.routers import ask, assess, countries, pages

# Called before anything else logs, so no line escapes in the default
# console format.
configure_logging()
logger = structlog.get_logger()

app = FastAPI(title="InvoiceReady")

# Explicit allowlist, no wildcard - the frontend design doc's Cloudflare
# Pages domain and *.pages.dev previews plus local dev, via env so a
# deployed instance never inherits the localhost defaults by accident.
app.add_middleware(
    CORSMiddleware,
    allow_origins=Settings().allowed_origins_list,  # type: ignore[call-arg]
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.include_router(ask.router)
app.include_router(assess.router)
app.include_router(countries.router)
app.include_router(pages.router)

STATIC_DIR = Path(__file__).resolve().parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.middleware("http")
async def log_requests(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """One structured line per HTTP request.

    Deliberately separate from the per-call logging in app/llm.py: this
    records that a request happened and how long it took end to end,
    including requests that never reach the LLM at all (refusals, cache
    hits, static files).
    """
    start = time.monotonic()
    response = await call_next(request)
    logger.info(
        "http_request",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        latency_ms=int((time.monotonic() - start) * 1000),
    )
    return response


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
