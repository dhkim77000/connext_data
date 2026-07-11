// Pure chart math — no DOM, no React. Kept separate so the geometry the charts
// depend on is unit-testable (tests/lib/charts/scale.test.ts).

export function linearScale(
  domain: [number, number],
  range: [number, number],
): (v: number) => number {
  const [d0, d1] = domain
  const [r0, r1] = range
  const span = d1 - d0 || 1
  return (v) => r0 + ((v - d0) / span) * (r1 - r0)
}

// d3-style tick increment: normalize the raw step into [1,10) and snap to 1/2/5
// with the 1.5 / 3 / 7 thresholds, so axes land on clean 1-2-5×10ⁿ numbers.
function tickStep(span: number, count: number): number {
  const raw = span / Math.max(1, count)
  const power = Math.floor(Math.log10(raw))
  const magnitude = Math.pow(10, power)
  const norm = raw / magnitude
  const factor = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10
  return factor * magnitude
}

// Ascending ticks on clean steps; first ≤ min, last ≥ max (the chart uses the
// outer ticks as its y-domain so the top gridline always clears the data).
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return []
  if (min > max) [min, max] = [max, min]
  if (min === max) max = min + 1
  const step = tickStep(max - min, count)
  const i0 = Math.floor(min / step)
  const i1 = Math.ceil(max / step)
  const ticks: number[] = []
  for (let i = i0; i <= i1; i++) {
    // kill float dust (0.30000000000000004) without distorting real values
    ticks.push(Number((i * step).toPrecision(12)))
  }
  return ticks
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2))))

export function linePath(pts: [number, number][]): string {
  if (pts.length === 0) return ''
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${fmt(x)},${fmt(y)}`).join(' ')
}

export function areaPath(pts: [number, number][], baselineY: number): string {
  if (pts.length === 0) return ''
  const [firstX] = pts[0]
  const [lastX] = pts[pts.length - 1]
  return `${linePath(pts)} L${fmt(lastX)},${fmt(baselineY)} L${fmt(firstX)},${fmt(baselineY)} Z`
}
