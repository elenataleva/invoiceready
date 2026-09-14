const DOT_COUNT = 12
const DOTS = Array.from({ length: DOT_COUNT }, (_, index) => {
  const angle = (index / DOT_COUNT) * 2 * Math.PI - Math.PI / 2
  return { cx: 50 + 40 * Math.cos(angle), cy: 50 + 40 * Math.sin(angle) }
})

interface EuRingProps {
  className?: string
}

/**
 * docs/04-FRONTEND-DESIGN.md #3.1: "a ring of twelve dots (the EU stars,
 * abstracted so they stay legible at 19px)... never an emoji flag, which
 * renders differently on every platform and can't be recoloured." Inline
 * SVG, sized/coloured entirely by the caller (brand mark vs. background
 * motif reuse the same component at different scales and opacities).
 */
export function EuRing({ className }: EuRingProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      {DOTS.map((dot) => (
        <circle key={`${dot.cx}-${dot.cy}`} cx={dot.cx} cy={dot.cy} r="4" fill="currentColor" />
      ))}
    </svg>
  )
}
