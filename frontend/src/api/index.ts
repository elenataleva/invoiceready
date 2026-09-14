import { HttpDataSource, type DataSource } from "@/api/client"
import { DemoDataSource } from "@/api/demo"

export type {
  AskRequest,
  AskResponse,
  AssessRequest,
  AssessResponse,
  Country,
  Obligation,
} from "@/api/client"
export type { DataSource } from "@/api/client"

const LIVE_STORAGE_KEY = "invoiceready:live"

/**
 * Demo is the deployed default; a visitor opts into live with `?live=1`,
 * which persists to localStorage so a direct live link keeps working on
 * the next visit (docs/04-FRONTEND-DESIGN.md #6). The `?live=1` param
 * itself is left in the URL for the cold-start wake UI (build-order step
 * 9) to key off, rather than being stripped here.
 */
function wantsLive(): boolean {
  if (typeof window === "undefined") return false

  const params = new URLSearchParams(window.location.search)
  if (params.get("live") === "1") {
    try {
      window.localStorage.setItem(LIVE_STORAGE_KEY, "1")
    } catch {
      // localStorage can throw (private browsing, blocked site data) - the
      // query param still selects live for this page view either way.
    }
    return true
  }

  try {
    return window.localStorage.getItem(LIVE_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

function selectDataSource(): DataSource {
  // Escape hatch for environments (CI, Playwright) where a stray
  // localStorage flag from a previous run shouldn't be able to make a
  // test suddenly start hitting a real backend.
  if (import.meta.env.VITE_DEMO_MODE === "true") return new DemoDataSource()

  return wantsLive() ? new HttpDataSource() : new DemoDataSource()
}

export const dataSource: DataSource = selectDataSource()
