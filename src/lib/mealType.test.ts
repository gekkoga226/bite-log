import { describe, it, expect } from 'vitest'
import { detectMealType } from './mealType'

describe('detectMealType', () => {
  it('returns 朝食 for 5:00-10:59', () => {
    expect(detectMealType(new Date(2026, 5, 4, 7, 0))).toBe('朝食')
  })
  it('returns 昼食 for 11:00-14:59', () => {
    expect(detectMealType(new Date(2026, 5, 4, 12, 30))).toBe('昼食')
  })
  it('returns 夕食 for 17:00-21:59', () => {
    expect(detectMealType(new Date(2026, 5, 4, 19, 0))).toBe('夕食')
  })
  it('returns 間食 for other hours', () => {
    expect(detectMealType(new Date(2026, 5, 4, 15, 0))).toBe('間食')
    expect(detectMealType(new Date(2026, 5, 4, 23, 0))).toBe('間食')
  })
  it('returns 間食 at the 22:00 boundary (just after 夕食)', () => {
    expect(detectMealType(new Date(2026, 5, 4, 22, 0))).toBe('間食')
  })
})
