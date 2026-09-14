import { cn } from "@/lib/utils"

interface CoverageIndicatorProps {
  /** From CountryOut.status (app/schemas.py) - "live" today; any other value renders as pending/phasing. */
  status: string
  className?: string
}

/**
 * docs/04-FRONTEND-DESIGN.md #3.1's country picker mockup: a filled dot
 * for "live" coverage, a hollow dot plus the status word for anything
 * else (e.g. a future "phasing" country) - never invented wording beyond
 * what the API's own status string says.
 */
export function CoverageIndicator({ status, className }: CoverageIndicatorProps) {
  const isLive = status === "live"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        isLive ? "text-success" : "text-warning",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          isLive ? "bg-success" : "border border-current bg-transparent"
        )}
      />
      {status}
    </span>
  )
}
