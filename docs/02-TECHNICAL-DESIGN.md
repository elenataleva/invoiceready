# InvoiceReady — Technical Design
Version 1.0 · Scope: V1 (Compliance Navigator)

---

## 1. Architectural principle

**The retrieval in this product is mostly structured, not semantic.** A user in Belgium with 4 employees needs *Belgium's rules* — that's a filter, not a similarity search. Semantic search only earns its place for open-ended follow-up questions ("what happens if I miss the deadline?").

So the design is a **hybrid**: structured filtering first (country, entity type), semantic search second, within the filtered set. This is a deliberate trade-off, and being able to explain *why* is worth as much as the code.

**Corollary:** do not reach for a heavy agent framework. V1 is a workflow with fixed steps, which is more testable, cheaper, and more predictable. One well-defined tool-use loop is enough.

## 2. Stack

| Layer | Choice | Rationale |
|---|---|---|
| Language | Python 3.11+ | Standard for AI work; matches every target job |
| API framework | FastAPI | Real product surface (auth, custom domain, JSON API) rather than a demo-shaped Streamlit app; async-friendly; auto-generated OpenAPI docs |
| Frontend | Server-rendered Jinja2 templates + vanilla JS | No build step, no framework churn; enough for V1. A React SPA is scope creep here. |
| LLM | Claude via Anthropic API | You already have a key. Haiku for classification, Sonnet for generation — see §7 on cost. |
| Database | PostgreSQL + `pgvector` | Structured country rules *and* embeddings in one store; transferable relational skill; matches AI Platform Engineer JD |
| Embeddings | `sentence-transformers` (local, free) or Voyage AI | Local model avoids per-call cost on a €5 budget; swap later if quality demands |
| Migrations | Alembic | Schema changes tracked in git, not applied by hand |
| Testing | pytest | Standard |
| Linting/format | ruff | One tool for both; fast |
| Deployment | Railway (or Render/Fly.io) | Managed Postgres + app in one place; simple for a first deploy |
| Observability | structlog → stdout, captured by host | JSON logs; no vendor needed at V1 scale |
| Secrets | `.env` locally (gitignored), platform env vars in production | Never commit keys |

**Why not Streamlit:** faster to a demo, but it fights you on auth, routing, custom domains, and looks like a prototype. Since this is meant to attract real users, FastAPI is the right call — Claude Code closes most of the difficulty gap.

**Why not LangChain/LlamaIndex for V1:** the retrieval logic here is ~100 lines. A framework would hide the mechanics you're specifically trying to learn, and add abstractions you'd have to debug. Reconsider only if V3 requires genuine multi-step agent behaviour.

## 3. System architecture

```
Browser
  │
  ▼
FastAPI app
  ├── /                    intake form (country, size, counterparties)
  ├── /api/assess          POST → structured compliance assessment
  ├── /api/ask             POST → grounded follow-up Q&A
  └── /health              liveness check
        │
        ├──► Rules Engine        deterministic: country + profile → applicable rules
        ├──► Retrieval Layer     pgvector similarity search, filtered by country
        ├──► LLM Client          Anthropic API, structured output, citations enforced
        └──► Logger              every request: prompt, retrieved chunks, response, tokens, latency
                │
                ▼
        PostgreSQL + pgvector
          ├── countries          country metadata
          ├── rules              structured rules (dates, thresholds, formats)
          ├── rule_chunks        text chunks + embeddings for semantic search
          └── query_logs         observability
```

**Key design decision:** deadlines, thresholds, and formats come from the **rules table via deterministic code**, never from the LLM. The LLM's job is explaining and answering follow-ups — it does not decide what your deadline is. This eliminates the highest-severity failure mode (a hallucinated date) architecturally, rather than hoping a prompt prevents it.

## 4. Data model

```sql
CREATE TABLE countries (
    code            CHAR(2) PRIMARY KEY,      -- 'BE', 'PL', 'FR'
    name            TEXT NOT NULL,
    last_reviewed   DATE NOT NULL,
    status          TEXT NOT NULL             -- 'live' | 'phasing' | 'announced'
);

CREATE TABLE rules (
    id                  SERIAL PRIMARY KEY,
    country_code        CHAR(2) REFERENCES countries(code),
    rule_type           TEXT NOT NULL,        -- 'issue' | 'receive' | 'report'
    applies_from        DATE NOT NULL,
    applies_to_segment  TEXT NOT NULL,        -- 'all' | 'turnover_above' | ...
    threshold_amount    NUMERIC,
    threshold_currency  CHAR(3),
    format_required     TEXT,                 -- 'Peppol BIS 3.0' | 'KSeF XML' | ...
    network             TEXT,                 -- 'Peppol' | 'KSeF' | 'PDP'
    penalty_summary     TEXT,
    source_url          TEXT NOT NULL,
    source_reviewed_at  DATE NOT NULL
);

CREATE TABLE rule_chunks (
    id              SERIAL PRIMARY KEY,
    country_code    CHAR(2) REFERENCES countries(code),
    content         TEXT NOT NULL,
    source_url      TEXT NOT NULL,
    embedding       VECTOR(384)               -- match your embedding model's dimension
);

CREATE TABLE query_logs (
    id                SERIAL PRIMARY KEY,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    endpoint          TEXT,
    request_payload   JSONB,
    retrieved_ids     INTEGER[],
    response_text     TEXT,
    input_tokens      INTEGER,
    output_tokens     INTEGER,
    latency_ms        INTEGER,
    refused           BOOLEAN DEFAULT FALSE
);
```

## 5. API design

### `POST /api/assess`
Request:
```json
{
  "country": "BE",
  "vat_registered": true,
  "employee_count": 4,
  "annual_turnover_eur": 380000,
  "invoices_to": ["B2B", "B2C"]
}
```
Response:
```json
{
  "in_scope": true,
  "obligations": [
    {
      "rule_type": "issue",
      "applies_from": "2026-01-01",
      "format_required": "Peppol BIS 3.0",
      "network": "Peppol",
      "explanation": "Plain-language paragraph generated by the LLM, grounded in the rule record.",
      "source_url": "https://...",
      "source_reviewed_at": "2026-08-01"
    }
  ],
  "next_steps": ["...", "...", "..."],
  "disclaimer": "Informational guidance only, not tax or legal advice."
}
```

### `POST /api/ask`
```json
{ "country": "BE", "question": "What happens if I miss the deadline?" }
```
Response includes `answer`, `citations[]`, and `refused: boolean`.

**Contract rule:** if retrieval returns nothing above the similarity threshold, the endpoint returns `refused: true` with a pointer to the official source. It does **not** fall back to the model's general knowledge.

## 6. Retrieval design

1. Filter `rule_chunks` by `country_code` (SQL `WHERE`) — cheap, exact
2. Embed the question locally
3. `pgvector` cosine similarity within the filtered set, top-k = 4
4. Discard chunks below a similarity threshold (tune with the eval set)
5. If zero chunks survive → refuse
6. Insert surviving chunks + their source URLs into the prompt

**Chunking:** ~500 tokens with ~50 token overlap, split on section boundaries, never mid-sentence. Every chunk carries its `source_url` — citations must survive chunking.

## 7. LLM usage and cost control

Your €5 budget is real. Treat token spend as a design constraint:

- **Haiku** for intake classification and cheap routing
- **Sonnet** for generated explanations only
- `max_tokens` capped explicitly on every call
- Cache assessment results keyed by profile hash — the same inputs should not re-generate
- Log `input_tokens` / `output_tokens` per request from day one
- Never send the whole knowledge base into a prompt; retrieval exists precisely to avoid that

**Prompt structure for grounded answers:**
```
System: You answer EU e-invoicing compliance questions using ONLY the provided
context. If the context does not contain the answer, say so and point to the
official source. Never state a date, threshold, or format not present in the
context. Cite the source URL for every factual claim.

User: <context chunks with source URLs>
      <user question>
```

## 8. Testing strategy

Do not aim for high coverage everywhere. Test what breaks, and what would be embarrassing:

| Layer | What to test | Tool |
|---|---|---|
| Rules engine | Given profile X, correct rules returned. Boundary cases: exactly at threshold, day before/after a deadline | pytest, pure unit tests |
| Retrieval | Known question → expected chunk in top-k | pytest |
| Grounding | **Evaluation set: 25–30 questions with expected answers, plus ~8 deliberately out-of-scope questions the system must refuse** | pytest + a scoring script |
| API | Endpoint contracts, validation errors | pytest + FastAPI TestClient |

The refusal tests matter most. A system that confidently answers a question about Italy when Italy isn't in the knowledge base is the failure that would kill this product.

## 9. Deployment

1. `Dockerfile` (python:3.11-slim, non-root user)
2. Railway project: app service + Postgres plugin
3. `pgvector` extension enabled on the database
4. Alembic migrations run on deploy
5. Environment variables: `ANTHROPIC_API_KEY`, `DATABASE_URL`, `ENV`
6. Custom domain once it's real
7. `/health` endpoint for uptime monitoring

**Cost check before deploying:** set a hard monthly spend cap in the Anthropic console. A bug that loops API calls can burn your budget in minutes.

## 10. Repository layout

```
invoiceready/
├── CLAUDE.md                    # always-loaded project context
├── .claude/
│   └── skills/                  # your custom /commands
├── docs/
│   ├── 01-BUSINESS-PLAN.md
│   ├── 02-TECHNICAL-DESIGN.md
│   └── 03-IMPLEMENTATION-PLAN.md
├── app/
│   ├── main.py                  # FastAPI entrypoint
│   ├── config.py                # settings from env
│   ├── db.py                    # connection/session
│   ├── models.py                # SQLAlchemy models
│   ├── schemas.py               # Pydantic request/response
│   ├── rules_engine.py          # deterministic rule matching
│   ├── retrieval.py             # embedding + pgvector search
│   ├── llm.py                   # Anthropic client wrapper
│   ├── logging_setup.py
│   ├── routers/
│   │   ├── assess.py
│   │   └── ask.py
│   └── templates/
├── knowledge_base/
│   ├── BE.md                    # curated, sourced, dated
│   ├── PL.md
│   └── FR.md
├── scripts/
│   ├── ingest.py                # knowledge_base/ → rule_chunks
│   └── run_eval.py
├── tests/
│   ├── test_rules_engine.py
│   ├── test_retrieval.py
│   ├── test_api.py
│   └── eval_set.yaml
├── alembic/
├── Dockerfile
├── pyproject.toml
├── .env.example
└── README.md
```

## 11. What "done" means for V1

- [ ] Live URL, publicly reachable
- [ ] 3 countries in the knowledge base, each with sources and review dates
- [ ] Assessment returns correct, deterministic obligations
- [ ] Follow-up Q&A cites sources and refuses when out of scope
- [ ] Evaluation set passes, including all refusal cases
- [ ] Every request logged with tokens and latency
- [ ] README explains the architecture and the trade-offs
- [ ] Disclaimer visible on every page
