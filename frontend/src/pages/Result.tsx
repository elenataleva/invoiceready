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
import { VerdictCard } from "@/features/assessment/VerdictCard"
import type { CompleteIntakeState } from "@/features/intake/types"
import { isComplete, toAssessRequest } from "@/features/intake/types"
import { parseIntakeState } from "@/features/intake/useIntakeState"

// How many ObligationCard skeletons to show while loading. There's no way
// to know the real count before the response arrives; two is a plausible
// middle ground against BE/PL/FR's real 2-3 obligations (scripts/seed_rules.py).
const LOADING_OBLIGATION_SLOTS = 2

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

  return (
    <>
      <VerdictCard obligations={response?.obligations} />
      <DeadlineStrip obligations={response?.obligations} />

      <div className="space-y-4">
        {response === undefined
          ? Array.from({ length: LOADING_OBLIGATION_SLOTS }, (_, index) => (
              <ObligationCard key={index} obligation={undefined} />
            ))
          : response.obligations.map((obligation) => (
              <ObligationCard
                key={`${obligation.rule_type}-${obligation.applies_from}`}
                obligation={obligation}
              />
            ))}
      </div>

      <NextSteps steps={response?.next_steps} storageKey={storageKey} />

      <AskPanel country={profile.country} />

      <SourceList sources={response ? sourcesFromObligations(response.obligations) : undefined} />
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

  return (
    <Layout>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-6 py-16">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-medium tracking-tight text-foreground">Your assessment</h1>
          <Link
            to={{ pathname: "/", search: searchParams.toString() }}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Edit answers
          </Link>
        </div>

        <Assessment
          key={`${searchParams.toString()}:${live}`}
          profile={intake}
          storageKey={searchParams.toString()}
          ds={ds}
        />
      </main>
    </Layout>
  )
}
