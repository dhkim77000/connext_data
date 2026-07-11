'use client'

// Stacked-area time series — composition of a total over time (e.g. store
// revenue split by product). Bands stack bottom-to-top with a 2px surface gap
// between them; a crosshair tooltip lists every band + the total at that x.
// Legend items toggle bands; an sr-only table keeps values reachable.

import { useEffect, useMemo, useRef, useState } from 'react'
import { linearScale, niceTicks } from './scale'
import { formatValue, formatTick, type ValueFormat } from './format'
import { fmtShortDate } from '@/lib/format'

export type StackRow = { x: string } & Record<string, number | string>
export type BandSpec = { key: string; label: string; color: string }

const PAD = { t: 14, r: 8, b: 22, l: 8 }

export function StackedAreaChart({
  data,
  bands,
  format = 'currency',
  currency = 'USD',
  height = 220,
}: {
  data: StackRow[]
  bands: readonly BandSpec[]
  format?: ValueFormat
  currency?: string
  height?: number
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

  const visible = bands.filter((b) => !hidden.includes(b.key))
  const n = data.length

  const geom = useMemo(() => {
    if (width === 0 || n < 2 || visible.length === 0) return null
    const totals = data.map((r) => visible.reduce((a, b) => a + Number(r[b.key] ?? 0), 0))
    const ticks = niceTicks(0, Math.max(...totals), 4)
    const y = linearScale([0, ticks[ticks.length - 1]], [height - PAD.b, PAD.t])
    const x = linearScale([0, n - 1], [PAD.l, width - PAD.r])
    // cumulative upper boundary per band (bottom band first)
    const cum = data.map(() => 0)
    const bandPaths = visible.map((b) => {
      const lower = cum.map((v) => v)
      data.forEach((r, i) => (cum[i] += Number(r[b.key] ?? 0)))
      const upper = cum.map((v) => v)
      const top = upper.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
      const bottom = lower.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).reverse()
      return { key: b.key, color: b.color, d: `M${top.join(' L')} L${bottom.join(' L')} Z`, upper }
    })
    return { x, y, ticks, totals, bandPaths }
  }, [width, n, visible.map((b) => b.key).join(','), data, height])

  const idxFromPointer = (clientX: number) => {
    const el = wrapRef.current
    if (!el || !geom || n < 2) return null
    const px = clientX - el.getBoundingClientRect().left
    const t = (px - PAD.l) / (width - PAD.l - PAD.r)
    return Math.max(0, Math.min(n - 1, Math.round(t * (n - 1))))
  }

  const toggle = (key: string) => {
    setHidden((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key)
      if (bands.length - prev.length <= 1) return prev // keep at least one
      return [...prev, key]
    })
    setHoverIdx(null)
  }

  const hoverRow = hoverIdx !== null ? data[hoverIdx] : null
  const tooltipOnRight = geom && hoverIdx !== null ? geom.x(hoverIdx) < width * 0.6 : true

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1" role="group" aria-label="Products">
        {bands.map((b) => {
          const off = hidden.includes(b.key)
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => toggle(b.key)}
              aria-pressed={!off}
              className={`cx-press flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] ${
                off ? 'text-muted-foreground/60' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="inline-block h-2 w-2 shrink-0 rounded-[2px]" style={{ background: b.color, opacity: off ? 0.3 : 1 }} aria-hidden />
              {b.label}
            </button>
          )
        })}
      </div>

      <div ref={wrapRef} className="relative" style={{ height }}>
        {geom && n >= 2 ? (
          <>
            <svg
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label="Revenue by product over time"
              className="block"
              onPointerMove={(e) => setHoverIdx(idxFromPointer(e.clientX))}
              onPointerLeave={() => setHoverIdx(null)}
            >
              {geom.ticks.map((t) => (
                <g key={t}>
                  <line x1={PAD.l} x2={width - PAD.r} y1={geom.y(t)} y2={geom.y(t)} stroke="var(--cx-grid)" strokeWidth="1" />
                  <text x={PAD.l} y={geom.y(t) - 4} fill="var(--cx-dim)" stroke="var(--card)" strokeWidth="3" paintOrder="stroke" fontSize="10" fontFamily="var(--font-mono)">
                    {formatTick(t, format, currency)}
                  </text>
                </g>
              ))}

              {/* bands (bottom→top); 0.9 fill, and a 2px surface-color line on each */}
              {/* internal boundary makes the gap */}
              {geom.bandPaths.map((bp) => (
                <path key={bp.key} d={bp.d} fill={bp.color} fillOpacity="0.9" />
              ))}
              {geom.bandPaths.slice(0, -1).map((bp) => (
                <polyline
                  key={`gap-${bp.key}`}
                  points={bp.upper.map((v, i) => `${geom.x(i).toFixed(1)},${geom.y(v).toFixed(1)}`).join(' ')}
                  fill="none"
                  stroke="var(--card)"
                  strokeWidth="2"
                />
              ))}

              {hoverIdx !== null && (
                <line x1={geom.x(hoverIdx)} x2={geom.x(hoverIdx)} y1={PAD.t} y2={height - PAD.b} stroke="var(--cx-dim)" strokeWidth="1" />
              )}

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

            {hoverRow && hoverIdx !== null && (
              <div
                className="cx-tooltip top-1 min-w-[10rem] px-3 py-2"
                style={{ left: geom.x(hoverIdx), transform: tooltipOnRight ? 'translateX(10px)' : 'translateX(calc(-100% - 10px))' }}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{fmtShortDate(hoverRow.x)}</p>
                {[...visible].reverse().map((b) => (
                  <div key={b.key} className="mt-1.5 flex items-center gap-2">
                    <span className="inline-block h-2 w-2 shrink-0 rounded-[2px]" style={{ background: b.color }} aria-hidden />
                    <span className="text-[11px] text-muted-foreground">{b.label}</span>
                    <span className="ml-auto text-sm font-medium tabular-nums">{formatValue(Number(hoverRow[b.key] ?? 0), format, currency)}</span>
                  </div>
                ))}
                <div className="mt-2 flex items-center justify-between border-t border-border pt-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Total</span>
                  <span className="text-sm font-semibold tabular-nums">{formatValue(geom.totals[hoverIdx], format, currency)}</span>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>

      <table className="sr-only">
        <caption>Revenue by product over time</caption>
        <thead>
          <tr>
            <th>Date</th>
            {bands.map((b) => (
              <th key={b.key}>{b.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.x}>
              <td>{r.x}</td>
              {bands.map((b) => (
                <td key={b.key}>{formatValue(Number(r[b.key] ?? 0), format, currency)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
