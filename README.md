# InvoiceReady

[![CI](https://github.com/elenataleva/invoiceready/actions/workflows/ci.yml/badge.svg)](https://github.com/elenataleva/invoiceready/actions/workflows/ci.yml)

EU e-invoicing compliance assistant for small businesses. You describe your
business in a short form; it tells you **which e-invoicing obligations apply
to you, from what date, in what format** — and lets you ask follow-up
questions in plain language. Every factual claim carries a source URL and the
date that source was last reviewed. When the answer isn't in its sources, it
says so instead of guessing

Covers **Belgium, Poland and France**.

**Live:** JSON API at `https://invoiceready-api.onrender.com` ·
MCP server at `https://invoiceready-mcp.onrender.com/mcp`.
Both are Render free tier, so the first request after ~15 minutes idle pays
a cold start of roughly a minute.

Docs: [Business plan](docs/01-BUSINESS-PLAN.md) ·
[Technical design](docs/02-TECHNICAL-DESIGN.md) ·
[Implementation plan](docs/03-IMPLEMENTATION-PLAN.md) ·
[MCP server](docs/04-MCP-SERVER.md)

---

## Why it's built this way

Three decisions define this codebase. They're the interesting part.

### 1. The LLM never decides a date, threshold, or format

Obligations come from the `rules` table via plain Python
([`app/rules_engine.py`](app/rules_engine.py)) — no model involved. The LLM is
given those already-decided facts and asked only to write the prose
explaining them.

You can see the split in one place,
[`app/routers/assess.py`](app/routers/assess.py), where the response is
assembled: six of the seven fields on each obligation read `rule.something`
straight off a database row. Exactly one, `explanation`, comes from Claude.
There is no code path where a generated date could reach the user — not
"we told the model not to," but structurally impossible, because the
assignment reads from the database.

This matters because a hallucinated `2027-01-01` is indistinguishable from a
correct one at a glance, and the user finds out via a penalty.

### 2. Refuse rather than hallucinate

If semantic retrieval returns nothing above the similarity threshold,
[`app/routers/ask.py`](app/routers/ask.py) returns a refusal **and never calls
the LLM at all**. There's no fallback to the model's general knowledge.

This is not caution for its own sake. Asked without sources, Claude reports
the French e-invoicing fine as €15 (it's €50 since the 2026 finance law) and
the Belgian retention period as 7 years (it's been 10 since 2019). Both
answers are fluent, confident, and wrong — a model is frozen at its training
cutoff and cannot tell you which of its facts have expired. "I don't know,
here's the official source" costs a user two minutes; a confidently stale
answer costs them a fine.

The cost of this decision is **false refusals** — questions we could answer
but don't retrieve. That's a real product cost, and the fix is better content
and better retrieval, never a fallback.

### 3. Structured filtering first, semantic search second

A user in Belgium needs *Belgium's rules*. That's a `WHERE country_code = 'BE'`,
not a similarity search. [`app/retrieval.py`](app/retrieval.py) filters in SQL
first, then ranks by cosine distance within that filtered set, then discards
anything below threshold. Vector search only earns its place for open-ended
follow-ups.

Same reasoning rules out an agent framework: V1 is a workflow with fixed
steps, which is cheaper, more testable, and more predictable than letting a
model choose its own path.

---

## Setup

### Prerequisites

- **Python 3.11+**
- **PostgreSQL 14+ with the [`pgvector`](https://github.com/pgvector/pgvector)
  extension available.** The extension must be installed on the server, not
  just enabled — `CREATE EXTENSION vector` fails otherwise, and the first
  migration runs it. If you're using the EDB installer on macOS, you'll need
  to build pgvector from source against that installation's `pg_config`.
- An **Anthropic API key**. Set a spend cap in the console first.

### Steps

```bash
git clone <repo-url> && cd invoiceready

python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -e ".[dev]"

cp .env.example .env                 # then edit it — see below
createdb invoiceready                # or create it in pgAdmin

alembic upgrade head                 # schema + CREATE EXTENSION vector
python scripts/ingest.py             # knowledge_base/*.md -> embedded chunks
python scripts/seed_rules.py         # structured obligations -> rules table

uvicorn app.main:app --reload        # JSON API on :8000
```

`ingest.py` downloads the ONNX embedding model (~87MB) the first time it runs.

Then the web client, in a second terminal:

```bash
cd frontend
nvm use                              # Node version is pinned in .nvmrc
npm install
npm run dev                          # http://localhost:5173
```

The client opens in **demo mode**, reading committed fixtures, so it runs
with the API switched off. Use the header toggle (or `?live=1`) to point it
at the backend above.

### Environment variables

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key. Never commit this |
| `DATABASE_URL` | e.g. `postgresql+psycopg://postgres:password@localhost:5432/invoiceready` |
| `ENV` | `development` or `production` |

`.env` is gitignored. Keys come from environment variables only.

### Both ingest steps are required

`ingest.py` and `seed_rules.py` populate **two different tables for two
different purposes**, and the app is quietly broken without either:

| | `rule_chunks` (`ingest.py`) | `rules` (`seed_rules.py`) |
|---|---|---|
| Contains | prose + embeddings | dates, formats, networks |
| Powers | `/api/ask` — semantic Q&A | `/api/assess` — deterministic obligations |
| If missing | every question is refused | every profile returns `in_scope: false` |

Both are safe to re-run; each fully replaces its own rows.

---

## Running it

```bash
pytest                               # 86 tests, no API calls, no network
ruff check . && ruff format --check .
python scripts/run_eval.py           # 58 cases against the REAL API — costs money

cd frontend && npm run build         # typecheck + production build
cd frontend && npm run lint
cd frontend && npm test              # 39 tests, fixtures only, no network
```

`run_eval.py` also writes `frontend/src/data/eval-results.json`, which is
what the `/how-it-works` page displays — so those numbers are always a real,
dated run rather than typed-in copy.

`pytest` is fully mocked and free. `run_eval.py` is not: it makes a real
Claude call per grounded case (~$0.30 a run) and is deliberately excluded from
`pytest` for that reason. Run it when you change a prompt, the model, the
similarity threshold, or the knowledge base.

It scores two properties that hold regardless of how the model words things:
**did it refuse**, and **which source grounded the answer**. Exact-text
assertions are useless against a non-deterministic model.

### Docker

```bash
docker build -t invoiceready .
docker run -p 8000:8000 \
  -e DATABASE_URL="postgresql+psycopg://user:pass@host:5432/invoiceready" \
  -e ANTHROPIC_API_KEY="sk-ant-..." \
  invoiceready
```

Migrations run on container start, so a deploy can't serve against an
out-of-date schema. The embedding model is baked into the image at build time
— no download on cold start, and no dependency on HuggingFace being reachable.

---

## The MCP server

MCP is a standard way for an AI client to reach an external tool or data
source: one JSON-RPC contract, so a server written once works with every
MCP-compatible client instead of needing bespoke glue per pairing. This repo
exposes its rules engine as one, so an AI assistant can answer e-invoicing
questions from the same sourced database the web app uses.

**What it's for, honestly:** it was built to understand the protocol, not
because integration demand exists — nobody is currently consuming it. The
plausible consumer is a small accounting practice running its own internal
assistant, which could answer client questions about e-invoicing deadlines
without rebuilding the knowledge base. It's an MCP server exposing a rules
engine, not an integration platform.

| Tool | Does |
|---|---|
| `get_einvoicing_rules` | Obligations for one business profile — dates, formats, networks, each with its source URL |
| `check_country_coverage` | Which countries are covered and when each was last reviewed |

Plus one readable resource per country, `invoiceready://knowledge/{BE,FR,PL}`
— the curated markdown itself, for a client that wants the context rather
than an answer.

Run it locally, or point a client at the deployed one:

```bash
claude mcp add invoiceready -- .venv/bin/python -m mcp_server.server

claude mcp add --transport http invoiceready-remote \
  https://invoiceready-mcp.onrender.com/mcp
```

Asked an ordinary question, the client calls the tool instead of answering
from its own knowledge, and every obligation arrives with the official source
and the date it was reviewed:

![Claude Code calling get_einvoicing_rules for a Belgian business, returning two obligations with dates, formats and a finance.belgium.be source](docs/images/mcp-claude-code-cited-obligations.png)

The more interesting behaviour is outside the covered set. Italy has a
well-known e-invoicing mandate and the model certainly has opinions about it,
but this server has no sourced rules for it — so the answer is a refusal that
names what *is* covered and says plainly that this is not the same as "no
obligations apply":

![Claude Code refusing an Italian query, explaining that Italy is absent from the rules database rather than free of obligations, and listing the covered countries](docs/images/mcp-claude-code-refusal.png)

### Two front doors, one engine

```
              app/rules_engine.py  ← single source of truth
              app/retrieval.py
                   │         │
      ┌────────────┘         └────────────┐
      ▼                                   ▼
FastAPI routers                      mcp_server/
/api/assess, /api/ask                tools + resources
humans, via a browser                AI clients, via JSON-RPC
```

The MCP server reimplements nothing — it imports `get_applicable_rules` and
calls it, so a row edited in the `rules` table changes both front doors at
once. A test asserts the tool returns exactly what `POST /api/assess` returns
for the same profile, so divergence fails the build rather than reaching a
user.

Neither tool makes an LLM call. The REST API spends a Claude call turning a
rule into prose because a browser can't; an MCP client already has a model of
its own, so this ships facts and sources and lets the client write the prose.

Setup, transports, troubleshooting and the auth reasoning:
**[docs/04-MCP-SERVER.md](docs/04-MCP-SERVER.md)**.

---

## How a request flows

**`POST /api/assess`** — the deterministic path:

```
profile -> rules_engine (SQL, no LLM) -> obligations with dates/formats
                                      -> one Claude call for prose only
                                      -> response, cached by profile hash
```

**`POST /api/ask`** — the retrieval path:

```
question -> Haiku rewrites it into a formal search query
         -> embed -> filter by country in SQL -> rank by cosine distance
         -> below threshold? REFUSE, no LLM call
         -> above? Claude answers from those chunks only, citations from
            the chunks' own source_url column (never parsed from its text)
```

The rewrite step exists because real users type "when do i have to start?",
which shares almost no vocabulary with a compliance document — it scored
0.098 against a 0.5 threshold. Rewritten, it scores 0.672. The rewriter is
instructed to pass non-compliance questions through unchanged, so "how do I
bake sourdough bread?" gets no boost and is still refused.

---

## Layout

```
app/
  main.py           FastAPI entrypoint, logging config, request middleware
  rules_engine.py   deterministic rule matching — no LLM
  retrieval.py      country filter + vector search + query rewriting
  llm.py            Anthropic wrapper; logs tokens and latency on every call
  logging_setup.py  JSON stdout logging; sole owner of query_logs inserts
  rate_limit.py     per-IP limits on the two endpoints that cost money
  routers/          ask.py, assess.py, countries.py — JSON only
mcp_server/         MCP front door onto the same engine — tools + resources
frontend/           React + Vite client (see frontend/README.md)
  src/api/          DataSource interface, HTTP + demo implementations
  src/features/     intake wizard, assessment, Q&A
  src/demo/         fixtures snapshotted from the real API
knowledge_base/     BE.md, PL.md, FR.md — curated, sourced, dated
scripts/            ingest.py, seed_rules.py, run_eval.py, snapshot_fixtures.py
tests/              pytest suite + eval_set.yaml
alembic/            migrations
```

Every request is logged as JSON to stdout and persisted to `query_logs` with
tokens, latency, which chunks grounded the answer, and whether it refused.

---

## Known limitations

- **Retrieval misses definitional questions.** "What is Factur-X?" scores
  0.276 and is refused, though the term is covered — sections are organised by
  obligation, not by term. Hybrid keyword+vector search is the real fix.
- **Cohorts aren't modelled.** The rules engine understands only `all` and
  `turnover_above`, with no currency conversion, so it can't express "Polish
  taxpayers over PLN 200m" or "French companies with 250+ employees". Those
  phases are named in `rule_type` instead.
- **Facts are duplicated** between `knowledge_base/*.md` and
  `scripts/seed_rules.py`. Nothing detects drift between them.
- **Some sources are secondary.** Penalty and retention figures for PL/FR
  cite tax publishers where official pages weren't reachable. Flagged for
  verification before real users.
- **No auth.** Per-IP rate limits (10/min, 100/day) now guard the two
  endpoints that spend money, but anyone can still call them. Fine for a
  portfolio deployment behind a spend cap; not for real users.
- **No browser-level frontend tests.** Vitest and React Testing Library
  cover the component and flow logic against real fixtures, including the
  refusal state; the Playwright pass specified in
  `docs/04-FRONTEND-DESIGN.md` — real layout, real focus behaviour — isn't
  set up yet.
- **Content goes stale.** `last_reviewed` records when a human checked;
  nothing alerts when that date gets old.

---

## Guardrails

- Deadlines, thresholds and formats come from the `rules` table via
  deterministic code. **The LLM never decides a date or threshold.**
- Every factual claim in a generated answer carries a source URL.
- If retrieval returns nothing above threshold, **refuse** — never fall back
  to the model's general knowledge.
- Secrets come from environment variables only.
- Informational guidance, not tax or legal advice.
