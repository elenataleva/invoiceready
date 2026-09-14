import { HttpDataSource, type DataSource } from "@/api/client"
import { DemoDataSource } from "@/api/demo"
import { createLiveDataSource } from "@/api/liveDataSource"
import { useLiveMode } from "@/api/liveMode"

export type {
  AskRequest,
  AskResponse,
  AssessRequest,
  AssessResponse,
  Country,
  Obligation,
} from "@/api/client"
export type { DataSource } from "@/api/client"
export { useLiveMode, useIsWaking, useDataSourceNotice } from "@/api/liveMode"

// Singletons, not re-created per render - createLiveDataSource wraps the
// same two instances every time, so its internal retry/backoff state
// (none currently, but the interface would want it) isn't reset on every
// mode toggle.
const httpInstance = new HttpDataSource()
const demoInstance = new DemoDataSource()
const liveInstance = createLiveDataSource(httpInstance, demoInstance)

/**
 * The one place a component decides "demo or live" - returns a different
 * DataSource identity when the mode flips, so an effect that depends on
 * this hook's return value naturally refetches (docs/04-FRONTEND-DESIGN.md
 * #6). Replaces the old load-time-only `dataSource` constant, which had
 * no way to react to the header pill's toggle.
 */
export function useDataSource(): DataSource {
  const [live] = useLiveMode()
  return live ? liveInstance : demoInstance
}
