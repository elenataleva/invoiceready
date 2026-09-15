import { ArrowDownToLine, ArrowUpFromLine, FileText } from "lucide-react"

import type { ObligationKind } from "@/features/assessment/ruleLanguage"
import { cn } from "@/lib/utils"

interface ObligationIconProps {
  kind: ObligationKind
  className?: string
}

/**
 * Direction is the whole point: invoices coming in vs. invoices going out.
 * An arrow into a tray and an arrow out of one carries that distinction
 * before any text is read, which is what the old "receive"/"issue" badges
 * failed to do.
 */
export function ObligationIcon({ kind, className }: ObligationIconProps) {
  const Icon = kind === "receive" ? ArrowDownToLine : kind === "issue" ? ArrowUpFromLine : FileText
  return <Icon className={cn("size-5", className)} aria-hidden="true" />
}
