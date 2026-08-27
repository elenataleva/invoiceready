# InvoiceReady — Business Requirements & Plan
**EU e-invoicing compliance assistant for small businesses**

Version 1.0 · Owner: Elena Taleva

---

## 1. Problem statement

EU member states are rolling out mandatory structured B2B e-invoicing on **staggered, country-specific timelines**. Belgium's mandate went live 1 January 2026 on the Peppol network; Poland's KSeF phases in from February to April 2026 by company size; France requires all VAT-registered businesses to be able to *receive* e-invoices from 1 September 2026; Germany's issuance requirement phases through 2028. The EU-wide floor for intra-EU B2B transactions is 1 July 2030 under the ViDA package.

The obligation reaches far beyond large corporates — it covers freelancers, consultants, and small companies that issue invoices.

**The pain is not the invoice format. The pain is the confusion.** A 3-person agency in Belgium receives a notice saying they must now issue structured e-invoices. They do not know:

- whether the mandate actually applies to *them* (size thresholds, exemptions, B2B vs B2C)
- what their real deadline is
- what "EN 16931", "UBL 2.1", "Peppol BIS 3.0" mean or which one they need
- what to actually do next week

Existing vendors (Banqup, Invoxo, Billed, and others) solve the *conversion and transmission* problem well — but they are built for buyers who already know they need e-invoicing and often have an accountant or finance function driving it. The confused micro-business with no finance team is underserved.

## 2. Target customer (V1)

**Primary:** VAT-registered businesses with 1–20 employees in countries where a mandate is live or imminent (Belgium, Poland, France first), who do not have an in-house finance team.

**Secondary (V2, higher value):** small accounting/bookkeeping practices who advise 20–100 such clients and need to answer the same questions repeatedly.

**Explicitly not targeting:** enterprises, multinationals, or anyone with a tax director. They are already served and the sales cycle is long.

### Why this buyer
- Real deadline, real fines — urgency is externally imposed, not something you have to manufacture
- Too small to be a priority for existing vendors
- Reachable without an enterprise sales motion (accountant partnerships, local business associations, SEO on "[country] e-invoicing deadline")

## 3. Value proposition

> "Tell us your country, size, and who you invoice. We'll tell you in plain language exactly what applies to you, when, and what to do — then help you get your invoices into the right format."

Three things, in priority order:
1. **Clarity** — am I affected, when, and what does it mean? (the wedge)
2. **Readiness check** — are my current invoices missing required fields?
3. **Conversion** — turn my existing invoice data into a compliant structured file

## 4. Scope

### V1 — Compliance Navigator (the MVP, build this first)
- Guided intake: country, VAT status, business size, invoice counterparties (B2B / B2C / B2G)
- Plain-language answer: does this apply to me, what is my deadline, which format/network, what are the next 3 concrete steps
- Q&A follow-up grounded in a curated knowledge base of per-country rules
- **Every answer cites its source** (tax authority page, EU directive, official guidance) — non-negotiable for trust in a compliance product
- Explicit refusal to answer outside the knowledge base rather than guessing

### V2 — Invoice Readiness Check
- Upload a CSV or PDF invoice export
- Validate against required EN 16931 fields for the user's country
- Report what's missing or malformed, in plain language, with how to fix it

### V3 — Conversion (stretch, only if V1/V2 get real users)
- Generate valid UBL 2.1 / Peppol BIS 3.0 XML output
- Human reviews and submits — **the product never files anything with a tax authority automatically**

### Out of scope, deliberately
- Actual transmission to tax authority portals (regulated, requires certification in several countries)
- Accounting or bookkeeping features
- Anything that constitutes formal tax or legal advice

## 5. Guardrails and legal positioning

This is a compliance-adjacent product. These are product requirements, not nice-to-haves:

| Requirement | Why |
|---|---|
| Prominent disclaimer: informational guidance, not tax or legal advice; verify with a qualified advisor | Reduces liability; standard for this category |
| Every substantive claim cites a source with a date | Rules change; users must be able to verify |
| "Last reviewed" date shown per country | A stale compliance answer is worse than no answer |
| The system says "I don't know — here's the official source" rather than guessing | Hallucinated compliance advice is the single biggest risk to this product |
| No automated filing or submission | Keeps the product outside regulated activity |
| Human-in-the-loop on any generated invoice file | User owns the final artifact |

## 6. Content strategy — the real moat

The AI is not the moat. **The curated, dated, sourced country rules knowledge base is the moat.** Anyone can wire up RAG in a weekend; keeping 5 countries' rules accurate and current is ongoing work most people won't do.

**V1 knowledge base scope: 3 countries only** — Belgium, Poland, France. Depth over breadth. Add Germany, Spain, Netherlands in V2.

Per country, capture:
- Who is in scope (thresholds, sector, VAT status)
- Exact dates and phases
- Required format(s) and network
- Penalties for non-compliance
- Official source URL + date reviewed
- Common exemptions

## 7. Business model (for later — do not build billing in V1)

- **Free tier:** the compliance navigator. This is the lead magnet and the SEO surface.
- **Paid (~€19–39/month):** readiness checks, saved profile, deadline reminders, multi-country.
- **Partner tier (later):** small accounting practices, per-client seats.

Validate willingness to pay through conversations before writing a single line of billing code.

## 8. Go-to-market (first 10 users)

1. **SEO/content** — one high-quality page per country per question ("Belgium e-invoicing 2026: does it apply to my business?"). This category has genuine, dated search intent.
2. **Accountant outreach** — small NL/BE practices field these questions constantly. Offer the tool free as something they can send clients.
3. **Build-in-public on LinkedIn/X** — ties directly into your existing content plan; a compliance deadline is a naturally shareable hook.
4. **Local business associations / chambers of commerce** — they publish member guidance and need exactly this.

## 9. Success criteria

**Portfolio success (guaranteed if you finish):**
- Live, deployed, publicly accessible URL
- Public GitHub repo with real commit history and an architecture README
- Working evaluation set proving the system doesn't hallucinate
- A 3–5 minute demo video
- A one-page solution brief (problem → solution → who pays → why)

**Business success (aspirational, not required):**
- 50 unique users running the navigator
- 10 conversations with real small business owners or accountants
- 3 people saying they would pay

## 10. Risks and honest concerns

| Risk | Severity | Mitigation |
|---|---|---|
| Rules change and the knowledge base goes stale | High | Show "last reviewed" dates; limit to 3 countries; monthly review ritual |
| Hallucinated compliance advice | High | Strict grounding, citations required, refuse-when-unsure, evaluation set |
| Existing vendors move down-market | Medium | Your edge is the confused-beginner experience, not conversion tech |
| Building conversion (V3) is much harder than it looks | Medium | Treat V1 as the product; V2/V3 only after real users exist |
| Losing interest before shipping | **Highest, realistically** | V1 is deliberately small — ~4–5 weeks. Ship it, then decide. |

## 11. Timeline

| Week | Milestone |
|---|---|
| 1 | Repo, environment, CLAUDE.md, knowledge base for Belgium researched and written |
| 2 | Retrieval working, grounded Q&A with citations, Poland + France added |
| 3 | Intake flow, structured recommendation output, evaluation set |
| 4 | Web UI, logging/observability, guardrail hardening |
| 5 | Deploy live, README, demo video, solution brief |

V2 (readiness check) is a separate 4–6 week effort. Do not start it during weeks 1–5.
