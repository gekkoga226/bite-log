import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchInbody, appendInbody, recordToRow, rowToRecord } from './inbody'
import type { InBodyRecord } from '../types'

beforeEach(() => { vi.restoreAllMocks() })

const SAMPLE: InBodyRecord = {
  timestamp: '2026-06-14T10:00:00.000Z',
  date: '2026-06-14',
  weight: 62.5,
  bodyFatPercent: 18.2,
  muscleMass: 30.1,
  bmi: 21.4,
  basalMetabolism: 1430,
  bodyFatMass: 11.4,
}

describe('recordToRow / rowToRecord', () => {
  it('round-trips a record', () => {
    const row = recordToRow(SAMPLE).map(String)
    expect(rowToRecord(row)).toEqual(SAMPLE)
  })
})

describe('fetchInbody', () => {
  it('returns records sorted by timestamp ascending', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ values: [
        ['2026-06-14T10:00:00.000Z', '2026-06-14', '62.5', '18.2', '30.1', '21.4', '1430', '11.4'],
        ['2026-05-01T10:00:00.000Z', '2026-05-01', '64.0', '19.0', '29.8', '22.0', '1450', '12.2'],
      ] }),
    })))
    const result = await fetchInbody('tok')
    expect(result.map((r) => r.date)).toEqual(['2026-05-01', '2026-06-14'])
  })

  it('returns [] on network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403 })))
    expect(await fetchInbody('tok')).toEqual([])
  })
})

describe('appendInbody', () => {
  it('appends when the sheet already exists', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sheets: [{ properties: { title: 'inbody' } }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    await appendInbody('tok', SAMPLE)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [url, opts] = fetchMock.mock.calls[1]
    expect(url).toContain('inbody')
    expect(url).toContain(':append')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body)).toMatchObject({ values: [recordToRow(SAMPLE)] })
  })

  it('creates the sheet then appends when it does not exist', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sheets: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    await appendInbody('tok', SAMPLE)
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('throws when the append request fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sheets: [{ properties: { title: 'inbody' } }] }) })
      .mockResolvedValueOnce({ ok: false, status: 500 })
    vi.stubGlobal('fetch', fetchMock)

    await expect(appendInbody('tok', SAMPLE)).rejects.toThrow('appendInbody failed: 500')
  })
})
