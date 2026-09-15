import { useState } from "react"

import { cn } from "@/lib/utils"

import { CounterpartyStep } from "@/features/intake/steps/CounterpartyStep"
import { CountryStep } from "@/features/intake/steps/CountryStep"
import { ProfileStep } from "@/features/intake/steps/ProfileStep"
import type { CompleteIntakeState, IntakeState } from "@/features/intake/types"
import { isComplete } from "@/features/intake/types"

const STEP_COUNT = 3

interface WizardProps {
  state: IntakeState
  onChange: (patch: Partial<IntakeState>) => void
  onComplete: (profile: CompleteIntakeState) => void
}

function firstIncompleteStep(state: IntakeState): number {
  if (!state.country) return 0
  if (state.vatRegistered === undefined || !state.employeeBand || !state.turnoverBand) return 1
  return 2
}

/**
 * One question per step (docs/04-FRONTEND-DESIGN.md #3.1): country, then
 * VAT status + size, then who they invoice. Back is always available; the
 * step position itself is local (not URL-persisted - only the answers
 * are, via useIntakeState), initialised to the first unanswered step so
 * a refresh resumes where the user left off rather than restarting them.
 */
export function Wizard({ state, onChange, onComplete }: WizardProps) {
  const [step, setStep] = useState(() => firstIncompleteStep(state))

  return (
    <div className="space-y-7">
      <div className="flex items-center gap-3">
        <span
          className="text-xs font-semibold tracking-[0.08em] whitespace-nowrap text-muted-foreground uppercase tabular-nums"
          aria-live="polite"
        >
          Step {step + 1} of {STEP_COUNT}
        </span>
        <div className="flex flex-1 gap-1.5" aria-hidden="true">
          {Array.from({ length: STEP_COUNT }, (_, index) => (
            <div
              key={index}
              className={cn(
                "h-[3px] flex-1 rounded-full transition-colors",
                index <= step ? "bg-primary" : "bg-border"
              )}
            />
          ))}
        </div>
      </div>

      {step === 0 && (
        <CountryStep
          defaultValue={state.country}
          onSelect={onChange}
          onNext={(values) => {
            onChange(values)
            setStep(1)
          }}
        />
      )}

      {step === 1 && (
        <ProfileStep
          defaultValues={{
            vatRegistered:
              state.vatRegistered === undefined ? undefined : state.vatRegistered ? "yes" : "no",
            employeeBand: state.employeeBand,
            turnoverBand: state.turnoverBand,
          }}
          onSelect={onChange}
          onNext={(values) => {
            onChange({ ...values, vatRegistered: values.vatRegistered === "yes" })
            setStep(2)
          }}
          onBack={() => setStep(0)}
        />
      )}

      {step === 2 && (
        <CounterpartyStep
          defaultValues={{ invoicesTo: state.invoicesTo }}
          onSelect={onChange}
          onNext={(values) => {
            const next = { ...state, ...values }
            onChange(values)
            if (isComplete(next)) onComplete(next)
          }}
          onBack={() => setStep(1)}
        />
      )}
    </div>
  )
}
