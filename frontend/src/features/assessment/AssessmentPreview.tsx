import { ArrowUpRight } from "lucide-react"
import { useEffect, useState } from "react"

import { useDataSource } from "@/api"
import type { Country } from "@/api/client"
import { CoverageIndicator, Skeleton } from "@/components/trust"
import { EuRing } from "@/components/EuRing"
import { DeadlineStrip } from "@/features/assessment/DeadlineStrip"
import { NextSteps } from "@/features/assessment/NextSteps"
import { ObligationCard } from "@/features/assessment/ObligationCard"
import type { IntakeState } from "@/features/intake/types"
import { cn } from "@/lib/utils"

interface AssessmentPreviewProps {
  profile: IntakeState
  className?: string
}

function answeredStepCount(profile: IntakeState): number {
  const country = profile.country !== undefined
  const sizeAndVat =
    profile.vatRegistered !== undefined &&
    profile.employeeBand !== undefined &&
    profile.turnoverBand !== undefined
  const counterparty = (profile.invoicesTo?.length ?? 0) > 0
  return [country, sizeAndVat, counterparty].filter(Boolean).length
}

/**
 * docs/04-FRONTEND-DESIGN.md #3.2: the right-panel live preview. Renders
 * from intake state + /api/countries alone - it NEVER calls /api/assess,
 * so every assessment-derived field is permanently `undefined` here and
 * these are the exact same components build-order step 6 built for
 * /result, just always in their loading state. That's not a limitation
 * to work around: showing real obligations before the wizard is even
 * finished would misrepresent a half-answered profile as a finished one
 * (#1.4), which is the one thing this panel exists to never do.
 */
export function AssessmentPreview({ profile, className }: AssessmentPreviewProps) {
  const ds = useDataSource()
  const [countries, setCountries] = useState<Country[] | null>(null)

  useEffect(() => {
    let cancelled = false
    ds.countries().then((result) => {
      if (!cancelled) setCountries(result)
    })
    return () => {
      cancelled = true
    }
  }, [ds])

  const country = countries?.find((candidate) => candidate.code === profile.country)
  const remaining = 3 - answeredStepCount(profile)

  return (
    <aside
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card p-6",
        "min-[900px]:bg-gradient-to-br min-[900px]:from-primary/5 min-[900px]:to-transparent",
        className
      )}
    >
      <EuRing className="pointer-events-none absolute -top-10 -right-10 hidden size-56 text-primary/10 min-[900px]:block" />

      <p className="relative text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Your assessment{remaining > 0 ? " · Building" : ""}
      </p>

      <div className="relative mt-4 flex min-h-11 items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
        {profile.country === undefined ? (
          <span className="text-sm text-muted-foreground">Choose a country to begin</span>
        ) : country ? (
          <>
            <span className="text-sm font-medium text-foreground">{country.name}</span>
            <CoverageIndicator status={country.status} />
          </>
        ) : (
          <Skeleton w="60%" h="1.25rem" />
        )}
      </div>

      <div className="relative mt-5 space-y-5">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Your deadline
          </p>
          <DeadlineStrip obligations={undefined} className="mt-1" />
        </div>

        <ObligationCard obligation={undefined} />

        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Next steps
          </p>
          <NextSteps steps={undefined} storageKey="preview" className="mt-1" />
        </div>
      </div>

      <div className="relative mt-5 flex items-center gap-1.5 border-t border-border pt-4 text-sm text-muted-foreground">
        <ArrowUpRight className="size-4 text-primary" aria-hidden="true" />
        Every claim cites an official source
      </div>

      {remaining > 0 && (
        <p className="relative mt-3 text-sm text-muted-foreground">
          Answer {remaining} more question{remaining === 1 ? "" : "s"} to complete it.
        </p>
      )}
    </aside>
  )
}
