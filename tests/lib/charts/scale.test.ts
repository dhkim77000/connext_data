import { describe, it, expect } from 'vitest'
import { linearScale, niceTicks, linePath, areaPath } from '@/components/charts/scale'

describe('linearScale', () => {
  it('maps domain to range linearly', () => {
    const s = linearScale([0, 100], [0, 720])
    expect(s(0)).toBe(0)
    expect(s(50)).toBe(360)
    expect(s(100)).toBe(720)
  })

  it('supports inverted ranges (SVG y-axis)', () => {
    const s = linearScale([0, 10], [200, 0])
    expect(s(0)).toBe(200)
    expect(s(10)).toBe(0)
    expect(s(5)).toBe(100)
  })

  it('never divides by zero on a flat domain', () => {
    const s = linearScale([5, 5], [0, 100])
    expect(Number.isNaN(s(5))).toBe(false)
  })
})

describe('niceTicks', () => {
  it('picks 1/2/5×10ⁿ steps and covers the domain', () => {
    expect(niceTicks(0, 100, 4)).toEqual([0, 20, 40, 60, 80, 100])
  })

  it('extends the top tick to cover max', () => {
    const ticks = niceTicks(0, 8_432_100, 4)
    expect(ticks[0]).toBe(0)
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(8_432_100)
    // step is a clean 2×10⁶
    expect(ticks[1] - ticks[0]).toBe(2_000_000)
  })

  it('handles negative-to-positive domains', () => {
    expect(niceTicks(-50, 100, 4)).toEqual([-50, 0, 50, 100])
  })

  it('handles a zero-span domain without collapsing', () => {
    const zero = niceTicks(0, 0)
    expect(zero.length).toBeGreaterThanOrEqual(2)
    expect(zero[0]).toBe(0)
    const flat = niceTicks(5, 5)
    expect(flat.length).toBeGreaterThanOrEqual(2)
    expect(flat[0]).toBeLessThanOrEqual(5)
    expect(flat[flat.length - 1]).toBeGreaterThanOrEqual(5)
  })

  it('returns ascending ticks free of floating-point dust', () => {
    const ticks = niceTicks(0, 0.7, 4)
    for (let i = 1; i < ticks.length; i++) expect(ticks[i]).toBeGreaterThan(ticks[i - 1])
    // 0.30000000000000004-style artifacts must not appear
    for (const t of ticks) expect(String(t).length).toBeLessThanOrEqual(6)
  })
})

describe('paths', () => {
  const pts: [number, number][] = [
    [0, 100],
    [50, 20],
    [100, 60],
  ]

  it('linePath emits M then L commands', () => {
    expect(linePath(pts)).toBe('M0,100 L50,20 L100,60')
  })

  it('areaPath closes down to the baseline', () => {
    expect(areaPath(pts, 120)).toBe('M0,100 L50,20 L100,60 L100,120 L0,120 Z')
  })

  it('handles empty input', () => {
    expect(linePath([])).toBe('')
    expect(areaPath([], 100)).toBe('')
  })
})
