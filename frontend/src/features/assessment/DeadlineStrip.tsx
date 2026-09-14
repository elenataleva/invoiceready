import type { Obligation } from "@/api/client"
import { Skeleton } from "@/components/trust"
import { formatCountdown, formatDate } from "@/lib/dates"
import { cn } from "@/lib/utils"

interface DeadlineStripProps {
  obligations: Obligation[] | undefined
  className?: string
}

/**
 * docs/04-FRONTEND-DESIGN.md #3.3 item 2: "the single most-screenshotted
 * element in the product." Shows only the nearest deadline - large,
 * tabular numerals, plus a live countdown. Renders nothing once loaded if
 * there's genuinely no deadline (obligations is []); VerdictCard already
 * carries that message, so this doesn't repeat it.
 */
export function DeadlineStrip({ obligations, className }: DeadlineStripProps) {
  if (obligations === undefined) {
    return (
      <div className={cn("space-y-1", className)}>
        <Skeleton w="10rem" h="2.5rem" className="block" />
        <Skeleton w="6rem" h="1rem" className="block" />
      </div>
    )
  }

  if (obligations.length === 0) return null

  const nearest = obligations.reduce((soonest, current) =>
    current.applies_from < soonest.applies_from ? current : soonest
  )

  return (
    <div className={className}>
      <p className="text-4xl font-medium tabular-nums tracking-tight text-foreground">
        {formatDate(nearest.applies_from)}
      </p>
      <p className="text-sm text-muted-foreground">{formatCountdown(nearest.applies_from)}</p>
    </div>
  )
}
