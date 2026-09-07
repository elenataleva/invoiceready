"""Score /api/ask against tests/eval_set.yaml.

Calls the real Anthropic API for every non-refusal case - deliberate, per
the plan, since this validates actual end-to-end grounding, not just
plumbing. That means running this costs real money. Not wired into the
default `pytest` collection for exactly that reason - invoke directly:

    python scripts/run_eval.py
"""

from pathlib import Path
from typing import Any

import yaml
from fastapi.testclient import TestClient

from app.main import app

EVAL_SET_PATH = Path(__file__).resolve().parent.parent / "tests" / "eval_set.yaml"

client = TestClient(app)


def run_case(case: dict[str, Any]) -> tuple[bool, str]:
    response = client.post(
        "/api/ask",
        json={"country": case["country"], "question": case["question"]},
    )
    body = response.json()

    if body["refused"] != case["expected_refused"]:
        return False, f"expected refused={case['expected_refused']}, got {body['refused']}"

    if not case["expected_refused"]:
        expected_substring = case["expected_source_contains"]
        if not any(expected_substring in url for url in body["citations"]):
            return False, f"no citation contains {expected_substring!r}: {body['citations']}"

    return True, "ok"


def main() -> None:
    cases: list[dict[str, Any]] = yaml.safe_load(EVAL_SET_PATH.read_text())

    results: list[tuple[dict[str, Any], bool, str]] = []
    for case in cases:
        passed, detail = run_case(case)
        results.append((case, passed, detail))
        status = "PASS" if passed else "FAIL"
        print(f"[{status}] ({case['country']}) {case['question'][:60]!r} - {detail}")

    refusal_results = [r for r in results if r[0]["expected_refused"]]
    grounded_results = [r for r in results if not r[0]["expected_refused"]]

    refusal_pass = sum(1 for _, passed, _ in refusal_results if passed)
    grounded_pass = sum(1 for _, passed, _ in grounded_results if passed)

    print()
    print(f"Refusal cases:  {refusal_pass}/{len(refusal_results)} passed")
    print(f"Grounded cases: {grounded_pass}/{len(grounded_results)} passed")
    print(f"Overall:        {refusal_pass + grounded_pass}/{len(results)} passed")

    if refusal_pass < len(refusal_results):
        print(
            "\nWARNING: not all refusal cases passed. Per CLAUDE.md, refusal "
            "is non-negotiable - this must be 100% before this system can "
            "be trusted not to hallucinate."
        )


if __name__ == "__main__":
    main()
