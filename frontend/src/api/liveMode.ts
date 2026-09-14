import { useSyncExternalStore } from "react"

import { pingHealth } from "@/api/client"

const LIVE_STORAGE_KEY = "invoiceready:live"

type Listener = () => void

/**
 * A tiny external store, not a context provider - same call as
 * useIntakeState's ("no context provider, no store library"), except
 * this state genuinely is global (the header pill, the wizard's country
 * picker, and the result page all need to see the same live/demo flag),
 * so it lives in module scope and components subscribe via
 * useSyncExternalStore rather than each holding their own copy.
 */
function createStore<T>(initial: T) {
  let value = initial
  const listeners = new Set<Listener>()
  return {
    get: () => value,
    set(next: T) {
      value = next
      for (const listener of listeners) listener()
    },
    subscribe(listener: Listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

function readInitialLive(): boolean {
  // Escape hatch for environments (CI, Playwright) where a stray
  // localStorage flag from a previous run shouldn't be able to make a
  // test suddenly start hitting a real backend.
  if (import.meta.env.VITE_DEMO_MODE === "true") return false
  if (typeof window === "undefined") return false

  if (new URLSearchParams(window.location.search).get("live") === "1") return true

  try {
    return window.localStorage.getItem(LIVE_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

const liveStore = createStore(readInitialLive())
const wakingStore = createStore(false)
const noticeStore = createStore<string | null>(null)

let hasWokenThisSession = false

/**
 * Demo is the deployed default; a visitor opts into live via the header
 * pill (or a direct `?live=1` link), which persists to localStorage so
 * sending a recruiter the live link keeps working on their next visit
 * (docs/04-FRONTEND-DESIGN.md #6).
 */
export function setLive(next: boolean): void {
  liveStore.set(next)

  try {
    if (next) window.localStorage.setItem(LIVE_STORAGE_KEY, "1")
    else window.localStorage.removeItem(LIVE_STORAGE_KEY)
  } catch {
    // Best-effort persistence only - the in-memory store still governs
    // this page view either way.
  }

  const url = new URL(window.location.href)
  if (next) url.searchParams.set("live", "1")
  else url.searchParams.delete("live")
  window.history.replaceState(null, "", url)

  if (next) {
    hasWokenThisSession = false
    pingHealth()
  }
}

export function useLiveMode(): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(liveStore.subscribe, liveStore.get, liveStore.get)
  return [value, setLive]
}

/** Plain (non-hook) read for callers outside a component, e.g. api/liveDataSource.ts's log lines. */
export function isLive(): boolean {
  return liveStore.get()
}

/** True while the first live call this session is in flight - see api/liveDataSource.ts. */
export function useIsWaking(): boolean {
  return useSyncExternalStore(wakingStore.subscribe, wakingStore.get, wakingStore.get)
}

export function isWaking(): boolean {
  return wakingStore.get()
}

export function setWaking(value: boolean): void {
  // Only the *first* live call gets the wake treatment - once the server
  // has answered once, later calls just use the normal loading skeletons.
  if (value && hasWokenThisSession) return
  wakingStore.set(value)
}

export function markWoken(): void {
  hasWokenThisSession = true
}

/** A one-line explanation shown after falling back to demo data - see api/liveDataSource.ts. */
export function useDataSourceNotice(): string | null {
  return useSyncExternalStore(noticeStore.subscribe, noticeStore.get, noticeStore.get)
}

export function getDataSourceNotice(): string | null {
  return noticeStore.get()
}

export function setDataSourceNotice(message: string | null): void {
  noticeStore.set(message)
}
