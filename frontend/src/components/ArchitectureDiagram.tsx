interface ArchitectureDiagramProps {
  className?: string
}

/**
 * docs/04-FRONTEND-DESIGN.md #3.5: "the architecture diagram (rules
 * engine vs. LLM boundary), as inline SVG." Two lanes: the assess path,
 * which never reaches the LLM for a date/threshold/format (left), and
 * the ask path, where the LLM only ever writes prose over content that
 * was already retrieved - it never runs without grounding, and grounding
 * failure is a refusal, not a fallback to the model's own knowledge.
 */
export function ArchitectureDiagram({ className }: ArchitectureDiagramProps) {
  return (
    <svg
      viewBox="0 0 720 400"
      className={className}
      role="img"
      aria-label="Architecture diagram: a business profile flows through the deterministic rules engine to produce obligations without ever reaching the LLM; a question flows through country-filtered retrieval, and only if grounding content is found does the LLM write prose over it - otherwise the system refuses."
    >
      <defs>
        <marker id="arch-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="fill-muted-foreground" />
        </marker>
      </defs>

      {/* Lane labels */}
      <text x="16" y="28" className="fill-muted-foreground text-[13px] font-medium uppercase tracking-wide">
        POST /api/assess
      </text>
      <text x="16" y="220" className="fill-muted-foreground text-[13px] font-medium uppercase tracking-wide">
        POST /api/ask
      </text>

      {/* --- Assess lane (deterministic, top) --- */}
      <g>
        <rect x="16" y="44" width="150" height="52" rx="10" className="fill-card stroke-border" />
        <text x="91" y="75" textAnchor="middle" className="fill-foreground text-[13px]">
          Business profile
        </text>

        <line x1="166" y1="70" x2="220" y2="70" className="stroke-muted-foreground" markerEnd="url(#arch-arrow)" />

        <rect x="220" y="40" width="190" height="60" rx="10" className="fill-primary/10 stroke-primary" />
        <text x="315" y="65" textAnchor="middle" className="fill-foreground text-[13px] font-medium">
          Rules engine
        </text>
        <text x="315" y="83" textAnchor="middle" className="fill-muted-foreground text-[11px]">
          rules_engine.py - plain SQL
        </text>

        <line x1="410" y1="70" x2="464" y2="70" className="stroke-muted-foreground" markerEnd="url(#arch-arrow)" />

        <rect x="464" y="44" width="180" height="52" rx="10" className="fill-card stroke-border" />
        <text x="554" y="65" textAnchor="middle" className="fill-foreground text-[13px]">
          Obligations
        </text>
        <text x="554" y="82" textAnchor="middle" className="fill-muted-foreground text-[11px]">
          dates, format, network
        </text>
      </g>

      <text x="315" y="128" textAnchor="middle" className="fill-muted-foreground text-[11px] italic">
        The LLM only ever writes the plain-language explanation next to these facts - never the facts themselves.
      </text>

      {/* --- Ask lane (LLM-boundary, bottom) --- */}
      <g>
        <rect x="16" y="236" width="120" height="52" rx="10" className="fill-card stroke-border" />
        <text x="76" y="267" textAnchor="middle" className="fill-foreground text-[13px]">
          Question
        </text>

        <line x1="136" y1="262" x2="190" y2="262" className="stroke-muted-foreground" markerEnd="url(#arch-arrow)" />

        <rect x="190" y="232" width="190" height="60" rx="10" className="fill-card stroke-border" />
        <text x="285" y="257" textAnchor="middle" className="fill-foreground text-[13px] font-medium">
          Retrieval
        </text>
        <text x="285" y="275" textAnchor="middle" className="fill-muted-foreground text-[11px]">
          country filter, then vector search
        </text>

        <line x1="380" y1="262" x2="434" y2="262" className="stroke-muted-foreground" markerEnd="url(#arch-arrow)" />

        {/* Branch: grounded -> LLM; ungrounded -> refuse */}
        <line x1="434" y1="262" x2="434" y2="200" className="stroke-muted-foreground" />
        <line x1="434" y1="200" x2="464" y2="200" className="stroke-muted-foreground" markerEnd="url(#arch-arrow)" />
        <line x1="434" y1="262" x2="434" y2="330" className="stroke-muted-foreground" />
        <line x1="434" y1="330" x2="464" y2="330" className="stroke-muted-foreground" markerEnd="url(#arch-arrow)" />

        <text x="440" y="230" className="fill-muted-foreground text-[10px]">
          grounded
        </text>
        <text x="440" y="322" className="fill-muted-foreground text-[10px]">
          nothing found
        </text>

        <rect x="464" y="170" width="220" height="60" rx="10" className="fill-primary/10 stroke-primary" />
        <text x="574" y="195" textAnchor="middle" className="fill-foreground text-[13px] font-medium">
          Claude
        </text>
        <text x="574" y="213" textAnchor="middle" className="fill-muted-foreground text-[11px]">
          writes prose only, cites sources
        </text>

        <rect x="464" y="300" width="220" height="60" rx="10" className="fill-muted stroke-border" />
        <text x="574" y="325" textAnchor="middle" className="fill-foreground text-[13px] font-medium">
          Refusal
        </text>
        <text x="574" y="343" textAnchor="middle" className="fill-muted-foreground text-[11px]">
          no LLM call at all
        </text>
      </g>
    </svg>
  )
}
