import { cn } from "@/lib/utils"

// The API's own disclaimer (app/routers/assess.py) plus the advisor
// clause. The clause isn't decoration: it was what the removed Jinja
// footer showed, and 01-BUSINESS-PLAN.md #5 asks for a prominent
// disclaimer on every page - dropping the server-rendered UI shouldn't
// quietly weaken what a visitor is told.
const DEFAULT_DISCLAIMER =
  "Informational guidance only, not tax or legal advice. Verify with a qualified advisor before acting."

interface DisclaimerBarProps {
  /** Override only where the API returned its own wording; otherwise the constant above. */
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
