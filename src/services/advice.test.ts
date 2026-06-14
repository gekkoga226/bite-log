import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchAdvice, summarizeDays } from './advice'
import type { MealRecord } from '../types'

beforeEach(() => { vi.restoreAllMocks() })

function meal(date: string, calories: number, protein = 0, fat = 0, carbs = 0): MealRecord {
  return { timestamp: `${date}T00:00:00Z`, date, mealType: '昼食', photoUrl: '', memo: '', note: '', calories, protein, fat, carbs, comment: '' }
}

describe('summarizeDays', () => {
  it('aggregates meals per day and keeps the most recent n days ascending', () => {
    const meals = [
      meal('2026-06-10', 500, 20),
      meal('2026-06-10', 300, 10),
      meal('2026-06-12', 700, 30),
      meal('2026-06-08', 400),
    ]
    const days = summarizeDays(meals, 2)
    expect(days.map((d) => d.date)).toEqual(['2026-06-10', '2026-06-12'])
    expect(days[0]).toMatchObject({ calories: 800, protein: 30 })
  })

  it('returns [] when there are no meals', () => {
    expect(summarizeDays([], 7)).toEqual([])
  })
})

describe('fetchAdvice', () => {
  it('posts to /api/advice and returns the advice text', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ advice: '総評: 良い感じです。' }),
    })) as any)

    const text = await fetchAdvice({
      goals: { calories: 1800, protein: 93, fat: 42, carbs: 195 },
      days: [{ date: '2026-06-12', calories: 1700, protein: 90, fat: 40, carbs: 190 }],
      latest: null,
      previous: null,
    })
    expect(text).toBe('総評: 良い感じです。')
    expect(fetch).toHaveBeenCalledWith('/api/advice', expect.objectContaining({ method: 'POST' }))
  })

  it('throws when the API returns an error status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) })) as any)
    await expect(
      fetchAdvice({ goals: { calories: 1800, protein: 93, fat: 42, carbs: 195 }, days: [], latest: null, previous: null }),
    ).rejects.toThrow()
  })
})
