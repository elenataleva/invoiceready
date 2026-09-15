import type { AskRequest, AssessRequest, DataSource } from "@/api/client"
import { markWoken, setDataSourceNotice, setLive, setWaking } from "@/api/liveMode"

const MAX_ATTEMPTS = 3
const BASE_DELAY_MS = 1000

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withRetry<T>(attempt: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      return await attempt()
    } catch (error) {
      lastError = error
      if (i < MAX_ATTEMPTS - 1) await delay(BASE_DELAY_MS * 2 ** i)
    }
  }
  throw lastError
}

/**
 * Wraps a real HttpDataSource with the cold-start handling
 * docs/04-FRONTEND-DESIGN.md #6 asks for: retry with exponential backoff,
 * a visible "waking up" signal for the first live call in a session
 * (api/liveMode.ts's waking store - read by components/trust/WakeCard),
 * and - if the server still hasn't answered after retrying - falling
 * back to the matching demo fixture and saying so, rather than leaving
 * the visitor on a dead page.
 *
 * Deliberately not TanStack Query, despite #2's stack table naming it:
 * the existing "one DataSource interface, swappable implementations"
 * design from build-order step 3 already gives this a clean seam to wrap
 * retry/fallback behaviour around every method uniformly, without
 * restructuring three components around query keys for a feature that's
 * really about one interface's reliability, not caching. Worth revisiting
 * if the app later needs real cross-component caching.
 */
export function createLiveDataSource(live: DataSource, demo: DataSource): DataSource {
  async function run<T>(showWake: boolean, call: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    if (showWake) setWaking(true)
    try {
      const result = await withRetry(call)
      markWoken()
      return result
    } catch {
      // Still failing after retries - the honest move (per #6) is real
      // demo data with a visible explanation, not a dead end. Reverting
      // the whole session to demo keeps the header pill truthful about
      // what's actually being shown.
      setLive(false)
      setDataSourceNotice("Couldn't reach the live server - showing demo data instead.")
      return fallback()
    } finally {
      setWaking(false)
    }
  }

  return {
    countries: () => run(true, () => live.countries(), () => demo.countries()),
    rules: (country: string) => run(true, () => live.rules(country), () => demo.rules(country)),
    assess: (input: AssessRequest) => run(true, () => live.assess(input), () => demo.assess(input)),
    // Not wake-flagged: by the time someone is typing a follow-up
    // question, an earlier countries()/assess() call has almost always
    // already woken the server - this one still retries and falls back,
    // it just doesn't reopen the big wake card for it.
    ask: (input: AskRequest) => run(false, () => live.ask(input), () => demo.ask(input)),
  }
}
