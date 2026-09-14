import { useState } from "react"

import { Skeleton } from "@/components/trust"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface NextStepsProps {
  steps: string[] | undefined
  /** Scopes the checked state to one assessment (e.g. a profile hash) - without it, checking a step for one profile would bleed into every other. */
  storageKey: string
  className?: string
}

function loadChecked(storageKey: string): Set<number> {
  try {
    const raw = window.localStorage.getItem(`invoiceready:next-steps:${storageKey}`)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    // Private browsing, blocked site data, or a corrupt value - the
    // checklist still works for this session, it just won't persist.
    return new Set()
  }
}

function saveChecked(storageKey: string, checked: Set<number>): void {
  try {
    window.localStorage.setItem(
      `invoiceready:next-steps:${storageKey}`,
      JSON.stringify([...checked])
    )
  } catch {
    // Nothing to recover - see loadChecked.
  }
}

/**
 * docs/04-FRONTEND-DESIGN.md #3.3 item 4: "free, and it makes the page
 * feel like a tool rather than a report." Purely client-side - the check
 * state is never sent anywhere.
 *
 * State is initialised straight from localStorage rather than loaded in
 * an effect, so there's no unchecked-then-checked flash on mount. If a
 * caller ever needs to swap `storageKey` on an already-mounted instance,
 * render with `key={storageKey}` to force a clean remount instead of
 * teaching this component to re-sync itself mid-life.
 */
export function NextSteps({ steps, storageKey, className }: NextStepsProps) {
  const [checked, setChecked] = useState<Set<number>>(() => loadChecked(storageKey))

  if (steps === undefined) {
    return (
      <div className={cn("space-y-2", className)}>
        <Skeleton w="90%" h="1.25rem" className="block" />
        <Skeleton w="75%" h="1.25rem" className="block" />
        <Skeleton w="60%" h="1.25rem" className="block" />
      </div>
    )
  }

  if (steps.length === 0) return null

  function toggle(index: number, isChecked: boolean) {
    const next = new Set(checked)
    if (isChecked) next.add(index)
    else next.delete(index)
    setChecked(next)
    saveChecked(storageKey, next)
  }

  return (
    <ol className={cn("space-y-2", className)}>
      {steps.map((step, index) => (
        <li key={index}>
          <Label
            htmlFor={`step-${storageKey}-${index}`}
            className="flex cursor-pointer items-start gap-2.5 font-normal"
          >
            <Checkbox
              id={`step-${storageKey}-${index}`}
              checked={checked.has(index)}
              onCheckedChange={(value) => toggle(index, value === true)}
              className="mt-0.5"
            />
            <span
              className={cn(
                "text-sm leading-relaxed text-foreground",
                checked.has(index) && "text-muted-foreground line-through"
              )}
            >
              {step}
            </span>
          </Label>
        </li>
      ))}
    </ol>
  )
}
