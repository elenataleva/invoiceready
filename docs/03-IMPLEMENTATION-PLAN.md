# InvoiceReady — V1 Implementation Plan

Version 1.0 · Scope: V1 (Compliance Navigator), per `docs/02-TECHNICAL-DESIGN.md`.

Each task is one focused session (~30–90 min), touches only the files listed,
and should be run through `/implement-task <N>` one at a time. Do not start
task N+1 until task N is accepted.

---

## Task 1 — Project scaffold and packaging

**Objective:** `pip install -e ".[dev]"` succeeds and produces an importable, empty `app` package.

**Files created:**
- `pyproject.toml`
- `app/__init__.py`
- `app/config.py`
- `.env.example`

**Dependencies:** none.

**Implementation notes:**
- `pyproject.toml`: project metadata, Python `>=3.11`, dependencies (`fastapi`, `uvicorn`, `sqlalchemy`, `alembic`, `psycopg[binary]` or `psycopg2-binary`, `pgvector`, `pydantic`, `pydantic-settings`, `anthropic`, `sentence-transformers`, `structlog`, `jinja2`, `python-multipart`), `[project.optional-dependencies] dev = [pytest, ruff, httpx]`.
- `app/config.py`: a `pydantic-settings` `Settings` class reading `ANTHROPIC_API_KEY`, `DATABASE_URL`, `ENV` from environment/`.env`. No defaults for secrets — fail loudly if missing.
- `.env.example`: documents the three variables above with placeholder values, no real secrets.
- Confirm `.env` is already gitignored (it is) — do not touch `.gitignore` unless a new pattern is needed.

**Acceptance criteria:**
- `pip install -e ".[dev]"` completes with no errors.
- `python -c "from app.config import Settings"` succeeds when `.env` has the three placeholder vars set.
- Missing `ANTHROPIC_API_KEY` raises a clear validation error, not a silent `None`.

**Tests required:** none yet — no logic exists to test beyond settings loading, which task 2's smoke test will exercise indirectly. (If you want one now: a single test asserting `Settings` raises when required env vars are absent is acceptable but optional.)

---

## Task 2 — FastAPI skeleton with `/health`

**Objective:** `uvicorn app.main:app --reload` runs and `/health` returns 200.

**Files created:**
- `app/main.py`
- `tests/test_health.py`
- `tests/__init__.py`

**Dependencies:** Task 1.

**Implementation notes:**
- `app/main.py`: instantiate `FastAPI()`, one `GET /health` route returning `{"status": "ok"}`. No routers, no DB connection yet — this task proves the app boots.
- Use `TestClient` from `fastapi.testclient` (bundled) or `httpx` for the test.

**Acceptance criteria:**
- `uvicorn app.main:app --reload` starts without error and `curl localhost:8000/health` returns `{"status": "ok"}`.
- `pytest` passes.

**Tests required:** `tests/test_health.py` — one test asserting `GET /health` returns 200 and the expected body.

---

## Task 3 — Database connection and SQLAlchemy models

**Objective:** SQLAlchemy models for `countries`, `rules`, `rule_chunks`, `query_logs` exist and can create tables against a real Postgres database.

**Files created:**
- `app/db.py`
- `app/models.py`

**Dependencies:** Task 1. (A local Postgres instance with `pgvector` installed must exist — this is an environment setup step, not a code task; note it as an assumption if not yet available.)

**Implementation notes:**
- `app/db.py`: SQLAlchemy engine from `DATABASE_URL`, `SessionLocal`, a `get_db` dependency generator for FastAPI, and a declarative `Base`.
- `app/models.py`: four ORM classes matching the schema in `02-TECHNICAL-DESIGN.md` §4 exactly (column names, types, nullability). Use `sqlalchemy.dialects.postgresql` for `JSONB` and `pgvector.sqlalchemy.Vector` for the embedding column (dimension 384).
- Do not add columns beyond the design doc's schema — Alembic (task 4) is what evolves it later, not ad-hoc additions here.

**Acceptance criteria:**
- `python -c "from app.models import Country, Rule, RuleChunk, QueryLog"` succeeds.
- Column names/types match `02-TECHNICAL-DESIGN.md` §4 exactly.

**Tests required:** none — no behavior to test yet; correctness is verified by Alembic applying the schema in task 4 and the rules-engine tests in task 6 exercising the models against real data.

---

## Task 4 — Alembic migrations

**Objective:** `alembic upgrade head` creates all four tables (with the `pgvector` extension enabled) on a fresh database.

**Files created:**
- `alembic.ini`
- `alembic/env.py`
- `alembic/versions/0001_initial_schema.py`

**Dependencies:** Task 3.

**Implementation notes:**
- `alembic init alembic`, then wire `alembic/env.py` to import `app.db.Base` and read `DATABASE_URL` from `app.config.Settings` rather than a hardcoded `sqlalchemy.url` in `alembic.ini`.
- The initial migration must include `op.execute("CREATE EXTENSION IF NOT EXISTS vector")` before creating `rule_chunks`.
- One migration is enough for V1 — do not split into multiple revisions for a schema that hasn't shipped yet.

**Acceptance criteria:**
- Against an empty local Postgres database, `alembic upgrade head` succeeds and `\dt` shows all four tables.
- `alembic downgrade base` cleanly drops everything (proves the migration is reversible, catches typos).

**Tests required:** none — migrations are verified by running them, not unit-tested. This is the manual check above; report the output of `alembic upgrade head` in your task report.

---

## Task 5 — Belgium knowledge base content

**Objective:** `knowledge_base/BE.md` contains real, sourced, dated Belgian e-invoicing rules ready for ingestion.

**Files created:**
- `knowledge_base/BE.md`

**Dependencies:** none (can run in parallel with tasks 1–4, but do it before Task 8).

**Implementation notes:**
- Research real sources — Belgian FPS Finance / Peppol guidance. Do not fabricate dates, thresholds, or URLs; if a specific number can't be verified, mark it clearly as `TODO: verify` rather than guessing.
- Structure the file so the ingest script (task 8) can split it into sections cleanly: one `##` heading per topic (Who is in scope, Dates and phases, Required format, Penalties, Exemptions), each ending with a source URL and a reviewed-on date, per `01-BUSINESS-PLAN.md` §6.
- This is content work, not code — no new concept to learn here.

**Acceptance criteria:**
- File covers all five topics listed in `01-BUSINESS-PLAN.md` §6.
- Every factual claim has an inline or end-of-section source URL and a reviewed date.
- No `TODO: verify` markers remain unresolved by the time Task 8 (ingestion) runs against this file — resolve them first.

**Tests required:** none — this is prose content, verified by human review against primary sources, not by pytest.

---

## Task 6 — Rules engine (deterministic matching)

**Objective:** given a business profile, `rules_engine.py` returns the exact set of applicable `Rule` rows with no LLM involvement.

**Files created:**
- `app/rules_engine.py`
- `tests/test_rules_engine.py`

**Dependencies:** Task 3 (models), Task 4 (schema exists so tests can seed real rows).

**Implementation notes:**
- One function, e.g. `get_applicable_rules(db: Session, country: str, employee_count: int, annual_turnover_eur: int | None, invoices_to: list[str]) -> list[Rule]`.
- Matching logic: filter by `country_code`, then by `applies_to_segment` — `'all'` always matches; `'turnover_above'` matches when `annual_turnover_eur > threshold_amount`. Keep the segment-matching logic in small `if`/`elif` branches, not a generic rule interpreter — there are only two segment types in V1.
- This is pure function, no LLM, no network call — test it with an in-memory seeded set of `Rule` rows (use a test Postgres/sqlite fixture, whichever the test DB strategy in task 3 supports; if sqlite lacks `pgvector` support, scope this test to a real test Postgres schema instead — do not silently swap the production dialect).
- Explicitly test the boundary the design doc calls out in §8: exactly-at-threshold and day-before/day-after a deadline.

**Acceptance criteria:**
- A profile below all thresholds returns no rules.
- A profile matching a `turnover_above` segment at exactly the threshold value returns the expected result (decide and document: `>` or `>=` — the design doc says `>`, so exactly-at-threshold should NOT match; confirm this reads correctly to a compliance reviewer since it's a legal boundary).
- A rule with `applies_from` in the future is still returned (it's "applicable to this business", not "already in effect") — but flag this as a documented assumption since the design doc doesn't specify date-filtering behavior; ask if this seems wrong.

**Tests required:** `tests/test_rules_engine.py` — one test per matching branch (`all` segment, `turnover_above` segment above/at/below threshold), one for multiple rules across rule_types returned together, one for a country with zero seeded rules.

---

## Task 7 — Local embedding wrapper

**Objective:** a single function turns text into a 384-dim vector using a local `sentence-transformers` model, with no network dependency at inference time after the model is downloaded once.

**Files created:**
- `app/embeddings.py`
- `tests/test_embeddings.py`

**Dependencies:** Task 1.

**Implementation notes:**
- Use `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions, matches the `Vector(384)` column in task 3) — confirm this is the model you want before locking it in, since it determines the schema's fixed dimension.
- `app/embeddings.py`: `embed(text: str) -> list[float]` and `embed_batch(texts: list[str]) -> list[list[float]]`, loading the model once at module level (not per-call) so repeated calls don't reload weights.
- This is the "one new concept" for this task: a local embedding model. Nothing else changes.

**Acceptance criteria:**
- `embed("test")` returns a list of exactly 384 floats.
- Calling `embed` twice with the same input returns identical (or near-identical, if the model has any nondeterminism — check) vectors.

**Tests required:** `tests/test_embeddings.py` — assert output length is 384, assert two calls with the same text produce cosine similarity ≈ 1.0, assert two calls with unrelated text produce a lower similarity than two calls with near-duplicate text (sanity check the embedding is doing something meaningful, not returning zeros).

---

## Task 8 — Ingestion script (`scripts/ingest.py`)

**Objective:** running `python scripts/ingest.py` populates `rule_chunks` from `knowledge_base/BE.md` with embeddings, and is safe to re-run.

**Files created:**
- `scripts/ingest.py`
- `scripts/__init__.py` (if needed for imports)

**Dependencies:** Task 4 (schema), Task 5 (BE.md content), Task 7 (embeddings).

**Implementation notes:**
- Chunking per `02-TECHNICAL-DESIGN.md` §6: ~500 tokens with ~50 token overlap, split on `##` section boundaries first, then within an oversized section split on paragraph breaks — never mid-sentence. A simple approach: split by `##` headings, and only sub-split a section if it exceeds ~500 tokens.
- Each chunk keeps the `source_url` from its section (parse it from the section text per the structure defined in task 5).
- Idempotency: before inserting, delete existing `rule_chunks` rows for `country_code='BE'` (a full-replace-per-country strategy is simplest and matches "re-run safely" — do not attempt incremental diffing for V1).
- Also upsert the `countries` row for `BE` (code, name, `last_reviewed`, `status`) if not already present — this script is the only place that populates `countries` for now.

**Acceptance criteria:**
- Running the script twice in a row leaves exactly the same number of `rule_chunks` rows for `BE` (no duplicates).
- Every inserted `rule_chunks` row has a non-null `embedding` and a non-null `source_url`.
- `SELECT COUNT(*) FROM rule_chunks WHERE country_code = 'BE'` is greater than zero after running.

**Tests required:** none as an automated pytest (this is a data-loading script exercised manually against a real DB) — but report the row counts from running it as your verification evidence. If you want light coverage, a pytest for just the chunking function (given sample markdown, correct number/boundaries of chunks) is reasonable to add; keep it separate from the DB-writing part.

---

## Task 9 — Retrieval layer

**Objective:** given a country and a question, `retrieval.py` returns the top-k most similar `rule_chunks` above a similarity threshold, or an empty list if none qualify.

**Files created:**
- `app/retrieval.py`
- `tests/test_retrieval.py`

**Dependencies:** Task 7 (embeddings), Task 8 (real BE chunks exist to search against).

**Implementation notes:**
- `retrieve(db: Session, country: str, question: str, top_k: int = 4, threshold: float = <TBD>) -> list[RuleChunk]`.
- Filter by `country_code` first (SQL `WHERE`), then order by `pgvector`'s cosine distance operator (`<=>`) within that filtered set — this is the "structured filter first, semantic search second" design from `02-TECHNICAL-DESIGN.md` §1.
- The similarity threshold is a placeholder for now — mark it as `# TODO: tune against eval set in Task 12` in the code. Pick a reasonable starting value (e.g., cosine similarity > 0.3) rather than leaving it unset.
- Discard results below threshold; if zero survive, return an empty list — the caller (task 11) is responsible for turning that into a refusal.

**Acceptance criteria:**
- A question closely matching known BE content (e.g., "what format do I need in Belgium") returns at least one chunk in the top-k.
- A question about an unrelated topic (e.g., "how do I bake bread") with a reasonable threshold returns zero chunks.
- Filtering by `country='PL'` with only BE data ingested returns zero chunks (proves the structured filter runs before similarity, not after).

**Tests required:** `tests/test_retrieval.py` — the three cases above, run against the real ingested BE data (or a small seeded fixture set if you prefer isolation from Task 8's live data — decide and document which).

---

## Task 10 — Anthropic client wrapper with token/latency logging

**Objective:** one function sends a prompt to Claude and returns the response text while writing a `query_logs` row with token counts and latency for every call.

**Files created:**
- `app/llm.py`

**Dependencies:** Task 3 (models, for `QueryLog`), Task 1 (config for API key).

**Implementation notes:**
- `app/llm.py`: a thin wrapper around the `anthropic` SDK. One function per model tier isn't needed — a single `call_claude(db, endpoint, model, system, messages, max_tokens) -> str` that records input/output tokens (from the API response's `usage` field) and latency (wall-clock around the call) into `query_logs`, per `02-TECHNICAL-DESIGN.md` §7.
- `max_tokens` must be passed explicitly by every caller — do not default it silently inside the wrapper to something unbounded.
- Use `structlog` here too (per CLAUDE.md "log every LLM call") in addition to the DB row — stdout JSON log with the same fields, so logs are visible without querying Postgres.
- Do not call the real API in this task's own tests (no test file for this task — see below); this task is exercised for real in tasks 11 and 13.

**Acceptance criteria:**
- A manual call to `call_claude` with a trivial prompt returns text and inserts exactly one `query_logs` row with non-null `input_tokens`, `output_tokens`, `latency_ms`.
- `max_tokens` omitted from a caller raises a `TypeError` (no default), not a silent unbounded call.

**Tests required:** none automated — this task touches a paid external API, and CLAUDE.md's "no new dependencies" / cost-control rules argue against burning budget on unit tests that hit Anthropic for real. Verify manually with one real call and report the token counts and cost. (Task 11 and 13's tests will use a mocked/stubbed version of this function rather than hitting the API.)

---

## Task 11 — `/api/ask` endpoint (grounded Q&A with refusal)

**Objective:** `POST /api/ask` returns a grounded answer with citations, or `refused: true`, and never falls back to unsourced knowledge.

**Files created:**
- `app/schemas.py` (Ask request/response models added here; file created now, extended in Task 14)
- `app/routers/ask.py`
- `app/routers/__init__.py`
- `tests/test_ask_api.py`

**Files modified:**
- `app/main.py` (register the router)

**Dependencies:** Task 9 (retrieval), Task 10 (llm wrapper), Task 2 (app skeleton).

**Implementation notes:**
- Pydantic models: `AskRequest {country: str, question: str}`, `AskResponse {answer: str, citations: list[str], refused: bool}`.
- Route logic: call `retrieve()`; if empty, return `refused=True` immediately with `answer` pointing to where the user can check the official source manually — **no LLM call at all on refusal**, both for cost and to guarantee no hallucination path exists.
- If chunks survive, build the prompt exactly per `02-TECHNICAL-DESIGN.md` §7's system prompt template, call `call_claude`, extract citations from the chunks used (not parsed from the LLM's free text — the chunks' own `source_url`s are the source of truth for citations).
- In tests, mock/monkeypatch `call_claude` (task 10) so tests don't hit the real API — assert the prompt sent to it contains the retrieved chunk content, but stub its return value.

**Acceptance criteria:**
- A question with strong BE retrieval matches returns `refused: false`, a non-empty `answer`, and `citations` containing at least one real `source_url` from the ingested data.
- A question about a country not in the knowledge base (e.g., `"country": "DE"`) returns `refused: true` and makes no call to `call_claude` (assert via mock call count == 0).
- An out-of-scope question within a valid country (e.g., BE + "what's the best pizza topping") returns `refused: true`.

**Tests required:** `tests/test_ask_api.py` — the three cases above via `TestClient`, with `call_claude` mocked.

---

## Task 12 — Evaluation set

**Objective:** a scored evaluation set of 25–30 grounded questions plus ~8 refusal cases exists and `python scripts/run_eval.py` reports a pass rate against the real `/api/ask` behavior.

**Files created:**
- `tests/eval_set.yaml`
- `scripts/run_eval.py`

**Dependencies:** Task 11 (the endpoint under test must exist and work), Task 5/8 (real BE content to write realistic questions against).

**Implementation notes:**
- `tests/eval_set.yaml`: list of cases, each with `question`, `country`, `expected_refused: bool`, and for non-refusal cases `expected_source_contains: str` (a substring/domain the citation should contain) — do not attempt exact-answer-text matching, LLM phrasing varies; check retrieval/citation correctness, not prose.
- Split roughly per `02-TECHNICAL-DESIGN.md` §8: 25–30 in-scope BE questions covering scope, dates, format, penalties, exemptions; ~8 clearly out-of-scope questions (other countries not yet ingested, unrelated topics, or questions with no grounding in `BE.md`).
- `scripts/run_eval.py`: loads the YAML, calls the real `/api/ask` logic (in-process, not over HTTP — import and call the router function or use `TestClient` against a running app), compares `refused` and citation-substring, prints a pass/fail table and overall pass rate. This **does** call the real Anthropic API — it's meant to, since it's validating end-to-end grounding, not just plumbing. Note the cost implication.
- This is the task from `01-BUSINESS-PLAN.md` §9 ("working evaluation set proving the system doesn't hallucinate") — treat the refusal cases as the ones that matter most, per `02-TECHNICAL-DESIGN.md` §8.

**Acceptance criteria:**
- `python scripts/run_eval.py` runs to completion and prints a per-case result plus an aggregate pass rate.
- All ~8 refusal cases pass (100% — this is the non-negotiable bar per CLAUDE.md's "never fall back" rule).
- Report the pass rate on the 25–30 grounded cases; if it's below expectations, that's a knowledge base or threshold-tuning problem to flag, not a reason to loosen the eval.

**Tests required:** the eval set itself *is* the test (per the design doc's testing strategy table: "pytest + a scoring script"). No separate pytest file — `run_eval.py` is the test runner, and it is not wired into the default `pytest` collection (it costs real money per run, so it should be invoked deliberately, not on every `pytest` call).

---

## Task 13 — `/api/assess` endpoint (structured intake → recommendation)

**Objective:** `POST /api/assess` returns a deterministic `in_scope`/`obligations` structure (from the rules engine) plus LLM-generated plain-language explanations and next steps, matching the response shape in `02-TECHNICAL-DESIGN.md` §5.

**Files modified:**
- `app/schemas.py` (add `AssessRequest`/`AssessResponse` and nested models)

**Files created:**
- `app/routers/assess.py`
- `tests/test_assess_api.py`

**Dependencies:** Task 6 (rules engine), Task 10 (llm wrapper), Task 2 (app skeleton). Independent of Task 11/12 — can be built in parallel with those if useful, but is listed after the eval set per the "evaluation set before the UI" ordering rule.

**Implementation notes:**
- Pydantic request/response models exactly matching `02-TECHNICAL-DESIGN.md` §5's JSON shapes.
- Route logic: call `get_applicable_rules()` (task 6) for the deterministic `in_scope`/`obligations` data (dates, thresholds, formats come from here — **never from the LLM**, per CLAUDE.md). Then one `call_claude` invocation to generate the `explanation` prose per obligation and the `next_steps` list, with the rule data itself included in the prompt as grounding (not retrieved via similarity search — this is a generation task over known facts, not a retrieval task).
- Cache by profile hash per `02-TECHNICAL-DESIGN.md` §7: before calling the LLM, check whether an identical request payload (hashed) already has a satisfying `query_logs` entry with a response, and reuse it rather than re-generating. A simple approach: hash the sorted request JSON, store/look up by that hash — a full caching layer is out of scope, this is "don't regenerate identical requests."
- `disclaimer` is a fixed constant string, not LLM-generated.

**Acceptance criteria:**
- A BE profile that matches a seeded rule returns `in_scope: true` with `obligations` whose `applies_from`/`format_required`/`network`/`source_url` exactly match the database row (assert equality, not just presence — these must never come from the LLM).
- A profile matching no rules returns `in_scope: false` and an empty `obligations` list, with no LLM call made (mock call count == 0 — no point generating explanations for nothing).
- Calling `/api/assess` twice with the identical payload results in only one `call_claude` invocation (cache hit on the second).

**Tests required:** `tests/test_assess_api.py` — the three cases above via `TestClient`, `call_claude` mocked.

---

## Task 14 — Intake form UI (Jinja2)

**Objective:** a human can open the app in a browser, submit country/size/counterparty details through a form, and see the `/api/assess` result rendered as readable HTML.

**Files created:**
- `app/templates/base.html`
- `app/templates/intake.html`
- `app/templates/result.html`
- `app/routers/pages.py`

**Files modified:**
- `app/main.py` (mount templates, register the pages router)

**Dependencies:** Task 13 (assess endpoint must return real data to render).

**Implementation notes:**
- Server-rendered Jinja2 per `02-TECHNICAL-DESIGN.md` §2 — no JS framework, no build step. The form posts to a page route that calls the same logic as `/api/assess` internally (or does a server-side call to it) and renders `result.html`.
- `base.html` carries the disclaimer required by `01-BUSINESS-PLAN.md` §5 in a footer/banner visible on every page — this is a hard requirement, not a nice-to-have.
- Keep styling minimal (plain CSS or a single small stylesheet) — visual polish is not this task's job.
- This is the first task with a genuinely new concept (Jinja2 templating + form handling) — keep the route logic itself thin, delegating to functions already built in tasks 6/13.

**Acceptance criteria:**
- Visiting `/` in a browser shows a form with country, VAT-registered, employee count, turnover, and invoice-counterparty fields.
- Submitting the form with a BE profile renders a result page showing obligations, sources, and next steps.
- The disclaimer text from `01-BUSINESS-PLAN.md` §5 is visible on both the intake and result pages.

**Tests required:** a `tests/test_pages.py` with `TestClient` asserting `GET /` returns 200 and contains the disclaimer text, and `POST` to the form-submit route with a valid BE payload returns 200 and contains at least one obligation's `source_url` in the rendered HTML.

---

## Task 15 — Follow-up Q&A UI

**Objective:** from the result page, a user can ask a free-text follow-up question and see the grounded answer (or refusal) rendered inline, without leaving the page.

**Files created:**
- `app/static/ask.js` (small vanilla JS: fetch `/api/ask`, render response)

**Files modified:**
- `app/templates/result.html` (add a question form + answer container)
- `app/main.py` (mount `/static` if not already)

**Dependencies:** Task 11 (`/api/ask`), Task 14 (result page exists to attach this to).

**Implementation notes:**
- Plain `fetch()` call to `POST /api/ask` with the country carried over from the assessment context (embed it in the page, e.g. a data attribute or hidden field — don't make the user re-type it).
- Render `refused: true` responses visibly differently from normal answers (e.g., a distinct styled box) so refusal isn't mistaken for a real answer — this is a trust-critical UI detail per the product's core guardrail.
- Always render citations as visible links next to the answer, never omit them even if the answer text seems self-contained.

**Acceptance criteria:**
- Typing a question and submitting shows the answer with clickable citation link(s), without a full page reload.
- Submitting a question that triggers `refused: true` shows a visibly distinct "couldn't find this in our sources" message, not a blank or broken answer box.

**Tests required:** none automated for the JS itself (no JS test runner in this stack, and CLAUDE.md says no new dependencies without asking — adding one now for a few lines of `fetch` isn't worth it). Verify manually in a browser: ask a real question, ask an out-of-scope question, confirm both render correctly. Note this as a manual-verification-only task in your report.

---

## Task 16 — Poland and France knowledge base content + re-ingestion

**Objective:** `knowledge_base/PL.md` and `knowledge_base/FR.md` exist with the same rigor as BE.md, are ingested, and the full app (assess + ask) works for all three countries.

**Files created:**
- `knowledge_base/PL.md`
- `knowledge_base/FR.md`

**Files modified:**
- `scripts/ingest.py` (generalize from hardcoded `BE` to loop over all three country files, if task 8 hardcoded BE)
- seed data / migration for `PL`/`FR` rows in `rules` table (a small data-seeding script or extension of `ingest.py` to also populate `rules`, not just `rule_chunks` — decide based on how task 8 was actually built, and note the decision)

**Dependencies:** Task 5 (BE.md as the template/pattern), Task 8 (ingest script), Task 12 (eval set — extend it with PL/FR cases here rather than leaving it BE-only).

**Implementation notes:**
- Same structure and sourcing rigor as Task 5 — this is content work with a mechanical re-run of the ingestion pipeline, not new code concepts.
- Extend `tests/eval_set.yaml` with PL and FR cases (both grounded and refusal) — the "3 countries in the knowledge base" done-criterion from `02-TECHNICAL-DESIGN.md` §11 isn't met until the eval set covers all three, not just BE.
- Also populate the `rules` table rows for PL/FR (structured thresholds/dates/formats) so `/api/assess` works for all three countries, not just retrieval/Q&A.

**Acceptance criteria:**
- `python scripts/ingest.py` populates `rule_chunks` for all three country codes.
- `/api/assess` returns correct, non-empty obligations for a PL profile and an FR profile (spot-check one profile per country).
- `python scripts/run_eval.py` passes its refusal cases across all three countries, and reports a pass rate on the expanded grounded set.

**Tests required:** extend `tests/eval_set.yaml` (covered above); no new pytest files needed — this task is content + config, exercised by existing test/eval infrastructure.

---

## Task 17 — Dockerfile and deployment config

**Objective:** the app builds into a container image and runs identically to local dev, ready to hand to Railway/Render/Fly.io.

**Files created:**
- `Dockerfile`
- `.dockerignore`

**Dependencies:** Task 2 (app must run locally first), Task 4 (migrations must be runnable).

**Implementation notes:**
- `python:3.11-slim` base, non-root user, per `02-TECHNICAL-DESIGN.md` §9.
- Entrypoint runs `alembic upgrade head` before starting `uvicorn` (a small shell wrapper or `CMD` chaining) so deploys always apply pending migrations.
- `.dockerignore` excludes `.venv`, `.git`, `.env`, `tests/`, `__pycache__`.
- Do not add platform-specific config (`railway.json` etc.) unless you've chosen a specific host — this task is the portable Docker layer; host-specific wiring is a manual deploy step, not a code task.

**Acceptance criteria:**
- `docker build .` succeeds.
- `docker run` (against a reachable Postgres with `DATABASE_URL` and `ANTHROPIC_API_KEY` set) serves `/health` with 200.

**Tests required:** none — this is verified by building and running the container, not by pytest. Report the build/run output as evidence.

---

## Task 18 — Structured logging and observability polish

**Objective:** every request to `/api/assess` and `/api/ask` is logged as structured JSON to stdout with enough detail to debug a bad answer after the fact, and query_logs rows are queryable end-to-end.

**Files modified:**
- `app/logging_setup.py` (new file)
- `app/main.py` (wire up structlog config + a request-logging middleware)
- `app/routers/ask.py`, `app/routers/assess.py` (ensure `retrieved_ids` and `refused` are actually written to `query_logs`, if tasks 11/13 left gaps)

**Dependencies:** Task 11, Task 13 (endpoints must exist to log from).

**Implementation notes:**
- `app/logging_setup.py`: configure `structlog` for JSON stdout output, called once at app startup.
- This task is a polish/audit pass: read back through `query_logs` inserts from tasks 10/11/13 and confirm `retrieved_ids`, `refused`, and `request_payload` are actually populated (not left as defaults) — this is exactly the kind of gap that's easy to leave half-done across earlier tasks.
- Add a request-scoped log line (method, path, status, latency) via FastAPI middleware, separate from the per-LLM-call logging already in `app/llm.py`.

**Acceptance criteria:**
- Making one `/api/ask` request produces a stdout JSON log line and a `query_logs` row with non-null `retrieved_ids` (even if empty array) and correct `refused` value.
- Making one `/api/assess` request produces a `query_logs` row with a non-null `request_payload` matching what was sent.

**Tests required:** `tests/test_logging.py` — one test per endpoint asserting a `query_logs` row is created with the expected non-null fields after a request (using the existing mocked-`call_claude` pattern from tasks 11/13).

---

## Task 19 — README and architecture documentation

**Objective:** a stranger can clone the repo, follow the README, and run the app locally, and understands the key architectural trade-offs without reading the full design doc.

**Files modified:**
- `README.md`

**Dependencies:** Task 17 (deployment story should be accurate by now), Task 16 (three-country scope should be reflected).

**Implementation notes:**
- Cover: what the product does (one paragraph), setup steps (env vars, `pip install`, migrations, ingestion), how to run tests and the eval script, and a short "why these architecture decisions" section summarizing `02-TECHNICAL-DESIGN.md` §1 (structured-filter-first retrieval, deterministic rules engine, refusal-over-hallucination) in your own words — this is the section a reviewer or interviewer actually reads.
- Link out to `docs/01-BUSINESS-PLAN.md` and `docs/02-TECHNICAL-DESIGN.md` rather than duplicating their content.
- Include the live URL once deployed (placeholder until then).

**Acceptance criteria:**
- Following the README's setup steps from a clean checkout results in a running app (dry-run this yourself).
- README explicitly states the "no LLM decides a date/threshold" and "refuse rather than hallucinate" design decisions, per the done-criteria in `02-TECHNICAL-DESIGN.md` §11.

**Tests required:** none — documentation, verified by manual read-through and the dry-run above.

---

## Explicitly deferred past this plan

Per `01-BUSINESS-PLAN.md` and `02-TECHNICAL-DESIGN.md`: billing, deadline reminders, saved profiles, V2 readiness-check upload/validation, V3 UBL/Peppol XML generation, Germany/Spain/Netherlands knowledge base content, and actual deployment execution (choosing/configuring the host account) are all out of scope for this plan and should not be started until V1 above is live and reviewed.
