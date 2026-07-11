// Composition bar — one horizontal stack with 2px surface gaps, legend rows
// carrying the exact values (nothing gated behind hover). Server-renderable.

export function StackBar({
  parts,
  format,
}: {
  parts: { label: string; value: number; color: string }[]
  format: (v: number) => string
}) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1

  return (
    <div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
        {parts.map((p) => (
          <span
            key={p.label}
            style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
            aria-hidden
          />
        ))}
      </div>
      <ul className="mt-4 space-y-2">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2.5">
            <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: p.color }} aria-hidden />
            <span className="text-xs">{p.label}</span>
            <span className="ml-auto text-xs tabular-nums">{format(p.value)}</span>
            <span className="w-10 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
              {Math.round((p.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
