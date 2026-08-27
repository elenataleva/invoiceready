# InvoiceReady

EU e-invoicing compliance assistant for small businesses.
Full specs: `docs/01-BUSINESS-PLAN.md`, `docs/02-TECHNICAL-DESIGN.md`.

## Stack
Python 3.11, FastAPI, PostgreSQL + pgvector, SQLAlchemy, Alembic,
Anthropic API (Claude), pytest, ruff, Jinja2 templates.

## Commands
- Install: `pip install -e ".[dev]"`
- Run: `uvicorn app.main:app --reload`
- Test: `pytest`
- Lint: `ruff check . && ruff format --check .`
- Migrate: `alembic upgrade head`
- Ingest KB: `python scripts/ingest.py`
- Eval: `python scripts/run_eval.py`

## Non-negotiable rules
- Deadlines, thresholds, and formats come from the `rules` table via
  deterministic code. The LLM NEVER decides a date or threshold.
- Every factual claim in a generated answer must carry a source URL.
- If retrieval returns nothing above threshold, REFUSE. Never fall back
  to the model's general knowledge.
- Never commit secrets. Keys come from environment variables only.
- No new dependencies without asking me first.
- Type hints on all function signatures.
- Log every LLM call: input tokens, output tokens, latency.

## Style
- Small, single-purpose functions. Prefer boring code over clever code.
- Pydantic models for all API request/response shapes.
- Docstrings only where the "why" is non-obvious — not restating the code.

## Working agreement
- Implement ONE task at a time. Stop after each. Do not start the next.
- Do not modify files unrelated to the current task.
- After implementing: run tests and lint, report files changed and any
  assumptions made.
- If a requirement is ambiguous, ask instead of guessing.