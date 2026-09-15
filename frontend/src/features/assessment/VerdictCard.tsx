import type { Obligation } from "@/api/client"
import { Skeleton } from "@/components/trust"
import { toPlainRule } from "@/features/assessment/ruleLanguage"
import { daysSince, formatDate } from "@/lib/dates"
import { cn } from "@/lib/utils"

interface VerdictCardProps {
  /** Undefined while loading; [] is a real, final "not in scope" answer - never confused with "not loaded yet" (#3.2). */
  obligations: Obligation[] | undefined
  className?: string
}

/**
 * docs/04-FRONTEND-DESIGN.md #3.3 item 1: the answer in one sentence,
 * with status carried on a left border only - never a filled panel, which
 * would make a routine "yes" look like an alarm.
 *
 * The sentence is composed from the real obligations rather than a
 * bespoke API field, so it can only ever say what the rules table says.
 */
export function VerdictCard({ obligations, className }: VerdictCardProps) {
  if (obligations === undefined) {
    return (
      <div
        className={cn("rounded-xl border border-l-[3px] border-border bg-card p-5", className)}
      >
        <Skeleton w="75%" h="1.5rem" className="block" />
      </div>
    )
  }

  if (obligations.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-l-[3px] border-border border-l-muted-foreground bg-card p-5",
          className
        )}
      >
        <h2 className="text-lg font-semibold text-foreground">
          No e-invoicing obligations apply, based on what you told us.
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          That can change as a country phases its mandate in, so it's worth checking again if your
          business grows or the rules move.
        </p>
      </div>
    )
  }

  const earliest = obligations.reduce((soonest, current) =>
    current.applies_from < soonest.applies_from ? current : soonest
  )
  const inForce = daysSince(earliest.applies_from) >= 0
  const kinds = new Set(obligations.map((obligation) => toPlainRule(obligation.rule_type).kind))
  const both = kinds.has("receive") && kinds.has("issue")

  return (
    <div
      className={cn(
        "rounded-xl border border-l-[3px] bg-card p-5",
        inForce ? "border-border border-l-success" : "border-border border-l-warning",
        className
      )}
    >
      <h2 className="text-lg leading-snug font-semibold text-foreground">
        {inForce
          ? "Yes - e-invoicing already applies to your business."
          : "Yes - e-invoicing will apply to your business."}
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {both ? "Two things are required of you" : "One thing is required of you"}
        {inForce ? ", in force since " : ", starting "}
        <span className="tabular-nums">{formatDate(earliest.applies_from)}</span>.
      </p>
    </div>
  )
}
