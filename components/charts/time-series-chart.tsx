'use client'

// Interactive time-series chart — hand-rolled SVG (ADR: docs/superpowers/plans/
// 2026-07-10-chart-kit-and-motion.md). One y-axis only; metrics on different
// scales belong behind a metric switcher, never a second axis.
//
// Interaction contract (dataviz skill): crosshair snaps to the nearest X, one
// tooltip lists every visible series (+ context rows), keyboard gets the same
// readout, and an sr-only table keeps values reachable without hovering.

import { useEffect, useMemo, useRef, useState } from 'react'
import { linearScale, niceTicks, linePath, areaPath } from './scale'
import { formatValue, formatTick, type ValueFormat } from './format'
import { fmtShortDate } from '@/lib/format'

export type TimeSeriesRow = { x: string } & Record<string, number | string>
export type SeriesSpec = { key: string; label: string; color?: string }
export type ContextSpec = { key: string; label: string; format?: ValueFormat }
// A dated annotation ("what happened here") — vertical guide + top label chip.
export type EventMarker = { x: string; label: string }

const PAD = { t: 14, r: 8, b: 22, l: 8 }

export function TimeSeriesChart({
  data,
  series,
  format = 'int',
  currency = 'USD',
  height = 200,
  baseline = 'zero',
  context = [],
  events = [],
  ariaLabel,
}: {
  data: TimeSeriesRow[]
  series: SeriesSpec[]
  format?: ValueFormat
  currency?: string
  height?: number
  baseline?: 'zero' | 'auto'
  context?: ContextSpec[]
  events?: EventMarker[]
  ariaLabel?: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hidden, setHidden] = useState<string[]>([])
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const visible = series.filter((s) => !hidden.includes(s.key))
  const n = data.length

  // event markers → data indices (only those whose x is in the series)
  const eventIdx = useMemo(() => {
    const pos = new Map(data.map((r, i) => [r.x, i]))
    return events
      .map((e) => ({ ...e, i: pos.get(e.x) }))
      .filter((e): e is EventMarker & { i: number } => e.i !== undefined)
  }, [events, data])

  const geom = useMemo(() => {
    if (width === 0 || n < 2 || visible.length === 0) return null
    const values = visible.flatMap((s) => data.map((r) => Number(r[s.key] ?? 0)))
    const dataMin = Math.min(...values)
    const dataMax = Math.max(...values)
    const ticks = niceTicks(baseline === 'zero' ? Math.min(0, dataMin) : dataMin, dataMax, 4)
    const y = linearScale([ticks[0], ticks[ticks.length - 1]], [height - PAD.b, PAD.t])
    const x = linearScale([0, n - 1], [PAD.l, width - PAD.r])
    const pts = (key: string): [number, number][] =>
      data.map((r, i) => [x(i), y(Number(r[key] ?? 0))])
    return { x, y, ticks, pts }
  }, [width, n, visible.map((s) => s.key).join(','), data, height, baseline])

  const idxFromPointer = (clientX: number) => {
    const el = wrapRef.current
    if (!el || !geom || n < 2) return null
    const px = clientX - el.getBoundingClientRect().left
    const t = (px - PAD.l) / (width - PAD.l - PAD.r)
    return Math.max(0, Math.min(n - 1, Math.round(t * (n - 1))))
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (n < 2) return
    const cur = hoverIdx ?? n - 1
    if (e.key === 'ArrowRight') setHoverIdx(Math.min(n - 1, cur + 1))
    else if (e.key === 'ArrowLeft') setHoverIdx(Math.max(0, cur - 1))
    else if (e.key === 'Home') setHoverIdx(0)
    else if (e.key === 'End') setHoverIdx(n - 1)
    else if (e.key === 'Escape') setHoverIdx(null)
    else return
    e.preventDefault()
  }

  const toggle = (key: string) => {
    setHidden((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key)
      // never hide the last visible series — an empty plot answers nothing
      if (series.length - prev.length <= 1) return prev
      return [...prev, key]
    })
    setHoverIdx(null)
  }

  const label = ariaLabel ?? `${visible.map((s) => s.label).join(', ')} over time`
  const hoverRow = hoverIdx !== null ? data[hoverIdx] : null
  const hoverEvent = hoverIdx !== null ? eventIdx.find((e) => e.i === hoverIdx) : undefined
  const prevRow = hoverIdx !== null && hoverIdx > 0 ? data[hoverIdx - 1] : null
  const tooltipOnRight = geom && hoverIdx !== null ? geom.x(hoverIdx) < width * 0.6 : true

  return (
    <div>
      {series.length >= 2 && (
        <div className="mb-2 flex flex-wrap items-center gap-1" role="group" aria-label="Series">
          {series.map((s) => {
            const off = hidden.includes(s.key)
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggle(s.key)}
                aria-pressed={!off}
                className={`cx-press flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${
                  off ? 'text-muted-foreground/60' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span
                  className="inline-block h-0.5 w-3 rounded-full"
                  style={{ background: s.color ?? 'var(--cx-chart-line)', opacity: off ? 0.3 : 1 }}
                  aria-hidden
                />
                {s.label}
              </button>
            )
          })}
        </div>
      )}

      <div ref={wrapRef} className="relative" style={{ height }}>
        {n < 2 ? (
          <div className="flex h-full items-center justify-center font-mono text-xs text-muted-foreground">
            Not enough history yet — check back after tomorrow’s sync.
          </div>
        ) : geom ? (
          <>
            <svg
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label={label}
              tabIndex={0}
              className="block outline-none focus-visible:outline-2"
              onPointerMove={(e) => setHoverIdx(idxFromPointer(e.clientX))}
              onPointerLeave={() => setHoverIdx(null)}
              onKeyDown={onKeyDown}
              onBlur={() => setHoverIdx(null)}
            >
              {/* gridlines + y ticks (hairline, recessive; labels above the line) */}
              {geom.ticks.map((t) => (
                <g key={t}>
                  <line
                    x1={PAD.l}
                    x2={width - PAD.r}
                    y1={geom.y(t)}
                    y2={geom.y(t)}
                    stroke="var(--cx-grid)"
                    strokeWidth="1"
                  />
                  {/* card-colored halo keeps ticks legible where a line crosses them */}
                  <text
                    x={PAD.l}
                    y={geom.y(t) - 4}
                    fill="var(--cx-dim)"
                    stroke="var(--card)"
                    strokeWidth="3"
                    paintOrder="stroke"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                  >
                    {formatTick(t, format, currency)}
                  </text>
                </g>
              ))}

              {/* area wash — single visible series only (overlapping washes lie) */}
              {visible.length === 1 && (
                <path
                  d={areaPath(geom.pts(visible[0].key), height - PAD.b)}
                  fill={visible[0].color ?? 'var(--cx-accent)'}
                  fillOpacity="0.1"
                  className="cx-fade-in"
                />
              )}

              {/* series lines */}
              {visible.map((s) => (
                <path
                  key={s.key}
                  d={linePath(geom.pts(s.key))}
                  fill="none"
                  stroke={s.color ?? 'var(--cx-chart-line)'}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  pathLength={1}
                  className="cx-draw-line"
                />
              ))}

              {/* event guides — dashed verticals with a dot at the top */}
              {eventIdx.map((e) => (
                <g key={`ev-${e.i}`}>
                  <line
                    x1={geom.x(e.i)}
                    x2={geom.x(e.i)}
                    y1={PAD.t}
                    y2={height - PAD.b}
                    stroke="var(--cx-dim)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity="0.55"
                  />
                  <circle cx={geom.x(e.i)} cy={PAD.t} r="3" fill="var(--foreground)" stroke="var(--card)" strokeWidth="1.5" />
                </g>
              ))}

              {/* crosshair + markers */}
              {hoverIdx !== null && (
                <g>
                  <line
                    x1={geom.x(hoverIdx)}
                    x2={geom.x(hoverIdx)}
                    y1={PAD.t}
                    y2={height - PAD.b}
                    stroke="var(--cx-dim)"
                    strokeWidth="1"
                  />
                  {visible.map((s) => (
                    <circle
                      key={s.key}
                      cx={geom.x(hoverIdx)}
                      cy={geom.y(Number(data[hoverIdx][s.key] ?? 0))}
                      r="4"
                      fill={s.color ?? 'var(--cx-chart-line)'}
                      stroke="var(--card)"
                      strokeWidth="2"
                    />
                  ))}
                </g>
              )}

              {/* x labels: first / middle / last */}
              {[0, Math.floor((n - 1) / 2), n - 1]
                .filter((v, i, a) => a.indexOf(v) === i)
                .map((i) => (
                  <text
                    key={i}
                    x={geom.x(i)}
                    y={height - 6}
                    fill="var(--cx-dim)"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
                  >
                    {fmtShortDate(data[i].x)}
                  </text>
                ))}
            </svg>

            {/* event label chips, aligned to each guide */}
            {eventIdx.map((e) => {
              const cx = geom.x(e.i)
              const nearLeft = cx < width * 0.15
              const nearRight = cx > width * 0.85
              return (
                <span
                  key={`evlbl-${e.i}`}
                  className="pointer-events-none absolute top-0 whitespace-nowrap rounded-full border border-border bg-popover px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground shadow-sm"
                  style={{
                    left: cx,
                    transform: `translateX(${nearLeft ? '0' : nearRight ? '-100%' : '-50%'}) translateY(-2px)`,
                  }}
                >
                  {e.label}
                </span>
              )
            })}

            {/* tooltip — values lead, line keys carry identity */}
            {hoverRow && hoverIdx !== null && (
              <div
                className="cx-tooltip top-1 min-w-[9rem] px-3 py-2"
                style={{
                  left: geom.x(hoverIdx),
                  transform: tooltipOnRight ? 'translateX(10px)' : 'translateX(calc(-100% - 10px))',
                }}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {fmtShortDate(hoverRow.x)}
                </p>
                {visible.map((s) => {
                  const v = Number(hoverRow[s.key] ?? 0)
                  const p = prevRow ? Number(prevRow[s.key] ?? 0) : 0
                  const delta = prevRow && p > 0 ? ((v - p) / p) * 100 : null
                  return (
                    <div key={s.key} className="mt-1.5 flex items-baseline gap-2">
                      <span
                        className="inline-block h-0.5 w-3 shrink-0 self-center rounded-full"
                        style={{ background: s.color ?? 'var(--cx-chart-line)' }}
                        aria-hidden
                      />
                      <span className="text-sm font-semibold tabular-nums">
                        {formatValue(v, format, currency)}
                      </span>
                      {visible.length > 1 && (
                        <span className="text-[11px] text-muted-foreground">{s.label}</span>
                      )}
                      {delta !== null && (
                        <span
                          className={`font-mono text-[10px] tabular-nums ${delta >= 0 ? 'text-pos' : 'text-neg'}`}
                        >
                          {delta >= 0 ? '▲' : '▼'}
                          {Math.abs(delta).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  )
                })}
                {context.map((c) => (
                  <p key={c.key} className="mt-1 font-mono text-[10px] tabular-nums text-muted-foreground">
                    {c.label} {formatValue(Number(hoverRow[c.key] ?? 0), c.format ?? 'int', currency)}
                  </p>
                ))}
                {hoverEvent && (
                  <p className="mt-1.5 border-t border-border pt-1.5 text-[11px] leading-snug text-foreground">
                    {hoverEvent.label}
                  </p>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Values stay reachable without a pointer (and for screen readers). */}
      {n >= 2 && (
        <table className="sr-only">
          <caption>{label}</caption>
          <thead>
            <tr>
              <th>Date</th>
              {series.map((s) => (
                <th key={s.key}>{s.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.x}>
                <td>{r.x}</td>
                {series.map((s) => (
                  <td key={s.key}>{formatValue(Number(r[s.key] ?? 0), format, currency)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
