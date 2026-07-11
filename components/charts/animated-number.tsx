'use client'

// Count-up for hero figures. SSR paints the final value (correct without JS);
// on mount it eases 60% → 100% in 400ms. The one-frame final-value flash before
// the effect fires is masked by the panel's cx-rise entrance (starts at opacity 0).
// Large standalone numbers read best in proportional figures, so tabular-nums
// applies only WHILE counting (keeps the digits from jittering) and drops at rest.

import { useEffect, useRef, useState } from 'react'
import { formatValue, type ValueFormat } from './format'

const DURATION = 400

export function AnimatedNumber({
  value,
  format = 'int',
  currency = 'USD',
  className = '',
}: {
  value: number
  format?: ValueFormat
  currency?: string
  className?: string
}) {
  const [display, setDisplay] = useState(value)
  const [counting, setCounting] = useState(false)
  const raf = useRef(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value)
      return
    }
    const from = value * 0.6
    const start = performance.now()
    setCounting(true)
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (value - from) * eased)
      if (t < 1) raf.current = requestAnimationFrame(tick)
      else setCounting(false)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value])

  return (
    <span className={`${counting ? 'tabular-nums' : ''} ${className}`}>
      {formatValue(display, format, currency)}
    </span>
  )
}
