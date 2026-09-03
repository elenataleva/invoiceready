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