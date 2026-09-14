import type { Obligation } from "@/api/client"

export interface Source {
  url: string
  reviewedAt: string
}

/** Every obligation cites a source; several often cite the same one - collect once, don't repeat the badge. */
export function sourcesFromObligations(obligations: Obligation[]): Source[] {
  const byUrl = new Map<string, Source>()
  for (const obligation of obligations) {
    if (!byUrl.has(obligation.source_url)) {
      byUrl.set(obligation.source_url, {
        url: obligation.source_url,
        reviewedAt: obligation.source_reviewed_at,
      })
    }
  }
  return [...byUrl.values()]
}
