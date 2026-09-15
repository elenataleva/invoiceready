import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { Obligation } from "@/api/client"
import { DeadlineStrip } from "@/features/assessment/DeadlineStrip"
import { ObligationCard } from "@/features/assessment/ObligationCard"
import { VerdictCard } from "@/features/assessment/VerdictCard"

import beFixture from "@/demo/fixtures/assess/be-in-scope.json"

const OBLIGATIONS = beFixture.response.obligations as Obligation[]

function withDate(obligation: Obligation, applies_from: string): Obligation {
  return { ...obligation, applies_from }
}

const FAR_FUTURE = "2099-01-01"
const LONG_PAST = "2020-01-01"

describe("the undefined / empty distinction", () => {
  // #3.2: `undefined` means "still loading", `[]` means "we asked and the
  // answer is none". Collapsing them would present a half-loaded page as a
  // finished assessment.
  it("shows a skeleton while loading, not an answer", () => {
    const { container } = render(<VerdictCard obligations={undefined} />)

    expect(container.querySelector(".animate-pulse")).not.toBeNull()
    expect(screen.queryByText(/no e-invoicing obligations/i)).not.toBeInTheDocument()
  })

  it("shows the real 'nothing applies' answer for an empty list", () => {
    render(<VerdictCard obligations={[]} />)

    expect(screen.getByText(/no e-invoicing obligations apply/i)).toBeVisible()
  })

  it("renders no deadline at all when nothing applies", () => {
    const { container } = render(<DeadlineStrip obligations={[]} />)

    expect(container).toBeEmptyDOMElement()
  })
})

describe("DeadlineStrip", () => {
  it("reads a passed deadline as in force, not as a missed countdown", () => {
    // The bug this replaces: a bare "8 months ago" under a legal deadline
    // suggests the visitor missed a window that is in fact simply open.
    render(<DeadlineStrip obligations={[withDate(OBLIGATIONS[0], LONG_PAST)]} />)

    expect(screen.getByText(/in force now/i)).toBeVisible()
    expect(screen.getByText(/^Started/)).toBeVisible()
  })

  it("reads a future deadline as not yet in force", () => {
    render(<DeadlineStrip obligations={[withDate(OBLIGATIONS[0], FAR_FUTURE)]} />)

    expect(screen.getByText(/not yet in force/i)).toBeVisible()
    expect(screen.getByText(/^Starts/)).toBeVisible()
  })

  it("shows the earliest date when obligations start on different days", () => {
    render(
      <DeadlineStrip
        obligations={[
          withDate(OBLIGATIONS[0], "2027-09-01"),
          withDate(OBLIGATIONS[0], "2026-02-01"),
        ]}
      />
    )

    expect(screen.getByText("1 Feb 2026")).toBeVisible()
    expect(screen.queryByText("1 Sept 2027")).not.toBeInTheDocument()
  })
})

describe("ObligationCard", () => {
  it("leads with what to do, and never shows the raw compliance term", () => {
    render(<ObligationCard obligation={OBLIGATIONS.find((o) => o.rule_type === "receive")} />)

    expect(
      screen.getByRole("heading", { name: /accepting invoices from your suppliers/i })
    ).toBeVisible()
    expect(screen.queryByText("receive")).not.toBeInTheDocument()
  })

  it("keeps every factual field the API returned, each with its source", () => {
    const obligation = OBLIGATIONS[0]
    render(<ObligationCard obligation={obligation} />)

    expect(screen.getByText(obligation.format_required!)).toBeVisible()
    expect(screen.getByText(obligation.network!)).toBeVisible()
    expect(screen.getByRole("link")).toHaveAttribute("href", obligation.source_url)
  })

  it("puts a cohort qualifier on its own 'Applies to' line", () => {
    render(
      <ObligationCard
        obligation={{
          ...OBLIGATIONS[0],
          rule_type: "issue (large taxpayers: 2024 turnover over PLN 200 million)",
        }}
      />
    )

    expect(screen.getByText(/applies to/i)).toBeVisible()
    expect(screen.getByText(/large taxpayers/i)).toBeVisible()
    expect(
      screen.getByRole("heading", { name: /sending invoices to your customers/i })
    ).toBeVisible()
  })
})
