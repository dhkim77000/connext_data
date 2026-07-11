// Insight card — kind chip (text + color, never color alone) + a plain-language
// sentence + evidence. Raw correlation values are never shown (master plan 3.6.4).

import { Panel } from '@/components/dashboard/ui'
import type { DemoInsight } from '@/lib/demo/data'

const KIND: Record<DemoInsight['kind'], { label: string; className: string }> = {
  opportunity: { label: 'Opportunity', className: 'text-pos border-pos/30' },
  watch: { label: 'Watch', className: 'text-warn border-warn/40' },
  note: { label: 'Note', className: 'text-muted-foreground border-border' },
}

export function InsightCard({ insight, className = '' }: { insight: DemoInsight; className?: string }) {
  const kind = KIND[insight.kind]
  return (
    <Panel className={`flex flex-col gap-2.5 ${className}`}>
      <span
        className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${kind.className}`}
      >
        {kind.label}
      </span>
      <p className="text-[15px] font-medium leading-snug">{insight.title}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">{insight.body}</p>
      <p className="mt-auto border-t border-border pt-2.5 font-mono text-[11px] tabular-nums text-muted-foreground">
        {insight.evidence}
      </p>
    </Panel>
  )
}
