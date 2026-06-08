import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateNutrition } from './calculate'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('calculateNutrition', () => {
  it('posts to /api/calculate and parses the raw response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ raw: '{"calories":500,"protein":25,"fat":15,"carbs":60,"comment":"ok"}' }),
    })) as any)

    const result = await calculateNutrition({ memo: '牛丼', note: '' })
    expect(result.calories).toBe(500)
    expect(fetch).toHaveBeenCalledWith('/api/calculate', expect.objectContaining({ method: 'POST' }))
  })

  it('throws when the API returns an error status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) })) as any)
    await expect(calculateNutrition({ memo: 'x', note: '' })).rejects.toThrow()
  })
})
