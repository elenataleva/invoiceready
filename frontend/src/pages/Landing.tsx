import { useState } from "react"

import { DisclaimerBar } from "@/components/trust"
import { Wizard } from "@/features/intake/Wizard"
import type { CompleteIntakeState } from "@/features/intake/types"
import { toAssessRequest } from "@/features/intake/types"
import { useIntakeState } from "@/features/intake/useIntakeState"

/**
 * `/` - the intake wizard. The split layout with the live assessment
 * preview (docs/04-FRONTEND-DESIGN.md #3.1-#3.2) is build-order step 6b;
 * for now this renders just the left column, plus a plain completion
 * summary standing in for the real submit-to-/result flow (step 7).
 */
export function Landing() {
  const [intake, updateIntake] = useIntakeState()
  const [completed, setCompleted] = useState<CompleteIntakeState | null>(null)

  return (
    <div className="flex min-h-svh flex-col">
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
        <h1 className="mb-8 text-2xl font-medium tracking-tight text-foreground">InvoiceReady</h1>

        {completed ? (
          <div className="space-y-4">
            <h2 className="text-xl font-medium text-foreground">Profile complete</h2>
            <p className="text-sm text-muted-foreground">
              This is the exact body the wizard would now POST to <code>/api/assess</code> - that
              call, and the result page rendering it, land in a later step.
            </p>
            <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-4 text-xs">
              {JSON.stringify(toAssessRequest(completed), null, 2)}
            </pre>
          </div>
        ) : (
          <Wizard state={intake} onChange={updateIntake} onComplete={setCompleted} />
        )}
      </main>

      <DisclaimerBar />
    </div>
  )
}
