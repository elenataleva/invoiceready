import { describe, expect, it } from "vitest"

import { byReadingOrder, formatCohort, toPlainRule } from "@/features/assessment/ruleLanguage"

// The rule_type strings below are the real ones scripts/seed_rules.py
// writes - not invented shapes. If seeding changes its vocabulary, these
// tests are what catches the UI silently falling back to raw jargon.

describe("toPlainRule", () => {
  it("turns the two bare compliance terms into what the business must do", () => {
    expect(toPlainRule("receive")).toMatchObject({
      kind: "receive",
      title: "Accepting invoices from your suppliers",
      cohort: null,
    })
    expect(toPlainRule("issue")).toMatchObject({
      kind: "issue",
      title: "Sending invoices to your customers",
      cohort: null,
    })
  })

  it("splits a cohort qualifier out of rule_type instead of rendering it inline", () => {
    const plain = toPlainRule("issue (large taxpayers: 2024 turnover over PLN 200 million)")

    expect(plain.kind).toBe("issue")
    expect(plain.title).toBe("Sending invoices to your customers")
    expect(plain.cohort).toBe("large taxpayers: 2024 turnover over PLN 200 million")
    // The qualifier must not leak into the heading - that's the unreadable
    // badge this whole mapping exists to replace.
    expect(plain.title).not.toContain("PLN")
  })

  it.each([
    "issue (all other VAT taxpayers, including sole traders and SMEs)",
    "issue (large enterprises and ETI)",
    "issue (SMEs and micro-enterprises)",
  ])("handles the seeded cohort string %s", (ruleType) => {
    const plain = toPlainRule(ruleType)
    expect(plain.kind).toBe("issue")
    expect(plain.cohort).not.toBeNull()
  })

  it("shows an unrecognised rule_type verbatim rather than guessing at it", () => {
    // A wrong plain-language gloss on a legal classification is worse than
    // the jargon it replaces, so "other" deliberately passes the term through.
    const plain = toPlainRule("report")

    expect(plain.kind).toBe("other")
    expect(plain.title).toBe("report")
    expect(plain.meaning).toBe("")
  })
})

describe("formatCohort", () => {
  it("sentence-cases a qualifier written to sit inside parentheses", () => {
    expect(formatCohort("large enterprises and ETI")).toBe("Large enterprises and ETI")
  })
})

describe("byReadingOrder", () => {
  it("puts accepting before sending when both start on the same date", () => {
    // The API orders by (applies_from, rule_type), which is alphabetical
    // and lands "issue" first. Receiving is the unconditional half in all
    // three countries, so it should lead.
    const sorted = byReadingOrder([
      { rule_type: "issue", applies_from: "2026-01-01" },
      { rule_type: "receive", applies_from: "2026-01-01" },
    ])

    expect(sorted.map((rule) => rule.rule_type)).toEqual(["receive", "issue"])
  })

  it("still sorts by date first, across cohorts", () => {
    const sorted = byReadingOrder([
      { rule_type: "issue (SMEs and micro-enterprises)", applies_from: "2027-09-01" },
      { rule_type: "issue (large enterprises and ETI)", applies_from: "2026-09-01" },
      { rule_type: "receive", applies_from: "2026-09-01" },
    ])

    expect(sorted.map((rule) => rule.applies_from)).toEqual([
      "2026-09-01",
      "2026-09-01",
      "2027-09-01",
    ])
    expect(sorted[0].rule_type).toBe("receive")
  })

  it("does not mutate the array it was given", () => {
    const rules = [
      { rule_type: "issue", applies_from: "2026-01-01" },
      { rule_type: "receive", applies_from: "2026-01-01" },
    ]
    byReadingOrder(rules)

    expect(rules[0].rule_type).toBe("issue")
  })
})
