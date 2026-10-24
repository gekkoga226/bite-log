import { describe, it, expect } from 'vitest'
import { mealLabel } from './mealLabel'
import type { MealRecord } from '../types'

const base: MealRecord = {
  timestamp: '2026-10-24T04:00:00Z', date: '2026-10-24', mealType: '昼食', photoUrl: '',
  memo: '', note: '', calories: 0, protein: 0, fat: 0, carbs: 0, comment: '',
}

describe('mealLabel', () => {
  it('prefers memo', () => {
    expect(mealLabel({ ...base, memo: '牛丼', note: '大盛り', comment: '牛丼 : 良い' })).toBe('牛丼')
  })
  it('uses AI food names over note for photo meals', () => {
    expect(mealLabel({ ...base, note: 'ライスは1杯おかわりした', comment: '担々麺,ライス,焼売 : 炭水化物が多め' }))
      .toBe('担々麺,ライス,焼売')
  })
  it('falls back to note when comment has no food part', () => {
    expect(mealLabel({ ...base, note: 'セブン', comment: '' })).toBe('セブン')
  })
  it('returns placeholder when empty', () => {
    expect(mealLabel(base)).toBe('（メモなし）')
  })
})
