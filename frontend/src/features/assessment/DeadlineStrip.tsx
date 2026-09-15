import type { Obligation } from "@/api/client"
import { Skeleton } from "@/components/trust"
import { daysSince, formatCountdown, formatDate } from "@/lib/dates"
import { cn } from "@/lib/utils"

interface DeadlineStripProps {
  obligations: Obligation[] | undefined
  className?: string
}

/**
 * docs/04-FRONTEND-DESIGN.md #3.3 item 2 - and the single largest element
 * on the page, deliberately: it's the one number a visitor came for, so it
 * gets the display size and nothing else does.
 *
 * A date that has already passed reads as "In force now", not as a
 * countdown: "8 months ago" next to a legal deadline invites the reader to
 * think they've missed a window that is in fact simply open.
 */
export function DeadlineStrip({ obligations, className }: DeadlineStripProps) {
  if (obligations === undefined) {
    return (
      <div className={cn("space-y-2", className)}>
        <Skeleton w="14rem" h="3rem" className="block" />
        <Skeleton w="8rem" h="1rem" className="block" />
      </div>
    )
  }

  if (obligations.length === 0) return null

  const nearest = obligations.reduce((soonest, current) =>
    current.applies_from < soonest.applies_from ? current : soonest
  )
  const inForce = daysSince(nearest.applies_from) >= 0

  return (
    <div className={className}>
      <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        Your deadline
      </p>
      <p className="mt-1.5 text-5xl leading-[1.05] font-semibold tabular-nums text-foreground">
        {formatDate(nearest.applies_from)}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2.5 text-sm text-muted-foreground">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
            inForce ? "bg-success/12 text-success" : "bg-warning/14 text-warning"
          )}
        >
          <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
          {inForce ? "In force now" : "Not yet in force"}
        </span>
        <span>
          {inForce ? "Started" : "Starts"} {formatCountdown(nearest.applies_from)}
        </span>
      </div>
    </div>
  )
}
