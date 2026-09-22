# InvoiceReady — MCP Server

The rules engine behind InvoiceReady, exposed over the Model Context Protocol
so an AI client can query it directly.

> Implementation plan and task breakdown: `docs/04-MCP-IMPLEMENTATION-PLAN.md`.
> Setup and run instructions: the MCP section of `README.md`.

---

## 1. What this is, and what it isn't

Before MCP, every AI application that wanted to reach an external tool needed
bespoke glue for that specific pairing. MCP standardises it: a JSON-RPC
contract between clients and servers, so one server works with every
MCP-compatible client.

This server exposes InvoiceReady's EU e-invoicing rules engine over that
contract. Two tools and a set of per-country resources, reading the same
database the REST API reads.

**It was built to understand the protocol.** InvoiceReady has no external
users, so nobody is currently integrating this. The plausible consumer is a
small accounting practice running an internal AI assistant that could answer
client questions about e-invoicing deadlines without rebuilding a knowledge
base — the "build once, reused by many clients" pattern MCP exists for. That
is a real use case, but it is not a current one, and describing this as an
integration platform would be overselling a two-day build.

## 2. What it exposes

### Tools

**`get_einvoicing_rules(country, vat_registered, employee_count, annual_turnover_eur, invoices_to)`**

Which e-invoicing obligations apply to one business. Returns each obligation's
`rule_type`, `applies_from`, `format_required`, `network`, `source_url` and
`source_reviewed_at`, plus the disclaimer.

Two separate booleans, deliberately:

| Field | Means |
|---|---|
| `covered` | Whether this server has any rules for the country at all |
| `in_scope` | Whether any obligation applies to this particular business |

`covered: false` is an admission of ignorance. `covered: true, in_scope: false`
is a finding. Collapsing them into one flag would let a client report "no
obligations apply" about a country the server has never heard of.

**`check_country_coverage(country=None)`**

What the server knows, and how current it is: every covered country with its
status and `last_reviewed` date, or the answer for one country. A single
database read, no generation. Intended to be called before promising an
answer about a country.

### Resources

`invoiceready://knowledge/{CODE}` — the curated per-country markdown, readable
as context rather than through a tool call. One resource per file in
`knowledge_base/`, so adding a country file adds a resource with no code
change. Each description carries the review date, since a stale compliance
source is worse than no source.

## 3. The design decision worth explaining

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

**The MCP server is a thin wrapper, not a second brain.** It imports and calls
`get_applicable_rules` rather than reimplementing rule matching. A rule changed
in the database propagates to both front doors immediately, because there is
only one place the logic lives. A test asserts the MCP tool returns exactly
what `POST /api/assess` returns for the same business profile, so divergence
fails the build rather than being discovered by a user.

One consequence is that the MCP tools make **no LLM call at all**. The REST API
spends a Claude call turning a rule row into plain-language prose because a
browser cannot do that itself; an MCP client already has a model on the other
side of the call. So the server ships facts and sources, and the client writes
the prose. That makes the tools free to serve and removes the cost argument for
rate limiting them.

## 4. Grounding rules cross the protocol boundary

Everything in `CLAUDE.md` still holds, and the protocol boundary is exactly
where it would be tempting to let it slip:

- Deadlines, thresholds and formats come from the `rules` table via
  deterministic code. The model never decides a date.
- Every obligation carries a `source_url` and the date that source was last
  reviewed. A test asserts this for every obligation in every response.
- An uncovered country returns an explicit not-covered result naming the
  countries that *are* covered, never a fabricated rule and never a bare
  exception.
- Every substantive response carries the disclaimer. An MCP client surfaces
  output to an end user with no other framing around it, so the disclaimer has
  to travel with the data rather than live in a UI template.

## 5. Things learned worth repeating

**Tool descriptions are prompts, not comments.** FastMCP turns each docstring
into the description the model reads when deciding whether to call a tool.
Vague descriptions produce unreliable invocation. These are written as
instructions to a model — when the tool applies, what it returns, and what
mistake to avoid — and tests assert the load-bearing parts stay in them.

**A small surface beats a large one.** Two well-described tools beat fifteen
vague ones: every description consumes the client's context window, and more
surface area means more ways to be called wrongly.

**In stdio mode, stdout is the protocol.** A stray `print()` corrupts the
stream and hangs the server. Logging goes to stderr, and a test asserts the
server writes zero bytes to stdout at startup.

**Import cost is a design constraint.** The knowledge base header is re-parsed
in `mcp_server/` rather than imported from `scripts/ingest.py`, because that
module imports `app.embeddings`, which loads an ONNX embedding model at import
time. A stdio server is spawned per session, so it would pay that cost every
time to read three header fields. A test pins the two parsers together so they
cannot drift.

## 6. Status

| | |
|---|---|
| Transports | stdio and Streamable HTTP, selected by `MCP_TRANSPORT` |
| Auth | None, deliberately — everything exposed is public information. Revisit the moment anything user-specific is exposed |
| Rate limiting | None yet. The tools make no LLM call, so the exposure is database load rather than cost |
| Deployed | Config exists in `render.yaml`; see the README for current state |
