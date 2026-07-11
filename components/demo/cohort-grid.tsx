// Cohort retention matrix — % text on the sequential ramp (light ink on dark
// cells). Every value is visible in the cell, so nothing is gated on hover.

const STEP_BG = ['var(--cx-seq-1)', 'var(--cx-seq-2)', 'var(--cx-seq-3)', 'var(--cx-seq-4)', 'var(--cx-seq-5)']

function cellStyle(pct: number): React.CSSProperties {
  // month 0 (100%) takes the top step; later months scale so ~34% sits mid-ramp
  const idx = pct >= 100 ? 4 : Math.min(4, Math.floor(pct / 10))
  return {
    background: STEP_BG[idx],
    color: idx >= 3 ? 'var(--primary-foreground)' : 'var(--foreground)',
  }
}

export function CohortGrid({ cohorts }: { cohorts: { label: string; values: number[] }[] }) {
  const months = Math.max(...cohorts.map((c) => c.values.length))
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className="pb-2 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            First order
          </th>
          {Array.from({ length: months }, (_, m) => (
            <th key={m} className="pb-2 text-center font-mono text-[10px] tracking-[0.1em] text-muted-foreground">
              {m === 0 ? 'Mo 0' : `+${m}mo`}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {cohorts.map((c) => (
          <tr key={c.label}>
            <td className="py-[3px] pr-2 font-mono text-xs text-muted-foreground">{c.label}</td>
            {Array.from({ length: months }, (_, m) => {
              const v = c.values[m]
              return (
                <td key={m} className="p-[2px]">
                  {v !== undefined && (
                    <div
                      className="rounded-[3px] py-1.5 text-center font-mono text-[11px] tabular-nums"
                      style={cellStyle(v)}
                      title={`${c.label} cohort · still buying ${m === 0 ? 'in month 0' : `${m} month${m === 1 ? '' : 's'} later`}: ${v}%`}
                    >
                      {v}%
                    </div>
                  )}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
