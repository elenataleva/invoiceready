import type { Obligation } from "@/api/client"
import { Skeleton, SourceBadge } from "@/components/trust"
import { ObligationIcon } from "@/features/assessment/ObligationIcon"
import { formatCohort, toPlainRule } from "@/features/assessment/ruleLanguage"
import { daysSince, formatDate } from "@/lib/dates"
import { cn } from "@/lib/utils"

interface ObligationCardProps {
  obligation: Obligation | undefined
  className?: string
}

/**
 * docs/04-FRONTEND-DESIGN.md #3.3 item 3, rebuilt around what the reader
 * actually needs: the obligation's plain-language name is the heading, and
 * the compliance term it came from (`receive` / `issue`) is no longer shown
 * at all - it carried no meaning for a business owner and took the visual
 * weight a heading should have. Format and network stay as monospace chips
 * (#4.2): those strings are artifacts to hand a software vendor, not prose.
 */
export function ObligationCard({ obligation, className }: ObligationCardProps) {
  if (obligation === undefined) {
    return (
      <div className={cn("space-y-4 rounded-xl border border-border bg-card p-5", className)}>
        <div className="flex items-start gap-3">
          <Skeleton w="2.25rem" h="2.25rem" className="shrink-0 rounded-[10px]" />
          <div className="flex-1 space-y-2">
            <Skeleton w="60%" h="1.25rem" className="block" />
            <Skeleton w="40%" h="0.875rem" className="block" />
          </div>
        </div>
        <Skeleton w="100%" h="1rem" className="block" />
        <Skeleton w="85%" h="1rem" className="block" />
      </div>
    )
  }

  const plain = toPlainRule(obligation.rule_type)
  const inForce = daysSince(obligation.applies_from) >= 0

  return (
    <div className={cn("rounded-xl border border-border bg-card p-5", className)}>
      <div className="flex items-start gap-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary/12 text-primary">
          <ObligationIcon kind={plain.kind} />
        </span>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-foreground">{plain.title}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {inForce ? "Required since " : "Required from "}
            <span className="font-semibold tabular-nums text-foreground">
              {formatDate(obligation.applies_from)}
            </span>
          </p>
        </div>
      </div>

      {plain.meaning && (
        <p className="mt-4 text-base leading-relaxed text-foreground">{plain.meaning}</p>
      )}

      {obligation.explanation && (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {obligation.explanation}
        </p>
      )}

      {plain.cohort && (
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Applies to: </span>
          {formatCohort(plain.cohort)}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {obligation.format_required && (
          <code className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs text-foreground">
            {obligation.format_required}
          </code>
        )}
        {obligation.network && (
          <code className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs text-foreground">
            {obligation.network}
          </code>
        )}
        <SourceBadge url={obligation.source_url} reviewedAt={obligation.source_reviewed_at} />
      </div>
    </div>
  )
}
