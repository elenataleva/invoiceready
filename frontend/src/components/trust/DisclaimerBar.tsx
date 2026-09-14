import { cn } from "@/lib/utils"

const DEFAULT_DISCLAIMER = "Informational guidance only, not tax or legal advice."

interface DisclaimerBarProps {
  /** Defaults to the backend's own disclaimer string (app/routers/assess.py) so the two never drift. */
  text?: string
  className?: string
}

/**
 * docs/04-FRONTEND-DESIGN.md #3.3 item 7: persistent, not dismissible -
 * no close button, by design. Deliberately plain (muted text, no icon,
 * no card) so it reads as boilerplate rather than competing with the
 * refusal state (RefusalCard) for the user's attention.
 */
export function DisclaimerBar({ text = DEFAULT_DISCLAIMER, className }: DisclaimerBarProps) {
  return (
    <div
      className={cn(
        "border-t border-border bg-muted/50 px-6 py-3 text-center text-xs text-muted-foreground",
        className
      )}
    >
      {text}
    </div>
  )
}
