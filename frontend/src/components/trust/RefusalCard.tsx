import { ArrowRight, Info } from "lucide-react"

import { cn } from "@/lib/utils"

interface RefusalCardProps {
  message: string
  /** Only rendered if the API actually returned one - never invented (#1.4). */
  sourceUrl?: string
  className?: string
}

/**
 * docs/04-FRONTEND-DESIGN.md #3.4 / #1.2: a refusal is a designed feature,
 * not an error - muted background, info icon, no red, no apology. Red is
 * reserved for penalty amounts elsewhere in the product; using it here
 * would tell the user something went wrong, when what actually happened
 * is the system correctly declined to guess.
 */
export function RefusalCard({ message, sourceUrl, className }: RefusalCardProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground",
        className
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="space-y-1.5">
        <p className="leading-relaxed">{message}</p>
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            Official source
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  )
}
