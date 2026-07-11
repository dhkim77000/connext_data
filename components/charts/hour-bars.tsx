'use client'

// 24-hour distribution bars with a shared tooltip and a single direct label on
// the peak (label selectively — the tooltip and sr-table carry the rest).

import { useRef, useState } from 'react'

export function HourBars({
  hours,
  unit = 'orders',
  height = 96,
}: {
  hours: number[] // exactly 24 buckets, index = hour of day
  unit?: string
  height?: number
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...hours, 1)
  const peak = hours.indexOf(Math.max(...hours))
  const total = hours.reduce((a, b) => a + b, 0)

  const idxFromPointer = (clientX: number) => {
    const el = wrapRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    return Math.max(0, Math.min(23, Math.floor(((clientX - r.left) / r.width) * 24)))
  }

  const hh = (h: number) => `${String(h).padStart(2, '0')}:00`

  return (
    <div>
      <div className="relative">
        <div
          ref={wrapRef}
          role="img"
          aria-label={`${unit} by hour of day, peak at ${hh(peak)}`}
          className="flex items-end gap-[2px]"
          style={{ height }}
          onPointerMove={(e) => setHover(idxFromPointer(e.clientX))}
          onPointerLeave={() => setHover(null)}
        >
          {hours.map((v, h) => (
            <div key={h} className="relative flex h-full max-w-[24px] flex-1 items-end">
              <div
                className="cx-grow-bar w-full bg-cx-accent"
                style={
                  {
                    height: `${Math.max((v / max) * 100, 2)}%`,
                    borderRadius: '4px 4px 0 0', // rounded data-end, square baseline
                    opacity: hover === null || hover === h ? (v === 0 ? 0.25 : 0.75) : 0.3,
                    transition: 'opacity 120ms ease',
                    ['--cx-i' as string]: h,
                  } as React.CSSProperties
                }
              />
            </div>
          ))}
        </div>

        {/* single direct label on the peak bar */}
        {total > 0 && hover === null && (
          <span
            className="pointer-events-none absolute -top-4 -translate-x-1/2 font-mono text-[10px] tabular-nums text-muted-foreground"
            style={{ left: `${((peak + 0.5) / 24) * 100}%` }}
          >
            {hh(peak)}
          </span>
        )}

        {/* shared tooltip */}
        {hover !== null && (
          <div
            className="cx-tooltip -top-2 px-2.5 py-1.5"
            style={{
              left: `${((hover + 0.5) / 24) * 100}%`,
              // translateY(-100%) lifts the tooltip fully above the bars; -top-2 leaves the gap
              transform: `translateX(${hover > 15 ? '-100%' : hover < 8 ? '0%' : '-50%'}) translateY(-100%)`,
            }}
          >
            <span className="text-sm font-semibold tabular-nums">{hours[hover]}</span>{' '}
            <span className="text-[11px] text-muted-foreground">
              {unit} · {hh(hover)}
            </span>
          </div>
        )}
      </div>

      <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground" aria-hidden>
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>

      <table className="sr-only">
        <caption>{unit} by hour of day</caption>
        <tbody>
          {hours.map((v, h) => (
            <tr key={h}>
              <td>{hh(h)}</td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
