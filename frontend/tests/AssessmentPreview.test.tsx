import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { AssessmentPreview } from "@/features/assessment"

/**
 * Runs against the real DemoDataSource and the real committed fixtures
 * (frontend/src/demo/fixtures/), not a stub - the same "test against real
 * data" choice the backend suite makes. A fixture that stops matching the
 * API's shape should fail here.
 *
 * What these guard is the panel's whole reason for existing: before the
 * redesign it rendered nothing but skeletons for the entire intake,
 * because it had no data source to fill them from.
 */
const SETTLED = { timeout: 3000 }

describe("AssessmentPreview - before a country is chosen", () => {
  it("says what the product will deliver instead of showing empty placeholders", async () => {
    render(<AssessmentPreview profile={{}} />)

    expect(await screen.findByText(/what you'll get/i)).toBeVisible()
    expect(screen.getByText(/the exact format and network/i)).toBeVisible()
    expect(screen.getByText(/pick a country/i)).toBeVisible()
  })
})

describe("AssessmentPreview - once a country is chosen", () => {
  it("shows that country's real obligations, dates and formats", async () => {
    render(<AssessmentPreview profile={{ country: "BE" }} />)

    // Plain-language titles, never the raw rule_type.
    expect(
      await screen.findByText(/accepting invoices from your suppliers/i, undefined, SETTLED)
    ).toBeVisible()
    expect(screen.getByText(/sending invoices to your customers/i)).toBeVisible()

    // Real seeded Belgian values (scripts/seed_rules.py).
    expect(screen.getAllByText(/1 Jan 2026/).length).toBeGreaterThan(0)
    expect(screen.getByText("Peppol")).toBeVisible()
    expect(screen.getByText(/Peppol BIS Billing 3\.0/)).toBeVisible()
  })

  it("is explicit that these are the country's general rules, not a personal answer", async () => {
    // #1.4: a general rule must never be mistaken for a finished,
    // profile-specific assessment.
    render(<AssessmentPreview profile={{ country: "BE" }} />)

    expect(await screen.findByText(/in general/i, undefined, SETTLED)).toBeVisible()
    expect(screen.getByText(/answer 2 more questions/i)).toBeVisible()
  })

  it("counts down the remaining questions as the profile fills in", async () => {
    render(
      <AssessmentPreview
        profile={{
          country: "FR",
          vatRegistered: true,
          employeeBand: "10-49",
          turnoverBand: "100k_500k",
        }}
      />
    )

    expect(await screen.findByText(/answer 1 more question to/i, undefined, SETTLED)).toBeVisible()
  })

  it("surfaces a phased cohort as its own line rather than inside the heading", async () => {
    // France splits issuing by company size; the qualifier lives inside
    // rule_type and would be unreadable rendered as a badge.
    render(<AssessmentPreview profile={{ country: "FR" }} />)

    expect(await screen.findByText(/SMEs and micro-enterprises/i, undefined, SETTLED)).toBeVisible()
    expect(screen.getAllByText(/sending invoices to your customers/i).length).toBeGreaterThan(1)
  })

  it("says so plainly when a country has nothing on file", async () => {
    render(<AssessmentPreview profile={{ country: "ZZ" }} />)

    expect(await screen.findByText(/nothing on file/i, undefined, SETTLED)).toBeVisible()
  })
})
