import { describe, it, expect } from 'vitest'
import { recordToRow, rowToRecord } from './sheets'
import type { MealRecord } from '../types'

const sample: MealRecord = {
  timestamp: '2026-06-04T13:25:00.000Z',
  date: '2026-06-04',
  mealType: '昼食',
  photoUrl: 'https://drive/x',
  memo: 'チキンサラダ',
  note: 'セブン',
  calories: 620, protein: 35, fat: 18, carbs: 70, comment: 'バランス良好',
}

describe('recordToRow / rowToRecord', () => {
  it('converts a record to a row array in column order', () => {
    expect(recordToRow(sample)).toEqual([
      '2026-06-04T13:25:00.000Z', '2026-06-04', '昼食', 'https://drive/x',
      'チキンサラダ', 'セブン', 620, 35, 18, 70, 'バランス良好',
    ])
  })
  it('round-trips row -> record', () => {
    const row = recordToRow(sample)
    expect(rowToRecord(row.map(String))).toEqual(sample)
  })
})
