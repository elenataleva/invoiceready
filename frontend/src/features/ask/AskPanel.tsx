import { useState } from "react"

import { useDataSource } from "@/api"
import type { AskResponse } from "@/api/client"
import { RefusalCard, Skeleton } from "@/components/trust"
import { Button } from "@/components/ui/button"
import { STARTER_QUESTIONS } from "@/features/ask/starterQuestions"
import { renderLiteMarkdown } from "@/lib/markdown-lite"
import { cn } from "@/lib/utils"

interface AskPanelProps {
  country: string
  className?: string
}

type AskState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "answered"; response: AskResponse }
  | { status: "failed" }

/**
 * docs/04-FRONTEND-DESIGN.md #3.4: three designed states, one component -
 * answered (prose + citations), refused (RefusalCard, from build-order
 * step 4 - deliberately not an error state), and loading (skeleton lines,
 * "never a centred spinner"). A fourth state, `failed`, exists for a real
 * network/API failure, which is NOT the same thing as `refused: true` -
 * refused is the system correctly declining to guess; failed is the
 * request not completing at all, and gets a plain, low-key message
 * instead of the calm, confident refusal design.
 */
export function AskPanel({ country, className }: AskPanelProps) {
  const ds = useDataSource()
  const [question, setQuestion] = useState("")
  const [state, setState] = useState<AskState>({ status: "idle" })

  const starters = STARTER_QUESTIONS[country] ?? []

  async function ask(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed) return

    setQuestion(trimmed)
    setState({ status: "loading" })
    try {
      const response = await ds.ask({ country, question: trimmed })
      setState({ status: "answered", response })
    } catch {
      setState({ status: "failed" })
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <h2 className="text-lg font-medium text-foreground">Ask a follow-up</h2>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void ask(question)
        }}
        className="flex gap-2"
      >
        <label htmlFor="ask-question" className="sr-only">
          Ask a question about e-invoicing compliance
        </label>
        <input
          id="ask-question"
          type="text"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="e.g. What format do I need to use?"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button type="submit" disabled={state.status === "loading" || !question.trim()}>
          Ask
        </Button>
      </form>

      {state.status === "idle" && starters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {starters.map((starter) => (
            <button
              key={starter}
              type="button"
              onClick={() => void ask(starter)}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              {starter}
            </button>
          ))}
        </div>
      )}

      <div aria-live="polite">
        {state.status === "loading" && (
          <div className="space-y-2 rounded-xl border border-border bg-card p-4">
            <Skeleton w="100%" h="1rem" className="block" />
            <Skeleton w="90%" h="1rem" className="block" />
            <Skeleton w="60%" h="1rem" className="block" />
          </div>
        )}

        {state.status === "failed" && (
          <p className="text-sm text-muted-foreground">
            Couldn't reach the server just now - try again in a moment.
          </p>
        )}

        {state.status === "answered" && <AskResult response={state.response} />}
      </div>
    </div>
  )
}

function AskResult({ response }: { response: AskResponse }) {
  if (response.refused) {
    return <RefusalCard message={response.answer} />
  }

  // A grounded answer the backend didn't actually attach a citation to
  // would violate #1.1 ("every claim shows its receipt") - defend that
  // here too, not just trust app/routers/ask.py to always uphold it.
  if (response.citations.length === 0) {
    return (
      <RefusalCard message="This answer arrived without a source, so it isn't shown. Please check the official source for your country's e-invoicing rules." />
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="space-y-2 text-sm leading-relaxed text-foreground">
        {renderLiteMarkdown(response.answer)}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        {response.citations.map((url, index) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            [{index + 1}] Source
          </a>
        ))}
      </div>
    </div>
  )
}
