import { Skeleton, SourceBadge } from "@/components/trust"
import type { Source } from "@/features/assessment/sources"
import { cn } from "@/lib/utils"

interface SourceListProps {
  sources: Source[] | undefined
  className?: string
}

/**
 * docs/04-FRONTEND-DESIGN.md #3.3 item 6: "every URL used on the page,
 * collected, each with its review date." The page-level list, distinct
 * from the per-obligation SourceBadge each card already shows inline.
 */
export function SourceList({ sources, className }: SourceListProps) {
  if (sources === undefined) {
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        <Skeleton w="10rem" h="1.75rem" />
        <Skeleton w="8rem" h="1.75rem" />
      </div>
    )
  }

  if (sources.length === 0) return null

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {sources.map((source) => (
        <SourceBadge key={source.url} url={source.url} reviewedAt={source.reviewedAt} />
      ))}
    </div>
  )
}
