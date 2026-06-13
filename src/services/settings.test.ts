import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchGoals, saveGoals } from './settings'

beforeEach(() => { vi.restoreAllMocks() })

describe('fetchGoals', () => {
  it('returns DEFAULT_GOALS when sheet has no data row', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ values: undefined }),
    })))
    const result = await fetchGoals('tok')
    expect(result).toEqual({ calories: 1800, protein: 93, fat: 42, carbs: 195 })
  })

  it('returns parsed goals when sheet has data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ values: [['2000', '100', '50', '200']] }),
    })))
    const result = await fetchGoals('tok')
    expect(result).toEqual({ calories: 2000, protein: 100, fat: 50, carbs: 200 })
  })

  it('returns DEFAULT_GOALS on network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403 })))
    const result = await fetchGoals('tok')
    expect(result).toEqual({ calories: 1800, protein: 93, fat: 42, carbs: 195 })
  })
})

describe('saveGoals', () => {
  it('PUTs to the settings range when sheet already exists', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sheets: [{ properties: { title: 'settings' } }] }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    await saveGoals('tok', { calories: 2000, protein: 100, fat: 50, carbs: 200 })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [url, opts] = fetchMock.mock.calls[1]
    expect(url).toContain('settings')
    expect(opts.method).toBe('PUT')
    expect(JSON.parse(opts.body)).toMatchObject({ values: [[2000, 100, 50, 200]] })
  })

  it('creates the sheet then saves when sheet does not exist', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sheets: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    await saveGoals('tok', { calories: 1800, protein: 93, fat: 42, carbs: 195 })
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('throws when the PUT request fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sheets: [{ properties: { title: 'settings' } }] }),
      })
      .mockResolvedValueOnce({ ok: false, status: 403 })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      saveGoals('tok', { calories: 1800, protein: 93, fat: 42, carbs: 195 }),
    ).rejects.toThrow('saveGoals failed: 403')
  })
})
