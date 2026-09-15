import { useNavigate } from "react-router"

import { Layout } from "@/components/Layout"
import { AssessmentPreview } from "@/features/assessment"
import { Wizard } from "@/features/intake/Wizard"
import { useIntakeState, writeIntakeState } from "@/features/intake/useIntakeState"

/**
 * `/` - split intake (docs/04-FRONTEND-DESIGN.md #3.1): wizard on the
 * left, live country reference on the right (#3.2). Below 900px the grid
 * collapses to one column with the preview below the form via plain DOM
 * order - no `order-*` needed, since the wizard already comes first in
 * markup and a one-column grid stacks children top to bottom.
 *
 * Completing the wizard navigates to /result, re-encoding the completed
 * profile itself (via writeIntakeState) rather than reading
 * window.location - useIntakeState's URL write on the final step and this
 * navigation can otherwise race, since the URL update isn't guaranteed to
 * have flushed before this callback runs.
 */
export function Landing() {
  const [intake, updateIntake] = useIntakeState()
  const navigate = useNavigate()

  return (
    <Layout>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-14">
        <div className="grid grid-cols-1 items-start gap-8 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] min-[900px]:gap-12">
          <Wizard
            state={intake}
            onChange={updateIntake}
            onComplete={(profile) => {
              const params = new URLSearchParams()
              writeIntakeState(params, profile)
              navigate({ pathname: "/result", search: params.toString() })
            }}
          />

          <AssessmentPreview profile={intake} />
        </div>
      </main>
    </Layout>
  )
}
