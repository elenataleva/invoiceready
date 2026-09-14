import { useEffect, type ReactNode } from "react"
import { Link } from "react-router"

import { setDataSourceNotice, useDataSourceNotice, useIsWaking } from "@/api/liveMode"
import { DisclaimerBar, ModePill, WakeCard } from "@/components/trust"

const NOTICE_DISPLAY_MS = 6000

/**
 * Header pill + nav + wake card + disclaimer footer, shared by every page
 * so the live/demo status is always visible (docs/04-FRONTEND-DESIGN.md
 * #6) without each page re-implementing the shell. Pages still own their
 * own `<main>` width/padding - this only wraps it.
 */
export function Layout({ children }: { children: ReactNode }) {
  const isWaking = useIsWaking()
  const notice = useDataSourceNotice()

  useEffect(() => {
    if (!notice) return
    const timeout = setTimeout(() => setDataSourceNotice(null), NOTICE_DISPLAY_MS)
    return () => clearTimeout(timeout)
  }, [notice])

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-6 py-3">
        <ModePill />
        <Link to="/how-it-works" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
          How it works
        </Link>
      </header>
      {notice && <p className="px-6 pt-2 text-xs text-warning">{notice}</p>}

      {isWaking && <WakeCard className="mx-6 mt-4" />}

      {children}

      <DisclaimerBar />
    </div>
  )
}
