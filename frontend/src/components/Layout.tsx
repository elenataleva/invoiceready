import { useEffect, type ReactNode } from "react"
import { Link } from "react-router"

import { setDataSourceNotice, useDataSourceNotice, useIsWaking } from "@/api/liveMode"
import { EuRing } from "@/components/EuRing"
import { EuStars } from "@/components/EuStars"
import { DisclaimerBar, ModePill, WakeCard } from "@/components/trust"

const NOTICE_DISPLAY_MS = 6000

/**
 * Brand + mode pill + wake card + disclaimer, shared by every page so the
 * live/demo status is always visible (docs/04-FRONTEND-DESIGN.md #6)
 * without each page re-implementing the shell. Pages still own their own
 * `<main>` width and padding - this only wraps it.
 *
 * The twelve EU stars sit behind everything at low opacity: this product
 * only exists because of an EU directive, and the motif says so without
 * spending a line of copy on it. Purely decorative - fixed, non-scrolling,
 * and never carrying information the page doesn't also state in words.
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
    <div className="relative flex min-h-svh flex-col">
      <EuStars
        aria-hidden="true"
        className="pointer-events-none fixed -bottom-40 -left-40 -z-10 size-[42rem] text-primary/[0.045] select-none"
      />

      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-3">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-foreground"
        >
          <EuRing className="size-[18px] text-primary" />
          InvoiceReady
        </Link>

        <div className="flex flex-wrap items-center gap-4">
          <ModePill />
          <Link
            to="/how-it-works"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            How it works
          </Link>
        </div>
      </header>

      {notice && <p className="px-6 pt-3 text-xs text-warning">{notice}</p>}

      {isWaking && <WakeCard className="mx-6 mt-4" />}

      {children}

      <DisclaimerBar />
    </div>
  )
}
