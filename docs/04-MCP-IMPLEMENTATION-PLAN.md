# InvoiceReady — MCP Server Implementation Plan
Version 1.0 · Scope: expose InvoiceReady's rule lookup as an MCP server

> Companion to `docs/02-TECHNICAL-DESIGN.md`. Follows the same working agreement as
> `docs/03-IMPLEMENTATION-PLAN.md` — one task at a time via `/implement-task <N>`,
> reviewed and committed before the next begins.

---

## 0. Why this exists — read this before building

**Be honest about the goal.** InvoiceReady has no external users today, so nobody is
waiting to integrate this server into their agent. This is built to *demonstrate
protocol-level understanding*, not because integration demand exists yet.

That is still a legitimate reason to build it, for two reasons:

1. **MCP is named explicitly in the roles being targeted.** The difference in an
   interview between "I've read about MCP" and "I built one — here's the repo, and
   here's what I learned about why the protocol exists" is large, and costs ~2 days.
2. **There is a real, plausible consumer story** — a small accounting practice running
   its own internal AI assistant could plug this in so their assistant answers client
   questions about e-invoicing deadlines without rebuilding the knowledge base. That is
   the "build once, reused by many" pattern MCP exists for.

**Do not oversell it.** In the README and in interviews, describe it as
"an MCP server exposing the rules engine, built to understand the protocol" — not as
"an integration platform." Interviewers see through the second framing immediately,
and the first one is more impressive anyway because it is true.

**Prerequisite:** V1 is live and the rules engine works. If V2 (readiness check) is not
built yet, build that first — it has real user value *and* real learning. This is the
lower-priority of the two.

---

## 1. What MCP actually is (the version to say out loud)

Before MCP, every AI application that wanted to reach an external tool or data source
needed bespoke glue code for that specific pairing. MCP standardises that: a JSON-RPC
contract between AI clients and external programs, so one server works with every
MCP-compatible client.

Three capability surfaces exist in the protocol:

| Surface | What it is | InvoiceReady uses it for |
|---|---|---|
| **Tools** | Callable functions the model can invoke | `get_einvoicing_rules`, `check_country_coverage` |
| **Resources** | Readable context the client can pull in | The per-country knowledge base markdown |
| **Prompts** | Reusable prompt templates the client can offer | Skip in V1 — no clear use here |

Two transports matter:

- **stdio** — the server runs as a local subprocess. Simplest; right for local dev and
  for wiring into Claude Code/Desktop on your own machine.
- **Streamable HTTP** — the server runs as a network service. Right for anything
  deployed and reachable by other people.

Build stdio first (Task 2), add HTTP second (Task 5). They are the same tool code with
a different `transport=` argument, so this ordering costs nothing.

---

## 2. Architectural decision — thin wrapper, not a second brain

**The MCP server must not reimplement any logic.** It imports and calls the existing
`app/rules_engine.py` and `app/retrieval.py`. If a rule changes in the database, the
MCP server reflects it immediately because it is reading the same source.

```
              ┌──────────────────────────┐
              │  app/rules_engine.py     │  ← single source of truth
              │  app/retrieval.py        │
              └───────┬──────────┬───────┘
                      │          │
         ┌────────────┘          └────────────┐
         ▼                                    ▼
  FastAPI routers                      MCP server
  (/api/assess, /api/ask)              (mcp_server/server.py)
  human users via browser              AI clients via JSON-RPC
```

Two front doors, one engine. If you find yourself copy-pasting rule logic into the MCP
server, stop — that is the design going wrong.

**Grounding rules still apply, unchanged.** Everything in `CLAUDE.md` holds here:
deadlines and thresholds come from the `rules` table deterministically, every factual
claim carries a `source_url`, and out-of-scope queries refuse rather than guess. An MCP
tool that returns an uncited deadline is the same failure as an API endpoint that does.

---

## 3. Stack additions

| Concern | Choice | Notes |
|---|---|---|
| SDK | `fastmcp` | Decorator-based layer over the official `mcp` SDK; generates tool schemas from type hints and docstrings automatically |
| Transport (local) | stdio | Default; used by Claude Code and Claude Desktop |
| Transport (remote) | Streamable HTTP | For the deployed version |
| Testing | `pytest` + the MCP SDK's client | Call your own server programmatically in tests |
| Inspection | MCP Inspector | Browser tool for manually poking at a running server |

Per `CLAUDE.md`: this adds a dependency, so confirm before installing.

---

## 4. Tasks

### Task M1 — Scaffold the MCP server package

**Objective:** a runnable MCP server exists that exposes one trivial tool, proving the
transport and registration work before any real logic is involved.

**Files created:**
- `mcp_server/__init__.py`
- `mcp_server/server.py`
- `pyproject.toml` (modified — add `fastmcp` dependency)

**Dependencies:** none.

**Implementation notes:**
- `FastMCP("invoiceready")` instance at module level.
- One tool, `ping()`, returning a fixed string. This exists only to verify the plumbing
  and is deleted in M2.
- `if __name__ == "__main__": mcp.run()` — defaults to stdio transport.
- Do not touch `app/` in this task.

**Acceptance criteria:**
- `python -m mcp_server.server` starts without error and does not exit immediately.
- MCP Inspector connects and lists exactly one tool, `ping`.
- `ruff check .` passes.

**Tests required:** none — this is scaffolding, deleted in the next task.

---

### Task M2 — Expose the rules engine as the first real tool

**Objective:** an MCP client can ask "what e-invoicing rules apply to a business with
this profile in this country" and get back structured, cited obligations.

**Files created/modified:**
- `mcp_server/server.py` (modified)
- `mcp_server/schemas.py` (created)
- `tests/test_mcp_tools.py` (created)

**Dependencies:** M1.

**Implementation notes:**
- Tool signature:
  `get_einvoicing_rules(country: str, vat_registered: bool, employee_count: int, annual_turnover_eur: float | None, invoices_to: list[str]) -> RuleLookupResult`
- **Import and call the existing rules engine.** Do not reimplement matching logic.
- Return a Pydantic model containing: `in_scope`, `obligations[]` (each with
  `rule_type`, `applies_from`, `format_required`, `network`, `source_url`,
  `source_reviewed_at`), and `disclaimer`.
- **The docstring is load-bearing** — FastMCP turns it into the tool description the
  model reads when deciding whether to call this tool. Write it as instruction to a
  model, not as a note to a developer. State plainly which countries are covered and
  that it returns official sources.
- Unknown country → return an explicit not-covered result naming the covered countries.
  Never raise a bare exception, and never guess.
- Delete the `ping` tool.

**Acceptance criteria:**
- Calling with a Belgian profile returns the same obligations as `POST /api/assess`
  with the equivalent body. Verify both, compare by hand.
- Every returned obligation carries a non-empty `source_url` and `source_reviewed_at`.
- Calling with `country="IT"` returns a not-covered result, not an error and not a
  fabricated rule.
- Tool description is visible and readable in MCP Inspector.

**Tests required:**
- Parity test: MCP tool output matches rules engine output for three profiles.
- Out-of-scope test: an uncovered country returns the not-covered shape.
- Every obligation in every test response has a source URL.

---

### Task M3 — Expose the knowledge base as MCP resources

**Objective:** an MCP client can read the curated per-country knowledge base directly
as context, not only through tool calls.

**Files modified:**
- `mcp_server/server.py`
- `tests/test_mcp_resources.py` (created)

**Dependencies:** M2.

**Implementation notes:**
- Register one resource per covered country, URI pattern
  `invoiceready://knowledge/{country_code}`.
- Content comes from the same `knowledge_base/{CODE}.md` files the ingestion script
  reads — read from disk, do not duplicate the text.
- Include the `last_reviewed` date in the resource description, since a stale
  compliance source is worse than none.

**Acceptance criteria:**
- Inspector lists one resource per country in the knowledge base.
- Reading `invoiceready://knowledge/BE` returns the full Belgium file.
- Adding a fourth country's markdown file makes a fourth resource appear with no code
  change.

**Tests required:**
- Resource listing matches the set of files in `knowledge_base/`.
- Reading a resource returns non-empty content containing at least one source URL.

---

### Task M4 — Add a coverage-check tool

**Objective:** a client can cheaply ask what the server actually knows before asking a
substantive question — the honest-refusal principle, at protocol level.

**Files modified:**
- `mcp_server/server.py`
- `tests/test_mcp_tools.py`

**Dependencies:** M2.

**Implementation notes:**
- `check_country_coverage(country: str | None = None)` — with no argument, lists every
  covered country with its status and `last_reviewed`; with one, answers for that
  country.
- Reads from the `countries` table. No LLM call. No hardcoded country list.
- Docstring should tell the model to call this first when unsure whether a country is
  supported.

**Acceptance criteria:**
- Returns all covered countries with review dates when called with no argument.
- Returns a clear not-covered answer for an uncovered country.
- Adding a country to the database changes the output with no code change.

**Tests required:**
- Coverage list matches the `countries` table contents.
- Uncovered country returns not-covered, not an error.

---

### Task M5 — Streamable HTTP transport and deployment

**Objective:** the server is reachable over the network, not only as a local
subprocess.

**Files modified:**
- `mcp_server/server.py`
- `Dockerfile` or deployment config
- `README.md`

**Dependencies:** M2 (M3/M4 optional).

**Implementation notes:**
- Support both transports from one entrypoint, selected by env var or CLI flag —
  stdio for local use, `streamable-http` for deployment.
- Bind host and port from environment, never hardcoded.
- **Auth:** the rules data is public information, so no auth is needed for V1 — but say
  so deliberately in the README rather than leaving it unmentioned. If the server ever
  exposes anything user-specific, this decision must be revisited.
- Rate limiting still applies if deployed publicly — same reasoning as the REST API.

**Acceptance criteria:**
- `python -m mcp_server.server` still works locally over stdio, unchanged.
- HTTP mode starts, and Inspector connects to it over the network.
- Deployed URL responds, and every M2/M4 test passes against the deployed instance.

**Tests required:**
- Transport selection test: the correct transport is chosen for each env value.

---

### Task M6 — Wire into Claude Code and document it

**Objective:** you can actually use your own server, and a reader can reproduce it.

**Files modified:**
- `README.md`
- `docs/04-MCP-SERVER.md` (created — a short public-facing version of this document)

**Dependencies:** M5.

**Implementation notes:**
- Register the local server with `claude mcp add`, confirm the tools appear, and use it
  in a real Claude Code session.
- README section covering: what MCP is in two sentences, which tools/resources this
  server exposes, how to run it locally, how to connect it to Claude Code.
- **Include the architecture reasoning** — one front door for humans, one for AI
  clients, one shared engine. That is the part worth reading.
- Take a screenshot of the tools listed in Inspector or Claude Code for the README.

**Acceptance criteria:**
- A stranger can follow the README and have the server running against Claude Code.
- `get_einvoicing_rules` is callable from a real Claude Code session and returns cited
  obligations.
- The README states honestly what this is for.

**Tests required:** none — documentation task.

---

## 5. Known gotchas

**stdio transport and stray stdout.** In stdio mode the protocol *is* stdin/stdout. Any
stray `print()`, or a `subprocess.run` without `capture_output=True`, corrupts the
stream and hangs the server. Use `structlog` to stderr, never print to stdout, and
always capture subprocess output.

**Tool descriptions are prompts, not comments.** The docstring is what the model reads
when deciding whether to call a tool. Vague descriptions produce unreliable invocation.
Be specific about when the tool applies and what it returns.

**Don't expose everything.** A server with four well-described tools beats one with
fifteen vague ones — every tool description consumes the client's context window, and
more surface area means more ways to be called wrongly.

**The disclaimer must survive the protocol boundary.** Every substantive response needs
the "informational guidance only, not tax or legal advice" line. An MCP client will
surface your output to an end user with no other framing around it.

---

## 6. Suggested sequencing

| Day | Work |
|---|---|
| 1 | M1, M2 — scaffold and the rules tool. This is the core; everything after is optional polish. |
| 2 | M3, M4 — resources and coverage check |
| 3 | M5, M6 — HTTP transport, deploy, wire into Claude Code, document |

If you only get one day: **M1 + M2 is enough** to answer the interview question
honestly. M3–M6 make it complete, not credible — it's already credible after M2.

---

## 7. What this gives you to say

After M2, you can say truthfully:

> "I exposed my compliance rules engine as an MCP server so any MCP-compatible client
> could query it. The design decision I'd highlight is that the MCP server is a thin
> wrapper over the same rules engine the REST API uses — two front doors, one source of
> truth, so a rule change propagates to both with no duplication. The tool descriptions
> turned out to matter more than I expected; they're effectively prompts, and vague ones
> make the model call the tool at the wrong times."

That is a specific, honest, technically-grounded answer — which is the actual output of
this work.
