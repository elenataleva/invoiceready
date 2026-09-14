/**
 * Small, generic helpers for reading/writing typed values in a
 * URLSearchParams - used by features/intake/useIntakeState.ts to mirror
 * intake answers into the URL (docs/04-FRONTEND-DESIGN.md #5.1), so a
 * half-finished form survives a refresh without a database session.
 */

export function getStringParam(params: URLSearchParams, key: string): string | undefined {
  return params.get(key) ?? undefined
}

export function getBoolParam(params: URLSearchParams, key: string): boolean | undefined {
  const raw = params.get(key)
  if (raw === null) return undefined
  return raw === "1"
}

export function getListParam(params: URLSearchParams, key: string): string[] | undefined {
  const raw = params.get(key)
  if (!raw) return undefined
  return raw.split(",").filter(Boolean)
}

export function setOrDeleteParam(params: URLSearchParams, key: string, value: string | undefined): void {
  if (value === undefined || value === "") {
    params.delete(key)
  } else {
    params.set(key, value)
  }
}
