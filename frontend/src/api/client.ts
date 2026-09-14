import type { components } from "@/api/schema"

// Aliased from the generated schema rather than redeclared - schema.d.ts is
// the single source of truth (docs/04-FRONTEND-DESIGN.md #5), so a renamed
// or restructured Pydantic field becomes a type error here, not a silent
// drift between what the backend sends and what the UI expects.
export type Country = components["schemas"]["CountryOut"]
export type AssessRequest = components["schemas"]["AssessRequest"]
export type AssessResponse = components["schemas"]["AssessResponse"]
export type Obligation = components["schemas"]["Obligation"]
export type AskRequest = components["schemas"]["AskRequest"]
export type AskResponse = components["schemas"]["AskResponse"]

/**
 * One interface, two implementations (docs/04-FRONTEND-DESIGN.md #6):
 * HttpDataSource talks to the real API, DemoDataSource (src/api/demo.ts)
 * resolves from committed fixtures. Every screen depends on this
 * interface, never on fetch or the fixtures directly, so the demo/live
 * toggle is a one-line swap in src/api/index.ts rather than a prop
 * threaded through every component.
 */
export interface DataSource {
  countries(): Promise<Country[]>
  assess(input: AssessRequest): Promise<AssessResponse>
  ask(input: AskRequest): Promise<AskResponse>
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  })

  if (!response.ok) {
    // Includes the body text (FastAPI's 422/429 detail, e.g. rate-limit
    // messages) so a caller has something more useful than a bare status
    // code - e.g. api/liveDataSource.ts's retry/fallback wrapper.
    throw new Error(`${path} failed: ${response.status} ${await response.text()}`)
  }

  return response.json() as Promise<T>
}

/**
 * Fire-and-forget GET /health, used to start a free-tier server waking up
 * the moment a visitor flips to live mode (docs/04-FRONTEND-DESIGN.md #6),
 * before they've actually submitted anything that needs a real answer.
 */
export function pingHealth(): void {
  fetch(`${API_BASE_URL}/health`).catch(() => {
    // Best-effort prewarm only - a failure here isn't reported anywhere;
    // the real request that follows will retry and report properly.
  })
}

export class HttpDataSource implements DataSource {
  countries(): Promise<Country[]> {
    return request<Country[]>("/api/countries")
  }

  assess(input: AssessRequest): Promise<AssessResponse> {
    return request<AssessResponse>("/api/assess", {
      method: "POST",
      body: JSON.stringify(input),
    })
  }

  ask(input: AskRequest): Promise<AskResponse> {
    return request<AskResponse>("/api/ask", {
      method: "POST",
      body: JSON.stringify(input),
    })
  }
}
