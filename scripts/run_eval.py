"""Score /api/ask against tests/eval_set.yaml.

Calls the real Anthropic API for every non-refusal case - deliberate, per
the plan, since this validates actual end-to-end grounding, not just
plumbing. That means running this costs real money. Not wired into the
default `pytest` collection for exactly that reason - invoke directly:

    python scripts/run_eval.py

Also writes frontend/src/data/eval-results.json - a committed, dated
summary that the /how-it-works page (docs/04-FRONTEND-DESIGN.md #3.5)
reads at build time. That page is a static bundle with no backend of its
own to query for "live" numbers, so this file is the mechanism by which
its eval results are real and dated rather than typed-in copy.
"""

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import yaml
from fastapi.testclient import TestClient

from app.main import app
from app.rate_limit import limiter

EVAL_SET_PATH = Path(__file__).resolve().parent.parent / "tests" / "eval_set.yaml"
RESULTS_PATH = (
    Path(__file__).resolve().parent.parent / "frontend" / "src" / "data" / "eval-results.json"
)

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
        # app/rate_limit.py's 10/minute cap is aimed at the public
        # internet (docs/04-FRONTEND-DESIGN.md #7.4) - this script is a
        # trusted local tool running 58 cases in one sitting, not that,
        # so it resets the limiter per case rather than being throttled
        # by a guard meant for someone else.
        limiter.reset()
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

    write_results_json(
        results, refusal_pass, len(refusal_results), grounded_pass, len(grounded_results)
    )


def write_results_json(
    results: list[tuple[dict[str, Any], bool, str]],
    refusal_pass: int,
    refusal_total: int,
    grounded_pass: int,
    grounded_total: int,
) -> None:
    payload = {
        "generated_at": datetime.now(UTC).isoformat(),
        "total": len(results),
        "passed": refusal_pass + grounded_pass,
        "refusal": {"passed": refusal_pass, "total": refusal_total},
        "grounded": {"passed": grounded_pass, "total": grounded_total},
        # Question text only, not the generated answer or its citations -
        # this file is committed, and the point is "the eval set is real
        # and passing", not a transcript of every model response.
        "cases": [
            {
                "country": case["country"],
                "question": case["question"],
                "expected_refused": case["expected_refused"],
                "passed": passed,
            }
            for case, passed, _detail in results
        ],
    }
    RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    RESULTS_PATH.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"\nWrote {RESULTS_PATH.relative_to(Path.cwd())}")


if __name__ == "__main__":
    main()
