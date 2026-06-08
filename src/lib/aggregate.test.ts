import { describe, it, expect } from 'vitest'
import { aggregateDay } from './aggregate'
import type { MealRecord } from '../types'

function rec(p: Partial<MealRecord>): MealRecord {
  return {
    timestamp: '', date: '2026-06-04', mealType: '朝食', photoUrl: '',
    memo: '', note: '', calories: 0, protein: 0, fat: 0, carbs: 0, comment: '',
    ...p,
  }
}

describe('aggregateDay', () => {
  it('sums only records of the target date', () => {
    const records = [
      rec({ date: '2026-06-04', mealType: '朝食', calories: 350, protein: 20, fat: 10, carbs: 40 }),
      rec({ date: '2026-06-04', mealType: '昼食', calories: 620, protein: 35, fat: 18, carbs: 70 }),
      rec({ date: '2026-06-03', mealType: '夕食', calories: 800, protein: 40, fat: 30, carbs: 80 }),
    ]
    const t = aggregateDay(records, '2026-06-04')
    expect(t.calories).toBe(970)
    expect(t.protein).toBe(55)
    expect(t.byType['朝食']).toBe(350)
    expect(t.byType['昼食']).toBe(620)
    expect(t.byType['夕食']).toBe(0)
  })
  it('returns zeros for a day with no records', () => {
    const t = aggregateDay([], '2026-06-04')
    expect(t.calories).toBe(0)
    expect(t.byType['間食']).toBe(0)
  })
})
