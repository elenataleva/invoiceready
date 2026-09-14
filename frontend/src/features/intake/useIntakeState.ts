import { useCallback, useMemo } from "react"
import { useSearchParams } from "react-router"

import { getBoolParam, getListParam, getStringParam, setOrDeleteParam } from "@/lib/url-state"

import type { Counterparty, EmployeeBand, IntakeState, TurnoverBand } from "@/features/intake/types"

// Short, deliberate query keys - not the doc's illustrative
// /result?c=FR&vat=1&emp=4&to=B2B,B2C example verbatim (that shows the
// concept, not a literal contract), but the same idea: short enough to
// share, self-describing enough to read in a URL bar.
const PARAM_KEYS = {
  country: "country",
  vatRegistered: "vat",
  employeeBand: "emp",
  turnoverBand: "turnover",
  invoicesTo: "to",
} as const

function parseIntakeState(params: URLSearchParams): IntakeState {
  return {
    country: getStringParam(params, PARAM_KEYS.country),
    vatRegistered: getBoolParam(params, PARAM_KEYS.vatRegistered),
    employeeBand: getStringParam(params, PARAM_KEYS.employeeBand) as EmployeeBand | undefined,
    turnoverBand: getStringParam(params, PARAM_KEYS.turnoverBand) as TurnoverBand | undefined,
    invoicesTo: getListParam(params, PARAM_KEYS.invoicesTo) as Counterparty[] | undefined,
  }
}

function writeIntakeState(params: URLSearchParams, state: IntakeState): void {
  setOrDeleteParam(params, PARAM_KEYS.country, state.country)
  setOrDeleteParam(
    params,
    PARAM_KEYS.vatRegistered,
    state.vatRegistered === undefined ? undefined : state.vatRegistered ? "1" : "0"
  )
  setOrDeleteParam(params, PARAM_KEYS.employeeBand, state.employeeBand)
  setOrDeleteParam(params, PARAM_KEYS.turnoverBand, state.turnoverBand)
  setOrDeleteParam(params, PARAM_KEYS.invoicesTo, state.invoicesTo?.join(","))
}

/**
 * The single source of truth for intake answers (docs/04-FRONTEND-DESIGN.md
 * #5.1). Held at the `/` route component, passed down to the wizard
 * (writes) and, once it exists, AssessmentPreview (reads) - one object,
 * two consumers, no context provider needed for that. Every change is
 * mirrored into the URL query string via `replace` (not `push`), so
 * answering three questions doesn't fill the back-button history with
 * three entries, but a half-finished intake still survives a refresh.
 */
export function useIntakeState(): [IntakeState, (patch: Partial<IntakeState>) => void] {
  const [searchParams, setSearchParams] = useSearchParams()

  const state = useMemo(() => parseIntakeState(searchParams), [searchParams])

  const update = useCallback(
    (patch: Partial<IntakeState>) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          writeIntakeState(next, { ...parseIntakeState(previous), ...patch })
          return next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  return [state, update]
}
