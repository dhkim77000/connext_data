// Hand-rolled SVG sparkline — no chart library (keeps the bundle lean and the look ours).
// Pure/server-renderable: give it values, it draws a soft area + line in the accent hue.

export function Sparkline({
  points,
  width = 240,
  height = 60,
  className,
}: {
  points: number[]
  width?: number
  height?: number
  className?: string
}) {
  const vals = points.length === 1 ? [points[0], points[0]] : points
  if (vals.length < 2) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className={className} preserveAspectRatio="none" aria-hidden>
        <line x1="0" y1={height - 4} x2={width} y2={height - 4} stroke="var(--cx-grid)" strokeWidth="1" />
      </svg>
    )
  }

  const max = Math.max(...vals)
  const min = Math.min(...vals, 0)
  const range = max - min || 1
  const pad = 5
  const dx = width / (vals.length - 1)
  const coords = vals.map((v, i): [number, number] => [
    i * dx,
    height - pad - ((v - min) / range) * (height - pad * 2),
  ])
  const line = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${width.toFixed(1)},${height} L0,${height} Z`
  const [lastX, lastY] = coords[coords.length - 1]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} preserveAspectRatio="none" aria-hidden>
      <path d={area} fill="var(--cx-accent)" fillOpacity="0.10" />
      <path
        d={line}
        fill="none"
        stroke="var(--cx-accent)"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r="2.75" fill="var(--cx-accent)" />
    </svg>
  )
}
