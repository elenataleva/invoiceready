import { cn } from "@/lib/utils"

interface SkeletonProps {
  /** CSS width, e.g. "120px" or "60%" - sized to the real content, never a guess. */
  w: string
  /** CSS height, e.g. "1rem". */
  h: string
  className?: string
}

/**
 * A trust component, not a styling helper (docs/04-FRONTEND-DESIGN.md #4.5):
 * every assessment field renders either real data with its source, or a
 * skeleton sized like the real content - never a plausible-looking
 * placeholder value that could be mistaken for a finished answer.
 * `prefers-reduced-motion` is handled globally in index.css.
 */
export function Skeleton({ w, h, className }: SkeletonProps) {
  return (
    <span
      role="presentation"
      aria-hidden="true"
      className={cn("inline-block animate-pulse rounded-md bg-muted", className)}
      style={{ width: w, height: h }}
    />
  )
}
