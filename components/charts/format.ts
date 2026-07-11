// Serializable value-format specs for chart components. Server pages pass a
// spec string (functions can't cross the server→client boundary); the client
// chart resolves it here.
import { fmtCurrency, fmtInt, fmtCompact, fmtCompactCurrency } from '@/lib/format'

export type ValueFormat = 'currency' | 'int' | 'compact' | 'percent' | 'multiple'

export function formatValue(v: number, format: ValueFormat = 'int', currency = 'USD'): string {
  switch (format) {
    case 'currency':
      return fmtCurrency(v, currency)
    case 'compact':
      return fmtCompact(v)
    case 'percent':
      return `${v.toFixed(2)}%`
    case 'multiple':
      return `${v.toFixed(2)}×`
    default:
      return fmtInt(v)
  }
}

// Axis ticks stay short — compact notation; exact values live in the tooltip.
export function formatTick(v: number, format: ValueFormat = 'int', currency = 'USD'): string {
  switch (format) {
    case 'currency':
      return fmtCompactCurrency(v, currency)
    case 'percent':
      return `${Number(v.toFixed(1))}%`
    case 'multiple':
      return `${Number(v.toFixed(1))}×`
    default:
      return fmtCompact(v)
  }
}
