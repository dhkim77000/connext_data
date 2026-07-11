// 한국어 인사이트 카드 — kind 칩(텍스트+색, 색상 단독 금지) + 평이한 문장 + 근거.
// 상관계수·내부 지표 원값은 노출하지 않는다(마스터 플랜 3.6.4).

import { Panel } from '@/components/dashboard/ui'
import type { DemoInsight } from '@/lib/demo/data'

const KIND_STYLE: Record<DemoInsight['kind'], string> = {
  기회: 'text-pos border-pos/30',
  주의: 'text-warn border-warn/40',
  알림: 'text-muted-foreground border-border',
}

export function InsightCard({ insight, className = '' }: { insight: DemoInsight; className?: string }) {
  return (
    <Panel className={`flex flex-col gap-2.5 ${className}`}>
      <span
        className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-[0.12em] ${KIND_STYLE[insight.kind]}`}
      >
        {insight.kind}
      </span>
      <p className="text-[15px] font-medium leading-snug">{insight.title}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">{insight.body}</p>
      <p className="mt-auto border-t border-border pt-2.5 font-mono text-[11px] tabular-nums text-muted-foreground">
        {insight.evidence}
      </p>
    </Panel>
  )
}
