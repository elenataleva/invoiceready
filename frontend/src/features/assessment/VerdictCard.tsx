import type { Obligation } from "@/api/client"
import { Skeleton } from "@/components/trust"
import { formatDate } from "@/lib/dates"
import { cn } from "@/lib/utils"

interface VerdictCardProps {
  /** Undefined while loading; [] is a real, final "not in scope" answer - never confused with "not loaded yet" (#3.2). */
  obligations: Obligation[] | undefined
  className?: string
}

function earliestObligation(obligations: Obligation[]): Obligation {
  return obligations.reduce((earliest, current) =>
    current.applies_from < earliest.applies_from ? current : earliest
  )
}

/**
 * docs/04-FRONTEND-DESIGN.md #3.3 item 1: the answer in one sentence.
 * Status colour is a left border only, never a full-bleed panel - a
 * refusal-adjacent decision (#1.2/#1.4): this reads its verdict off the
 * real obligations array rather than a bespoke "verdict sentence" field
 * the API doesn't return, so the wording stays generic enough to never
 * overstate what a messy `rule_type` string (e.g. a cohort qualifier)
 * actually says.
 */
export function VerdictCard({ obligations, className }: VerdictCardProps) {
  if (obligations === undefined) {
    return (
      <div className={cn("rounded-xl border border-l-4 border-border p-5", className)}>
        <Skeleton w="80%" h="1.75rem" className="block" />
      </div>
    )
  }

  if (obligations.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-l-4 border-border border-l-muted-foreground bg-card p-5",
          className
        )}
      >
        <h2 className="text-xl font-medium text-foreground">
          No e-invoicing obligations apply, based on what you told us.
        </h2>
      </div>
    )
  }

  const earliest = earliestObligation(obligations)
  const isActive = earliest.applies_from <= new Date().toISOString().slice(0, 10)

  return (
    <div
      className={cn(
        "rounded-xl border border-l-4 bg-card p-5",
        isActive ? "border-border border-l-success" : "border-border border-l-warning",
        className
      )}
    >
      <h2 className="text-xl font-medium text-foreground">
        Yes -{" "}
        <span className="tabular-nums">
          {isActive ? "since" : "from"} {formatDate(earliest.applies_from)}
        </span>{" "}
        you have an e-invoicing obligation.
      </h2>
    </div>
  )
}
