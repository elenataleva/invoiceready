import { Check, Info } from "lucide-react"
import { useEffect, useState } from "react"

import { useDataSource } from "@/api"
import type { Country, Rule } from "@/api/client"
import { EuStars } from "@/components/EuStars"
import { CoverageIndicator, Skeleton } from "@/components/trust"
import { ObligationIcon } from "@/features/assessment/ObligationIcon"
import { byReadingOrder, formatCohort, toPlainRule } from "@/features/assessment/ruleLanguage"
import type { IntakeState } from "@/features/intake/types"
import { daysSince, formatDate } from "@/lib/dates"
import { cn } from "@/lib/utils"

interface AssessmentPreviewProps {
  profile: IntakeState
  className?: string
}

const PROMISES = [
  {
    title: "The date it starts applying to you",
    detail: "Not the mandate's headline date - the one for a business your size.",
  },
  {
    title: "The exact format and network",
    detail: "The strings your accountant or software vendor will ask you for.",
  },
  {
    title: "What to actually do next",
    detail: "Three concrete steps, in the order they make sense.",
  },
  {
    title: "A source for every claim",
    detail: "Linked, with the date a human last checked it. If it isn't sourced, we say we don't know.",
  },
]

/**
 * One country's rules, fetched on mount. Mounted with `key={code}` by the
 * panel below, so switching country remounts this with a clean
 * `useState(null)` rather than resetting state inside an effect - which
 * would briefly leave the previous country's rules under the new
 * country's name.
 */
function CountryRules({ code }: { code: string }) {
  const ds = useDataSource()
  const [rules, setRules] = useState<Rule[] | null>(null)

  useEffect(() => {
    let cancelled = false
    ds.rules(code)
      .then((result) => {
        if (!cancelled) setRules(result)
      })
      .catch(() => {
        // A country the API doesn't know is "nothing on file", not an
        // error worth putting in front of someone mid-form.
        if (!cancelled) setRules([])
      })
    return () => {
      cancelled = true
    }
  }, [ds, code])

  if (rules === null) {
    return (
      <div className="mt-3 space-y-3">
        <Skeleton w="100%" h="2.5rem" className="block" />
        <Skeleton w="100%" h="2.5rem" className="block" />
      </div>
    )
  }

  if (rules.length === 0) {
    return <p className="mt-3 text-sm text-muted-foreground">Nothing on file for this country yet.</p>
  }

  const specs = [
    ...new Set(
      rules.flatMap((rule) =>
        [rule.format_required, rule.network].filter((value): value is string => Boolean(value))
      )
    ),
  ]

  return (
    <>
      <ul className="mt-2">
        {byReadingOrder(rules).map((rule) => {
          const plain = toPlainRule(rule.rule_type)
          const inForce = daysSince(rule.applies_from) >= 0
          return (
            <li
              key={`${rule.rule_type}-${rule.applies_from}`}
              className="grid grid-cols-[1.75rem_1fr] gap-3 border-b border-dashed border-border py-3 last:border-b-0"
            >
              <span className="mt-0.5 grid size-7 place-items-center rounded-lg bg-muted text-muted-foreground">
                <ObligationIcon kind={plain.kind} className="size-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{plain.title}</p>
                <p className="text-sm tabular-nums text-muted-foreground">
                  {inForce ? "In force since " : "From "}
                  <span className="font-semibold text-foreground">
                    {formatDate(rule.applies_from)}
                  </span>
                </p>
                {plain.cohort && (
                  <p className="mt-0.5 text-xs text-muted-foreground/80">
                    {formatCohort(plain.cohort)}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {specs.map((spec) => (
          <code
            key={spec}
            className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground"
          >
            {spec}
          </code>
        ))}
      </div>
    </>
  )
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
 * docs/04-FRONTEND-DESIGN.md #3.2's right-hand panel, rebuilt.
 *
 * The original spec had it render the assessment components in their
 * loading state until the wizard finished - but since the panel is (still,
 * correctly) forbidden from calling /api/assess, nothing ever arrived to
 * replace them, and the panel sat empty for the whole intake. It now shows
 * two honest things instead: what the product will give you before you've
 * chosen anything, and - the moment a country is picked - that country's
 * real rules straight from /api/countries/{code}/rules. No profile is
 * applied to them and the copy says so, so a general rule can't be
 * mistaken for a personalised answer (#1.4).
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

  const code = profile.country
  const country = countries?.find((candidate) => candidate.code === code)
  const remaining = 3 - answeredStepCount(profile)

  return (
    <aside
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card p-6",
        "min-[900px]:bg-gradient-to-br min-[900px]:from-primary/6 min-[900px]:to-transparent",
        className
      )}
    >
      <EuStars className="pointer-events-none absolute -top-14 -right-14 hidden size-64 text-primary/8 min-[900px]:block" />

      {code === undefined ? (
        <div className="relative">
          <h2 className="text-lg font-semibold text-foreground">What you'll get</h2>
          <ul className="mt-5 grid gap-3.5">
            {PROMISES.map((promise) => (
              <li key={promise.title} className="grid grid-cols-[1.125rem_1fr] gap-3 text-sm">
                <Check className="mt-0.5 size-4 text-primary" aria-hidden="true" />
                <span>
                  <span className="block font-semibold text-foreground">{promise.title}</span>
                  <span className="text-muted-foreground">{promise.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
            Pick a country to see what's already in force there.
          </p>
        </div>
      ) : (
        <div className="relative">
          <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
            <div className="min-w-0">
              <p className="text-lg font-semibold text-foreground">
                {country ? country.name : code}
              </p>
              {country && (
                <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                  Last reviewed {formatDate(country.last_reviewed)}
                </p>
              )}
            </div>
            {country && <CoverageIndicator status={country.status} />}
          </div>

          <p className="mt-4 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            What applies here
          </p>

          <CountryRules key={code} code={code} />

          <p className="mt-5 flex items-start gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              {remaining > 0
                ? `These are ${country?.name ?? "the country"}'s rules in general. Answer ${remaining} more question${remaining === 1 ? "" : "s"} to see which apply to you, and from when.`
                : `Ready - your answers will narrow these to the obligations that apply to you.`}
            </span>
          </p>
        </div>
      )}
    </aside>
  )
}
