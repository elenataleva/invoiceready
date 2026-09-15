import { useEffect, useState } from "react"
import { Link, Navigate, useSearchParams } from "react-router"

import type { AssessResponse, DataSource } from "@/api/client"
import { useDataSource } from "@/api"
import { useLiveMode } from "@/api/liveMode"
import { Layout } from "@/components/Layout"
import { AskPanel } from "@/features/ask"
import { DeadlineStrip } from "@/features/assessment/DeadlineStrip"
import { NextSteps } from "@/features/assessment/NextSteps"
import { ObligationCard } from "@/features/assessment/ObligationCard"
import { SourceList } from "@/features/assessment/SourceList"
import { sourcesFromObligations } from "@/features/assessment/sources"
import { byReadingOrder } from "@/features/assessment/ruleLanguage"
import { VerdictCard } from "@/features/assessment/VerdictCard"
import type { CompleteIntakeState } from "@/features/intake/types"
import {
  COUNTERPARTY_LABELS,
  EMPLOYEE_BAND_LABELS,
  isComplete,
  toAssessRequest,
} from "@/features/intake/types"
import { parseIntakeState } from "@/features/intake/useIntakeState"

// How many ObligationCard skeletons to show while loading. There's no way
// to know the real count before the response arrives; two is a plausible
// middle ground against BE/PL/FR's real 2-3 obligations (scripts/seed_rules.py).
const LOADING_OBLIGATION_SLOTS = 2

const SECTION_LABEL = "text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase"

interface AssessmentProps {
  profile: CompleteIntakeState
  storageKey: string
  ds: DataSource
}

/**
 * Owns the fetch and its result. Result (below) mounts a fresh instance
 * of this per profile *and* per live/demo mode via `key`, so a changed
 * profile or a toggled mode both get a clean `useState(undefined)` for
 * free instead of a synchronous reset inside the fetch effect - no risk
 * of stale or wrong-mode obligations flashing on screen while a new
 * fetch is in flight.
 */
function Assessment({ profile, storageKey, ds }: AssessmentProps) {
  const [response, setResponse] = useState<AssessResponse | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    ds.assess(toAssessRequest(profile)).then((result) => {
      if (!cancelled) setResponse(result)
    })
    return () => {
      cancelled = true
    }
    // profile/ds are re-derived every render of the parent, but this
    // component only mounts once per distinct key (profile + live mode)
    // - one fetch per (profile, mode) pair is exactly what's wanted here.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const obligationCount = response?.obligations.length ?? 0

  return (
    <>
      <VerdictCard obligations={response?.obligations} />

      <DeadlineStrip obligations={response?.obligations} className="mt-9" />

      {/* Hidden only once we know there's genuinely nothing to list -
          while loading, the section shows its skeletons. */}
      {(response === undefined || obligationCount > 0) && (
        <div className="mt-10">
          <p className={SECTION_LABEL}>
            {obligationCount > 1
              ? `What you must do - ${obligationCount} separate things`
              : "What you must do"}
          </p>
          <div className="mt-3 grid gap-3.5">
            {response === undefined
              ? Array.from({ length: LOADING_OBLIGATION_SLOTS }, (_, index) => (
                  <ObligationCard key={index} obligation={undefined} />
                ))
              : byReadingOrder(response.obligations).map((obligation) => (
                  <ObligationCard
                    key={`${obligation.rule_type}-${obligation.applies_from}`}
                    obligation={obligation}
                  />
                ))}
          </div>
        </div>
      )}

      {(response === undefined || response.next_steps.length > 0) && (
        <div className="mt-10">
          <div className="flex items-baseline justify-between gap-3">
            <p className={SECTION_LABEL}>Your next steps</p>
            <span className="text-xs text-muted-foreground">Tick as you go</span>
          </div>
          <NextSteps steps={response?.next_steps} storageKey={storageKey} className="mt-3" />
        </div>
      )}

      <div className="mt-10">
        <AskPanel country={profile.country} />
      </div>

      {response && response.obligations.length > 0 && (
        <div className="mt-10">
          <p className={SECTION_LABEL}>Every source used on this page</p>
          <SourceList sources={sourcesFromObligations(response.obligations)} className="mt-3" />
        </div>
      )}
    </>
  )
}

/**
 * `/result` - docs/04-FRONTEND-DESIGN.md #3.3, reusing every component
 * built in build-order step 6 with a complete profile instead of a
 * partial one. The profile itself is read straight from this page's own
 * URL, not passed through router state, so the result is shareable and
 * refresh-safe without a database session (#5.1).
 */
export function Result() {
  const [searchParams] = useSearchParams()
  const intake = parseIntakeState(searchParams)
  const ds = useDataSource()
  const [live] = useLiveMode()

  // An incomplete or hand-edited URL has nothing to assess - back to the
  // wizard rather than rendering a broken page, per #1.4 ("nothing on
  // screen the API can't back").
  if (!isComplete(intake)) {
    return <Navigate to={{ pathname: "/", search: searchParams.toString() }} replace />
  }

  const summary = [
    intake.country,
    EMPLOYEE_BAND_LABELS[intake.employeeBand],
    intake.invoicesTo.map((counterparty) => COUNTERPARTY_LABELS[counterparty]).join(", "),
  ].join(" · ")

  return (
    <Layout>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-14">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={SECTION_LABEL}>{summary}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
              Your assessment
            </h1>
          </div>
          <Link
            to={{ pathname: "/", search: searchParams.toString() }}
            className="mt-1 shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Edit answers
          </Link>
        </div>

        <div className="mt-8">
          <Assessment
            key={`${searchParams.toString()}:${live}`}
            profile={intake}
            storageKey={searchParams.toString()}
            ds={ds}
          />
        </div>
      </main>
    </Layout>
  )
}
