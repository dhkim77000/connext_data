// 코호트 리텐션 매트릭스 — 시퀀셜 램프 위 % 텍스트(짙은 셀은 밝은 잉크).
// 모든 값이 셀에 그대로 보이므로 호버에 가두는 정보가 없다.

const STEP_BG = ['var(--cx-seq-1)', 'var(--cx-seq-2)', 'var(--cx-seq-3)', 'var(--cx-seq-4)', 'var(--cx-seq-5)']

function cellStyle(pct: number): React.CSSProperties {
  // 100%(첫 달)는 최상단 스텝, 이후는 34% 안팎이 중간에 오도록 스케일
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
            첫 구매 월
          </th>
          {Array.from({ length: months }, (_, m) => (
            <th key={m} className="pb-2 text-center font-mono text-[10px] tracking-[0.1em] text-muted-foreground">
              {m === 0 ? '첫 달' : `+${m}개월`}
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
                      title={`${c.label} 코호트 · ${m === 0 ? '첫 달' : `${m}개월 후`} 재구매 유지 ${v}%`}
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
