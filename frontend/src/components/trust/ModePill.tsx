import { useLiveMode } from "@/api/liveMode"
import { cn } from "@/lib/utils"

interface ModePillProps {
  className?: string
}

/**
 * docs/04-FRONTEND-DESIGN.md #6: "a persistent, honest header pill" -
 * always visible, never claims to be live when it isn't. The toggle
 * itself just flips api/liveMode.ts's store; every DataSource consumer
 * (useDataSource()) reacts on its own.
 */
export function ModePill({ className }: ModePillProps) {
  const [live, setLive] = useLiveMode()

  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-xs", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium",
          live ? "border-success/40 text-success" : "border-border text-muted-foreground"
        )}
      >
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-full", live ? "bg-success" : "bg-muted-foreground")}
        />
        {live ? "Live data" : "Demo data"}
      </span>

      {live ? (
        <button
          type="button"
          onClick={() => setLive(false)}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          Back to demo
        </button>
      ) : (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <button type="button" onClick={() => setLive(true)} className="text-primary hover:underline">
            Run it live →
          </button>
          <span>(wakes a free-tier server, ~40s)</span>
        </span>
      )}
    </div>
  )
}
