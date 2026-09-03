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