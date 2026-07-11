'use client'

// Generic grid heatmap (rows × cols) on the sequential lavender ramp —
// single hue, five discrete steps, 2px surface gaps. Shared tooltip follows
// the pointer cell; an sr-only table keeps every value reachable without it.

import { useRef, useState } from 'react'

const STEPS = [
  'var(--cx-seq-1)',
  'var(--cx-seq-2)',
  'var(--cx-seq-3)',
  'var(--cx-seq-4)',
  'var(--cx-seq-5)',
]

export function Heatmap({
  values,
  rowLabels,
  colLabels,
  unit = '',
  cellHeight = 16,
}: {
  values: number[][] // [row][col]
  rowLabels: string[]
  colLabels: (string | null)[] // null = unlabeled column
  unit?: string
  cellHeight?: number
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null)
  const rows = values.length
  const cols = values[0]?.length ?? 0
  const max = Math.max(...values.flat(), 1)

  const cellFromPointer = (clientX: number, clientY: number) => {
    const el = wrapRef.current
    if (!el || rows === 0 || cols === 0) return null
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null // collapsed → NaN indices
    // clamp so the outermost cells stay hoverable at the exact edges
    const c = Math.min(cols - 1, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * cols)))
    const r = Math.min(rows - 1, Math.max(0, Math.floor(((clientY - rect.top) / rect.height) * rows)))
    return { r, c }
  }

  const step = (v: number) => {
    if (v <= 0) return 'var(--muted)'
    return STEPS[Math.min(4, Math.floor((v / max) * 5))]
  }

  return (
    <div>
      <div className="flex gap-2">
        <div
          className="grid shrink-0 gap-[2px] font-mono text-[10px] text-muted-foreground"
          style={{ gridTemplateRows: `repeat(${rows}, ${cellHeight}px)` }}
          aria-hidden
        >
          {rowLabels.map((l) => (
            <span key={l} className="flex items-center">
              {l}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <div
            ref={wrapRef}
            role="img"
            aria-label={`${unit} 히트맵`}
            className="grid gap-[2px]"
            style={{
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gridTemplateRows: `repeat(${rows}, ${cellHeight}px)`,
            }}
            onPointerMove={(e) => setHover(cellFromPointer(e.clientX, e.clientY))}
            onPointerLeave={() => setHover(null)}
          >
            {values.map((row, r) =>
              row.map((v, c) => (
                <div
                  key={`${r}-${c}`}
                  className="rounded-[2px] transition-opacity duration-100"
                  style={{
                    background: step(v),
                    opacity: hover === null || (hover.r === r && hover.c === c) ? 1 : 0.45,
                  }}
                />
              )),
            )}
          </div>

          {hover && (
            <div
              className="cx-tooltip px-2.5 py-1.5 whitespace-nowrap"
              style={{
                left: `${((hover.c + 0.5) / cols) * 100}%`,
                top: `${(hover.r / rows) * 100}%`,
                transform: `translateX(${hover.c > cols * 0.66 ? '-100%' : hover.c < cols * 0.2 ? '0%' : '-50%'}) translateY(-100%) translateY(-6px)`,
              }}
            >
              <span className="text-sm font-semibold tabular-nums">{values[hover.r][hover.c]}</span>{' '}
              <span className="text-[11px] text-muted-foreground">
                {unit} · {rowLabels[hover.r]} {colLabels[hover.c] ?? `${hover.c}시`}
              </span>
            </div>
          )}

          <div
            className="mt-1.5 grid gap-[2px] font-mono text-[10px] text-muted-foreground"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
            aria-hidden
          >
            {colLabels.map((l, i) => (
              <span key={i}>{l ?? ''}</span>
            ))}
          </div>
        </div>
      </div>

      <table className="sr-only">
        <caption>{unit} 히트맵</caption>
        <tbody>
          {values.map((row, r) => (
            <tr key={r}>
              <th>{rowLabels[r]}</th>
              {row.map((v, c) => (
                <td key={c}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
