# InvoiceReady — Claude Code Playbook
How to actually build this, task by task, without re-typing your instructions every time.

---

## 1. Your proposed workflow — reviewed

Your instinct was:

> Business requirements → Functional requirements → Technical architecture → Data/API design → Project setup → Implementation → Testing → Deployment

**This is correct.** It's essentially spec-driven development, and it's how experienced people work with coding agents: write the spec first, let the agent implement against it. Most beginners skip straight to "build me an app" and then spend days undoing an architecture nobody chose.

Your per-task prompt (inspect repo → identify files → implement → run tests → report → stop) is also right, especially the **"do not move on to the next task"** line. That single constraint prevents the most common failure mode: an agent racing ahead and generating 2,000 lines you don't understand.

**What was missing — five corrections:**

1. **You should not paste that prompt every time.** Put always-true rules in `CLAUDE.md` (auto-loaded every session) and the repeatable ritual in a skill you invoke as `/implement-task`.
2. **Use plan mode before implementing.** `/plan` makes Claude design an approach without touching files. Review the plan, then let it execute. Catching a bad approach in a plan costs seconds; catching it in code costs an evening.
3. **Commit after every task.** One task = one commit. This gives you a working state to return to, and produces the real commit history that makes the repo credible.
4. **Don't test everything from day one.** Test the rules engine, retrieval, and refusal behaviour. Skip unit tests for template rendering.
5. **You must read the code.** The point is to learn. After each task, ask Claude to walk you through what it wrote before you accept it — there's a `/explain-last` skill below for exactly this.

**Recommended order** (slightly adjusted from yours — knowledge base before retrieval, because retrieval over an empty corpus is untestable):

```
Setup → Data layer → Knowledge base content → Ingestion → Retrieval
→ Rules engine → LLM layer → API → Evaluation → UI → Observability → Deploy
```

---

## 2. Files to create before writing any code

### `CLAUDE.md` (repo root — copy this)

```markdown
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
```

### `.claude/skills/implement-task/SKILL.md`

```markdown
---
name: implement-task
description: Implement a single numbered task from docs/03-IMPLEMENTATION-PLAN.md following the project working agreement.
---

# Implement Task

The user will give you a task number from `docs/03-IMPLEMENTATION-PLAN.md`.

## Before changing anything
1. Read the task definition in the implementation plan.
2. Inspect the current repository structure.
3. Re-read the relevant sections of `docs/02-TECHNICAL-DESIGN.md`.
4. List the files you will create or modify, and why.
5. Flag any dependency on a task that isn't done yet — stop if blocked.

## While implementing
- Only touch files needed for THIS task.
- Follow every rule in CLAUDE.md.
- Write the tests specified in the task's "tests required" section.

## After implementing
1. Run `pytest` and report results.
2. Run `ruff check . && ruff format --check .` and fix issues.
3. Report: files changed, assumptions made, anything you couldn't do.
4. Verify each acceptance criterion explicitly, one by one.
5. Propose a commit message. Do NOT commit without approval.

## Stop
Do not begin the next task. Wait for the user.
```

### `.claude/skills/explain-last/SKILL.md`

```markdown
---
name: explain-last
description: Explain the code just written, for someone learning. Use after completing a task.
---

# Explain Last Change

Walk me through what you just built, assuming I'm competent but new to
Python and AI systems. Cover:

1. What each new file/function does and why it exists
2. Any Python idiom I might not know (decorators, context managers,
   generators, type hints, async) — explain it briefly where it appears
3. Why you chose this approach over the obvious alternative
4. What would break this, and what isn't handled yet
5. One thing I should understand deeply before moving on

Be concrete and reference actual line ranges. No filler praise.
```

### `.claude/skills/review-task/SKILL.md`

```markdown
---
name: review-task
description: Critically review the most recent task implementation before committing.
---

# Review Task

Review the current uncommitted changes as a skeptical senior engineer.
Report on:

- Does it actually satisfy every acceptance criterion? Name any that don't.
- Any violation of CLAUDE.md rules (especially: LLM deciding dates,
  missing citations, missing refusal path, secrets, untyped functions)?
- Error handling: what happens on API timeout, empty retrieval, bad input?
- Anything over-engineered that should be simpler?
- Missing tests for realistic failure cases?

Be direct. Do not praise. If it's fine, say so briefly and stop.
```

---

## 3. Generating the implementation plan

Once the repo has `CLAUDE.md` and both spec docs in `docs/`, run this **once**, in plan mode:

```
Read docs/01-BUSINESS-PLAN.md and docs/02-TECHNICAL-DESIGN.md.

Produce docs/03-IMPLEMENTATION-PLAN.md: V1 broken into small,
independently implementable, sequentially ordered tasks. Each task
should be completable in one focused session (roughly 30-90 minutes).

For each task:
- Task number and name
- Objective (one sentence: what is true after this that wasn't before)
- Files created or modified
- Dependencies (which task numbers must be done first)
- Implementation notes (specific enough to act on, not a rewrite of the design doc)
- Acceptance criteria (observable and checkable — not "works well")
- Tests required (or explicitly "none, and why")

Rules:
- No task should require me to understand more than one new concept.
- Order so something runnable exists as early as possible.
- Include the evaluation set as its own task, before the UI.
- Do not write any code yet. Output only the plan.
```

Read the plan. Push back on anything unclear. This document becomes your source of truth.

---

## 4. The build loop (repeat per task)

```
1.  /plan  →  "Plan task 4."          Review the approach. Correct it if wrong.
2.  /implement-task 4                 Claude builds it, tests, reports.
3.  /explain-last                     You learn what was built. Ask questions.
4.  /review-task                      Catch problems before they're committed.
5.  Run it yourself.                  Actually execute it. Don't trust the report.
6.  git add -p && git commit          One task, one commit, real message.
7.  /clear                            Fresh context for the next task.
```

**Step 7 matters more than it looks.** Long sessions accumulate irrelevant context, which degrades output quality and burns tokens. `/clear` between tasks is free — `CLAUDE.md` reloads automatically, so nothing important is lost.

**When something goes wrong,** don't argue with the agent in a long thread. Ask:
```
That's not right. Before changing anything: explain what you think the
current behaviour is and why, and what evidence you have for that. Then
propose a fix, but don't apply it yet.
```

---

## 5. Useful built-in commands

| Command | Use |
|---|---|
| `/init` | Run once at the start — scans the project and generates a first `CLAUDE.md` you then edit |
| `/plan` | Design an approach without touching files |
| `/clear` | Wipe context between tasks |
| `/context` | See how much of the context window you're using |
| `/memory` | View/edit persistent project memory |
| `/skills` | List available skills, debug ones not triggering |
| `#` prefix | Quick memory add mid-chat: `# always use pathlib, not os.path` |

---

## 6. Week-by-week plan

| Week | Focus | Outcome |
|---|---|---|
| 1 | Setup, `CLAUDE.md`, skills, implementation plan, DB schema + migrations, Belgium knowledge base researched and written by hand | Schema migrates cleanly; one country documented with sources |
| 2 | Ingestion script, embeddings, pgvector retrieval, Poland + France | Retrieval returns correct chunks for known questions |
| 3 | Rules engine, LLM layer with grounding + citations, `/api/assess` and `/api/ask` | Working API returning grounded, cited answers |
| 4 | Evaluation set (30 questions + 8 refusal cases), threshold tuning, logging, guardrail hardening | Eval passes; refusals work; every call logged |
| 5 | Jinja2 UI, Dockerfile, Railway deploy, README, demo video, solution brief | Live public URL |

**Week 1 is mostly not coding.** Researching and writing the Belgium knowledge base by hand is the highest-value work in this project — it's the moat, and it's the part an agent cannot do for you, because it requires judgment about which sources are authoritative.

---

## 7. Rules for yourself

1. **Never accept code you don't understand.** Use `/explain-last` every time. If it's still unclear, ask again. Understanding is the actual deliverable — the app is a side effect.
2. **Run everything yourself.** "Tests pass" in a report is not the same as tests passing on your machine.
3. **One task, one commit.** Your commit history is part of the portfolio.
4. **Set a spend cap** in the Anthropic console before the first API call.
5. **When you're stuck for more than 30 minutes, that's the learning moment** — paste the error and ask *why* it happens, not just for a fix.
6. **Don't add features mid-build.** Write the idea in a `BACKLOG.md` and keep going. Scope creep is what kills solo projects, not technical difficulty.
