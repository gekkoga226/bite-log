import { describe, it, expect, vi, beforeEach } from 'vitest'
import { suggestGoals } from './suggestGoals'

beforeEach(() => { vi.restoreAllMocks() })

const BASE_INPUT = {
  current: { calories: 1800, protein: 93, fat: 42, carbs: 195 },
  inbody: { weight: 70, bodyFatPercent: 22, muscleMass: 32, basalMetabolism: 1600, bodyFatMass: 15.4 },
  mealAvg: { calories: 1750, protein: 88, fat: 50, carbs: 200 },
  targets: { bodyFatPercent: 15, deadlineMonths: 3 },
}

describe('suggestGoals', () => {
  it('posts to /api/suggest-goals and returns rounded goals + reasoning', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        calories: 1583.7,
        protein: 115.2,
        fat: 56.0,
        carbs: 152.8,
        reasoning: '基礎代謝1600kcal×1.35=2160kcal。体脂肪を7.4kg減らすために1日686kcalの赤字が必要ですが安全上限750kcalに抑えました。',
      }),
    })) as any)

    const result = await suggestGoals(BASE_INPUT)
    expect(result.goals).toEqual({ calories: 1584, protein: 115, fat: 56, carbs: 153 })
    expect(result.reasoning).toContain('基礎代謝')
    expect(fetch).toHaveBeenCalledWith('/api/suggest-goals', expect.objectContaining({ method: 'POST' }))
  })

  it('passes null inbody and mealAvg without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        calories: 1800, protein: 93, fat: 42, carbs: 195,
        reasoning: 'InBodyデータなし。標準的な推定値を使用しました。',
      }),
    })) as any)

    const result = await suggestGoals({ ...BASE_INPUT, inbody: null, mealAvg: null })
    expect(result.goals.calories).toBe(1800)
    const [, opts] = (fetch as any).mock.calls[0]
    expect(JSON.parse(opts.body)).toMatchObject({ inbody: null, mealAvg: null })
  })

  it('passes partial targets with null fields', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ calories: 1800, protein: 93, fat: 42, carbs: 195, reasoning: 'ok' }),
    })) as any)

    await suggestGoals({
      ...BASE_INPUT,
      targets: { bodyFatPercent: null, weight: null, muscleMass: 35, deadlineMonths: 6 },
    })
    const [, opts] = (fetch as any).mock.calls[0]
    expect(JSON.parse(opts.body).targets).toMatchObject({ bodyFatPercent: null, muscleMass: 35, deadlineMonths: 6 })
  })

  it('throws when API returns error status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 502, json: async () => ({ error: 'model overloaded' }),
    })) as any)

    await expect(suggestGoals(BASE_INPUT)).rejects.toThrow('suggest-goals failed: 502 - model overloaded')
  })
})
