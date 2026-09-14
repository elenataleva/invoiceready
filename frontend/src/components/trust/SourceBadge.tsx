import { ExternalLink } from "lucide-react"

import { LastReviewed } from "@/components/trust/LastReviewed"
import { cn } from "@/lib/utils"

interface SourceBadgeProps {
  url: string
  reviewedAt: string
  className?: string
}

/**
 * docs/04-FRONTEND-DESIGN.md #4.5 / #1: "every claim shows its receipt" -
 * source link and review date are first-class here, not a footnote, which
 * is the single biggest visual difference between this product and a
 * plain chat answer.
 */
export function SourceBadge({ url, reviewedAt, className }: SourceBadgeProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground",
        className
      )}
    >
      <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
      <span>Source</span>
      <span aria-hidden="true">·</span>
      <LastReviewed date={reviewedAt} />
    </a>
  )
}
