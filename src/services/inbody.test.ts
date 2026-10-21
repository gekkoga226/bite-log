import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchInbody, appendInbody, recordToRow, rowToRecord, planInbodyImport, writeInbodyRows, writeInbodyFull } from './inbody'
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

const rec = (date: string, weight: number, bodyFatPercent: number, muscleMass: number, bmi = 22.1): InBodyRecord => ({
  timestamp: `${date}T12:00:00.000Z`, date, weight, bodyFatPercent, muscleMass, bmi, basalMetabolism: 1400, bodyFatMass: 10,
})

describe('planInbodyImport', () => {
  it('replaces rows registered a few days late with the CSV measurement', () => {
    const existing = [rec('2026-06-16', 63.1, 18.2, 49.0), rec('2026-10-02', 62.7, 19.6, 48.2, 22.0)]
    const incoming = [rec('2026-06-08', 63.1, 18.2, 29.4), rec('2026-09-30', 62.7, 19.6, 28.7, 22.0), rec('2026-10-19', 64.0, 17.5, 29.9, 22.3)]
    const plan = planInbodyImport(existing, incoming)
    expect(plan.replaced.map((r) => [r.before.date, r.after.date])).toEqual([['2026-06-16', '2026-06-08'], ['2026-10-02', '2026-09-30']])
    expect(plan.added.map((r) => r.date)).toEqual(['2026-10-19'])
    expect(plan.kept).toEqual([])
    expect(plan.rows.map((r) => [r.date, r.muscleMass])).toEqual([['2026-06-08', 29.4], ['2026-09-30', 28.7], ['2026-10-19', 29.9]])
  })

  it('keeps manual rows that have no CSV counterpart', () => {
    const manual = rec('2026-11-01', 64.4, 17.1, 30.1)
    const plan = planInbodyImport([manual], [rec('2026-10-19', 64.0, 17.5, 29.9, 22.3)])
    expect(plan.kept).toEqual([manual])
    expect(plan.rows.map((r) => r.date)).toEqual(['2026-10-19', '2026-11-01'])
  })

  it('does not match rows more than 14 days apart', () => {
    const plan = planInbodyImport([rec('2026-07-01', 63.1, 18.2, 49.0)], [rec('2026-06-08', 63.1, 18.2, 29.4)])
    expect(plan.replaced).toEqual([])
    expect(plan.rows).toHaveLength(2)
  })
})

describe('writeInbodyRows', () => {
  it('overwrites from the header without clearing first', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sheets: [{ properties: { title: 'inbody' } }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    const rows = [rec('2026-06-08', 63.1, 18.2, 29.4), rec('2026-10-19', 64.0, 17.5, 29.9)]
    await writeInbodyRows('tok', rows, 1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [url, opts] = fetchMock.mock.calls[1]
    expect(decodeURIComponent(url)).toContain("'inbody'!A1:H3")
    expect(opts.method).toBe('PUT')
    expect(JSON.parse(opts.body).values).toHaveLength(3)
  })
})

describe('writeInbodyFull', () => {
  it('creates the sheet and merges rows by 日付', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sheets: [] }) })               // lookup
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })                          // addSheet
      .mockResolvedValueOnce({ ok: true, json: async () => ({ values: [['日付', '体重(kg)'], ['20261016221055', '63.8']] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })                          // write
    vi.stubGlobal('fetch', fetchMock)
    const n = await writeInbodyFull('tok', ['日付', '体重(kg)'], [{ '日付': '20261019212827', '体重(kg)': '64.0' }])
    expect(n).toBe(2)
    const [url, opts] = fetchMock.mock.calls[3]
    expect(url).toContain('valueInputOption=RAW')
    expect(JSON.parse(opts.body).values).toEqual([['日付', '体重(kg)'], ['20261016221055', '63.8'], ['20261019212827', '64.0']])
  })
})
