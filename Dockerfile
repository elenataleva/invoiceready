# syntax=docker/dockerfile:1
#
# Portable container image for InvoiceReady, per docs/02-TECHNICAL-DESIGN.md #9.
# Deliberately host-agnostic: no Railway/Render/Fly config lives here, so the
# same image runs anywhere that can set two environment variables.

FROM python:3.11-slim

# PYTHONDONTWRITEBYTECODE - no .pyc files baked into the image.
# PYTHONUNBUFFERED     - structlog output reaches stdout immediately, rather
#                        than being lost in a buffer if the container is killed.
# HF_HOME              - where sentence-transformers caches its model. Pinned
#                        explicitly so the model baked in below (as root) is
#                        found at runtime by the non-root user.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/opt/huggingface

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

# CPU-only torch, installed first so the resolver treats it as satisfied when
# sentence-transformers asks for torch below. Not a new dependency - torch is
# already pulled in transitively; this only selects the build. The default
# PyPI wheel drags in ~4GB of CUDA and Triton libraries for a GPU this will
# never have, which is the difference between a deployable image and one that
# times out pushing to a small host.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

RUN pip install --no-cache-dir -e .

# Bake the embedding model into the image. app/embeddings.py constructs the
# SentenceTransformer at import time, so without this every cold start
# downloads ~90MB from HuggingFace - slow on each deploy, and a hard failure
# on a host with no outbound internet access.
RUN python -c "from sentence_transformers import SentenceTransformer; \
    SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

# The model is now on disk, so refuse to reach for the network at runtime.
# A wrong cache path fails loudly at startup instead of silently re-downloading.
ENV HF_HUB_OFFLINE=1

COPY alembic.ini ./
COPY alembic ./alembic
COPY knowledge_base ./knowledge_base
COPY scripts ./scripts

# Non-root user, per 02-TECHNICAL-DESIGN.md #9. The HuggingFace cache is
# chowned too: sentence-transformers writes lock files beside the model.
RUN useradd --create-home --uid 1000 appuser \
    && chown -R appuser:appuser /app /opt/huggingface
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
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
