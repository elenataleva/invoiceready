const STAR_COUNT = 12
const RING_RADIUS = 34
const STAR_RADIUS = 6.5
// A pentagram's inner vertices sit at ~0.382 of the outer radius - the
// proportion that makes a five-pointed star read as a star rather than a
// cog. Same construction as the European flag's own specification.
const INNER_RATIO = 0.382

function starPath(cx: number, cy: number, radius: number): string {
  const points: string[] = []
  for (let i = 0; i < 10; i++) {
    // Start at -90deg so every star sits point-up, as on the flag.
    const angle = (Math.PI / 5) * i - Math.PI / 2
    const r = i % 2 === 0 ? radius : radius * INNER_RATIO
    points.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`)
  }
  return `M${points.join("L")}Z`
}

const STARS = Array.from({ length: STAR_COUNT }, (_, index) => {
  const angle = (index / STAR_COUNT) * 2 * Math.PI - Math.PI / 2
  return starPath(50 + RING_RADIUS * Math.cos(angle), 50 + RING_RADIUS * Math.sin(angle), STAR_RADIUS)
})

interface EuStarsProps {
  className?: string
}

/**
 * The twelve stars of the European flag, drawn as real five-pointed stars
 * rather than the abstracted dots used for the small brand mark - at the
 * scale this renders, the star shape is what carries the "this is EU
 * regulation" signal. Always decorative: it sits behind content at low
 * opacity and never encodes information the page doesn't state in words.
 */
export function EuStars({ className }: EuStarsProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      {STARS.map((path) => (
        <path key={path} d={path} fill="currentColor" />
      ))}
    </svg>
  )
}
