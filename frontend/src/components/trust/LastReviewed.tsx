import { daysSince, formatDate } from "@/lib/dates"
import { cn } from "@/lib/utils"

const STALE_AFTER_DAYS = 90

interface LastReviewedProps {
  /** ISO date the source was last checked. */
  date: string
  className?: string
}

/**
 * docs/04-FRONTEND-DESIGN.md #4.5: amber past 90 days, otherwise muted -
 * a claim's own review date is one of the trust signals the product is
 * built around (#1), so staleness has to be visible, not just present.
 */
export function LastReviewed({ date, className }: LastReviewedProps) {
  const stale = daysSince(date) > STALE_AFTER_DAYS

  return (
    <span
      className={cn(
        "tabular-nums",
        stale ? "text-warning" : "text-muted-foreground",
        className
      )}
    >
      Last reviewed {formatDate(date)}
    </span>
  )
}
