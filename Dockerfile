# syntax=docker/dockerfile:1
#
# Portable container image for InvoiceReady, per docs/02-TECHNICAL-DESIGN.md #9.
# Deliberately host-agnostic: no Railway/Render/Fly config lives here, so the
# same image runs anywhere that can set two environment variables.

FROM python:3.11-slim

# PYTHONDONTWRITEBYTECODE - no .pyc files baked into the image.
# PYTHONUNBUFFERED      - structlog output reaches stdout immediately, rather
#                         than being lost in a buffer if the container is killed.
# FASTEMBED_CACHE_PATH  - where fastembed keeps the ONNX model. Pinned because
#                         its default is a directory under $TMPDIR, which a
#                         container wipes on restart - every cold start would
#                         re-download 87MB. Explicit here so the model baked
#                         in below (as root) is found at runtime by appuser.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    FASTEMBED_CACHE_PATH=/opt/fastembed

WORKDIR /app

# Installed editable, matching CLAUDE.md's documented local install, so the
# container imports the same source tree it runs from. (This mattered more
# when app/templates/ and app/static/ shipped non-package assets; since
# docs/04-FRONTEND-DESIGN.md #7.1 made this a JSON-only API those are gone,
# but editable still keeps container and local behaviour identical.)
#
# Tradeoff: app/ is copied before the install, so editing application code
# invalidates the dependency layer and reinstalls. Acceptable at this size;
# the alternative needs a lockfile or a stub-package trick that is harder to
# read than it is worth.
COPY pyproject.toml ./
COPY app ./app
# Both front doors ship in one image: the default CMD below serves the JSON
# API, and the MCP server is the same code reached over a different
# transport, started by overriding the command (see render.yaml). Copied
# before the install because pyproject's packages.find looks for it.
COPY mcp_server ./mcp_server

# No torch: embeddings run on ONNX via fastembed (docs/04-FRONTEND-DESIGN.md
# #8.4). The previous image installed a CPU-only torch build to dodge ~4GB of
# CUDA wheels, but even then the running app needed 463MB resident against
# Render's 512MB free tier. ONNX runs the identical model weights for a
# fraction of that.
RUN pip install --no-cache-dir -e .

# Bake the ONNX model into the image. app/embeddings.py constructs
# TextEmbedding at import time, so without this every cold start downloads
# 87MB - slow on each deploy, and a hard failure on a host with no outbound
# internet access.
RUN python -c "from fastembed import TextEmbedding; \
    TextEmbedding(model_name='sentence-transformers/all-MiniLM-L6-v2')"

# The model is on disk, so don't reach for the network at runtime. A wrong
# cache path then fails loudly at startup instead of silently re-downloading.
ENV HF_HUB_OFFLINE=1

COPY alembic.ini ./
COPY alembic ./alembic
COPY knowledge_base ./knowledge_base
COPY scripts ./scripts

# Non-root user, per 02-TECHNICAL-DESIGN.md #9. The model cache is chowned
# too: fastembed writes lock files beside the model.
RUN useradd --create-home --uid 1000 appuser \
    && chown -R appuser:appuser /app /opt/fastembed
USER appuser

EXPOSE 8000

# python, not curl: the slim base has no curl and adding one just for this
# would grow the image and its patch surface.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import os,urllib.request; \
    urllib.request.urlopen(f'http://127.0.0.1:{os.getenv(\"PORT\", \"8000\")}/health').read()"

# Migrations run on every start, so a deploy can never serve against an
# out-of-date schema (#9 item 4). PORT is injected by most PaaS hosts;
# exec hands PID 1 to uvicorn so it receives SIGTERM and shuts down cleanly.
#
# --proxy-headers is not cosmetic: behind a PaaS load balancer every request
# arrives from the proxy, so request.client.host is the proxy rather than the
# caller. slowapi keys its per-IP limits off that value, which made the rate
# limiting in app/rate_limit.py silently ineffective in production - verified
# against the deployed service, where 22 consecutive requests were served
# without a single 429. That is the guard protecting the Anthropic budget
# (docs/04-FRONTEND-DESIGN.md #7.4), so it failing open is expensive.
#
# --forwarded-allow-ips="*" trusts X-Forwarded-For from any peer, which is
# safe only because the container is reachable exclusively through the
# platform's proxy. Anything that exposes this port directly must narrow it.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
