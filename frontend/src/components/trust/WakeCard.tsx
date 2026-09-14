import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

// Optimistic estimate, not a real progress signal (the server's actual
// wake time isn't observable from the browser) - the bar fills over this
// window and the card disappears the moment the real request resolves,
// whichever comes first.
const ESTIMATED_WAKE_MS = 45_000

interface WakeCardProps {
  className?: string
}

/**
 * docs/04-FRONTEND-DESIGN.md #6: shown for the first live call in a
 * session. A determinate progress bar, not a spinner - and copy that
 * says plainly why the wait exists, since an unexplained multi-second
 * pause reads as broken.
 */
export function WakeCard({ className }: WakeCardProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const start = Date.now()
    const interval = setInterval(() => {
      setProgress(Math.min(100, ((Date.now() - start) / ESTIMATED_WAKE_MS) * 100))
    }, 250)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      role="status"
      className={cn("rounded-xl border border-border bg-muted p-4", className)}
    >
      <p className="text-sm font-medium text-foreground">Waking up the live server…</p>
      <p className="mt-1 text-xs text-muted-foreground">
        The API runs on a free tier and sleeps when idle - this is a cost decision, not a bug.
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border" aria-hidden="true">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
