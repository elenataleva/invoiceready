const DAY_MS = 86_400_000

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

/** "2026-08-01" -> "1 Aug 2026", matching the wizard mockup in #3.1. */
export function formatDate(isoDate: string): string {
  return DATE_FORMATTER.format(new Date(isoDate))
}

/** Whole days between an ISO date and now. Negative for a future date. */
export function daysSince(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / DAY_MS)
}

const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" })

/**
 * "in 11 months" / "3 days ago" / "today" - the deadline strip's live
 * countdown (docs/04-FRONTEND-DESIGN.md #3.3): "the single most-
 * screenshotted element in the product; make it good."
 */
export function formatCountdown(isoDate: string): string {
  const daysUntil = -daysSince(isoDate)
  if (daysUntil === 0) return RELATIVE_FORMATTER.format(0, "day")

  const monthsUntil = Math.round(daysUntil / 30.44)
  if (Math.abs(monthsUntil) >= 1) return RELATIVE_FORMATTER.format(monthsUntil, "month")

  return RELATIVE_FORMATTER.format(daysUntil, "day")
}
