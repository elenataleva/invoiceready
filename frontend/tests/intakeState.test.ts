import { describe, expect, it } from "vitest"

import { isComplete, toAssessRequest } from "@/features/intake/types"
import { parseIntakeState, writeIntakeState } from "@/features/intake/useIntakeState"

/**
 * The URL *is* the profile (docs/04-FRONTEND-DESIGN.md #5.1): /result reads
 * the same encoding the wizard writes, which is what makes a result
 * shareable and refresh-safe without a session. A change to either half
 * that isn't matched in the other silently breaks shared links.
 */
describe("intake URL encoding", () => {
  it("round-trips a complete profile unchanged", () => {
    const profile = {
      country: "BE",
      vatRegistered: true,
      employeeBand: "10-49",
      turnoverBand: "100k_500k",
      invoicesTo: ["B2B", "B2G"],
    } as const

    const params = new URLSearchParams()
    writeIntakeState(params, profile)

    expect(parseIntakeState(params)).toEqual(profile)
  })

  it("round-trips vatRegistered: false without losing it to a falsy check", () => {
    // "0" and undefined are different answers - one is "no", the other is
    // "not asked yet", and only the second should re-open the question.
    const params = new URLSearchParams()
    writeIntakeState(params, { country: "FR", vatRegistered: false })

    expect(parseIntakeState(params).vatRegistered).toBe(false)
  })

  it("leaves unanswered questions undefined rather than defaulting them", () => {
    const parsed = parseIntakeState(new URLSearchParams("country=PL"))

    expect(parsed.country).toBe("PL")
    expect(parsed.vatRegistered).toBeUndefined()
    expect(parsed.invoicesTo).toBeUndefined()
  })

  it("survives a half-finished intake, so a refresh resumes rather than restarts", () => {
    const params = new URLSearchParams()
    writeIntakeState(params, { country: "PL", vatRegistered: true })

    const parsed = parseIntakeState(params)
    expect(isComplete(parsed)).toBe(false)
    expect(parsed.country).toBe("PL")
  })
})

describe("isComplete", () => {
  const complete = {
    country: "BE",
    vatRegistered: true,
    employeeBand: "10-49",
    turnoverBand: "100k_500k",
    invoicesTo: ["B2B"],
  } as const

  it("accepts a fully answered profile", () => {
    expect(isComplete(complete)).toBe(true)
  })

  it("rejects an empty counterparty list, which is a question not really answered", () => {
    expect(isComplete({ ...complete, invoicesTo: [] })).toBe(false)
  })
})

describe("toAssessRequest", () => {
  it("resolves bands to the numbers the rules engine compares against", () => {
    const request = toAssessRequest({
      country: "BE",
      vatRegistered: true,
      employeeBand: "10-49",
      turnoverBand: "100k_500k",
      invoicesTo: ["B2B"],
    })

    // Shape must match AssessRequest exactly - it's posted as-is.
    expect(request).toEqual({
      country: "BE",
      vat_registered: true,
      employee_count: 25,
      annual_turnover_eur: 250_000,
      invoices_to: ["B2B"],
    })
  })
})
