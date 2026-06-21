import { describe, it, expect } from 'vitest'
import { toDateString, isSameDay, addDays } from './date'

describe('toDateString', () => {
  it('formats a Date as YYYY-MM-DD in local time', () => {
    const d = new Date(2026, 5, 4, 13, 25)
    expect(toDateString(d)).toBe('2026-06-04')
  })
  it('pads single-digit month and day', () => {
    const d = new Date(2026, 0, 9, 0, 0)
    expect(toDateString(d)).toBe('2026-01-09')
  })
})

describe('isSameDay', () => {
  it('returns true for same local day', () => {
    expect(isSameDay('2026-06-04', new Date(2026, 5, 4, 23, 59))).toBe(true)
  })
  it('returns false for different day', () => {
    expect(isSameDay('2026-06-04', new Date(2026, 5, 5, 0, 1))).toBe(false)
  })
})

describe('addDays', () => {
  it('adds positive days', () => {
    expect(addDays('2026-06-14', 1)).toBe('2026-06-15')
  })
  it('subtracts with negative days', () => {
    expect(addDays('2026-06-01', -1)).toBe('2026-05-31')
  })
  it('crosses year boundary', () => {
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01')
  })
})
