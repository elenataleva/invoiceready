export type ObligationKind = "receive" | "issue" | "other"

export interface PlainRule {
  kind: ObligationKind
  /** What the business actually has to do, in words a non-accountant recognises. */
  title: string
  /** One sentence on what changes in practice. */
  meaning: string
  /** The cohort qualifier the backend packs into rule_type's parentheses, if any. */
  cohort: string | null
}

// Cohort qualifiers arrive inside rule_type itself, e.g.
// "issue (large taxpayers: 2024 turnover over PLN 200 million)" -
// app/rules_engine.py can't model those segments, so scripts/seed_rules.py
// names them in the string instead. Rendered as a badge they're unreadable;
// split out, they become a plain "who this applies to" line.
const COHORT = /^([^(]+?)\s*\((.+)\)\s*$/

const COPY: Record<Exclude<ObligationKind, "other">, { title: string; meaning: string }> = {
  receive: {
    title: "Accepting invoices from your suppliers",
    meaning:
      "Your suppliers will send invoices as structured data files instead of PDFs. Your accounting software has to be able to receive them - if it can't, their invoices won't reach you.",
  },
  issue: {
    title: "Sending invoices to your customers",
    meaning:
      "Your own invoices must be issued as structured data and sent over the official network. Emailing a PDF on its own no longer counts as a legal invoice.",
  },
}

/**
 * Turns a raw `rule_type` into something a small business owner can read.
 *
 * The API deliberately returns the compliance term verbatim (the LLM never
 * gets to reword a legal classification), so the translation belongs here,
 * at the point of display, where it can be checked against the original.
 */
export function toPlainRule(ruleType: string): PlainRule {
  const match = COHORT.exec(ruleType)
  const base = (match ? match[1] : ruleType).trim().toLowerCase()
  const cohort = match ? match[2].trim() : null

  const kind: ObligationKind = base === "receive" ? "receive" : base === "issue" ? "issue" : "other"

  if (kind === "other") {
    // An unrecognised rule_type is shown as-is rather than guessed at -
    // a wrong plain-language gloss on a compliance term is worse than the
    // jargon it replaces.
    return { kind, title: ruleType, meaning: "", cohort }
  }

  return { ...COPY[kind], kind, cohort }
}

/** Sentence-cases a cohort string that was written to sit inside parentheses. */
export function formatCohort(cohort: string): string {
  return cohort.charAt(0).toUpperCase() + cohort.slice(1)
}

const KIND_ORDER: Record<ObligationKind, number> = { receive: 0, issue: 1, other: 2 }

/**
 * Sorts by date, then puts "accepting" before "sending" on the same date.
 *
 * A display concern, not an API one: the backend's stable `applies_from,
 * rule_type` ordering is alphabetical, which lands "issue" first. Reading
 * order should follow the obligation's logic instead - being able to
 * receive an invoice is the universal, unconditional half in all three
 * countries, while issuing is what gets phased by company size.
 */
export function byReadingOrder<T extends { rule_type: string; applies_from: string }>(
  rules: T[]
): T[] {
  return [...rules].sort((a, b) => {
    if (a.applies_from !== b.applies_from) return a.applies_from < b.applies_from ? -1 : 1
    return KIND_ORDER[toPlainRule(a.rule_type).kind] - KIND_ORDER[toPlainRule(b.rule_type).kind]
  })
}
