import type { AssessRequest } from "@/api/client"

export type CountryCode = string

export const EMPLOYEE_BANDS = ["1-9", "10-49", "50-249", "250+"] as const
export type EmployeeBand = (typeof EMPLOYEE_BANDS)[number]

export const TURNOVER_BANDS = ["under_10k", "10k_100k", "100k_500k", "over_500k"] as const
export type TurnoverBand = (typeof TURNOVER_BANDS)[number]

export const COUNTERPARTIES = ["B2B", "B2C", "B2G"] as const
export type Counterparty = (typeof COUNTERPARTIES)[number]

export interface IntakeState {
  country?: CountryCode
  vatRegistered?: boolean
  employeeBand?: EmployeeBand
  turnoverBand?: TurnoverBand
  invoicesTo?: Counterparty[]
}

export const EMPLOYEE_BAND_LABELS: Record<EmployeeBand, string> = {
  "1-9": "1 - 9 employees",
  "10-49": "10 - 49 employees",
  "50-249": "50 - 249 employees",
  "250+": "250+ employees",
}

export const TURNOVER_BAND_LABELS: Record<TurnoverBand, string> = {
  under_10k: "Under EUR 10,000",
  "10k_100k": "EUR 10,000 - 100,000",
  "100k_500k": "EUR 100,000 - 500,000",
  over_500k: "Over EUR 500,000",
}

// A band carries a single representative value into the rules engine's
// threshold comparison (docs/04-FRONTEND-DESIGN.md #3.1) - the person
// filling the form only ever picks a band, never types an exact figure.
// scripts/seed_rules.py currently seeds no real 'turnover_above' or
// per-employee-count rule (every rule is 'all', see its own note on why),
// so no band boundary is threshold-tested against real data yet; these
// values are chosen to be defensible EU SME-style breakpoints for when
// one is added, not derived from a rule that exists today.
export const EMPLOYEE_BAND_VALUES: Record<EmployeeBand, number> = {
  "1-9": 5,
  "10-49": 25,
  "50-249": 100,
  "250+": 500,
}

export const TURNOVER_BAND_VALUES: Record<TurnoverBand, number> = {
  under_10k: 5_000,
  "10k_100k": 50_000,
  "100k_500k": 250_000,
  over_500k: 750_000,
}

export const COUNTERPARTY_LABELS: Record<Counterparty, string> = {
  B2B: "Other businesses (B2B)",
  B2C: "Consumers (B2C)",
  B2G: "Government bodies (B2G)",
}

export type CompleteIntakeState = Required<IntakeState>

export function isComplete(state: IntakeState): state is CompleteIntakeState {
  return (
    state.country !== undefined &&
    state.vatRegistered !== undefined &&
    state.employeeBand !== undefined &&
    state.turnoverBand !== undefined &&
    state.invoicesTo !== undefined &&
    state.invoicesTo.length > 0
  )
}

/**
 * The completed intake state IS the POST /api/assess body (#5.1) - this is
 * the only place a band gets resolved to the number the rules engine
 * compares against, so there is no second mapping to keep in sync.
 */
export function toAssessRequest(state: CompleteIntakeState): AssessRequest {
  return {
    country: state.country,
    vat_registered: state.vatRegistered,
    employee_count: EMPLOYEE_BAND_VALUES[state.employeeBand],
    annual_turnover_eur: TURNOVER_BAND_VALUES[state.turnoverBand],
    invoices_to: state.invoicesTo,
  }
}
