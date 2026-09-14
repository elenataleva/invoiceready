import type { Obligation } from "@/api/client"
import { Skeleton, SourceBadge } from "@/components/trust"
import { formatDate } from "@/lib/dates"
import { cn } from "@/lib/utils"

interface ObligationCardProps {
  obligation: Obligation | undefined
  className?: string
}

/**
 * docs/04-FRONTEND-DESIGN.md #3.3 item 3. One card per row in
 * `obligations[]` - `rule_type` badge, `applies_from`, format + network as
 * monospace chips (jargon like "Peppol BIS 3.0" is intimidating prose but
 * an honest artifact, per #4.2), the LLM's plain-language explanation,
 * and a SourceBadge. The caller decides how many skeleton cards to show
 * while loading (it knows the intended shape before the count is real);
 * this component only knows how to render one slot, real or not.
 */
export function ObligationCard({ obligation, className }: ObligationCardProps) {
  if (obligation === undefined) {
    return (
      <div className={cn("space-y-3 rounded-xl border border-border bg-card p-4", className)}>
        <Skeleton w="30%" h="1.25rem" className="block" />
        <Skeleton w="100%" h="1rem" className="block" />
        <Skeleton w="80%" h="1rem" className="block" />
        <Skeleton w="8rem" h="1.5rem" className="block" />
      </div>
    )
  }

  return (
    <div className={cn("space-y-3 rounded-xl border border-border bg-card p-4", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {obligation.rule_type}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          from {formatDate(obligation.applies_from)}
        </span>
      </div>

      {(obligation.format_required || obligation.network) && (
        <div className="flex flex-wrap gap-2">
          {obligation.format_required && (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              {obligation.format_required}
            </code>
          )}
          {obligation.network && (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              {obligation.network}
            </code>
          )}
        </div>
      )}

      <p className="text-sm leading-relaxed text-foreground">{obligation.explanation}</p>

      <SourceBadge url={obligation.source_url} reviewedAt={obligation.source_reviewed_at} />
    </div>
  )
}
