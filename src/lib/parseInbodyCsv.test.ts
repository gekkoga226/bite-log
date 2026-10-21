import { describe, it, expect } from 'vitest'
import { parseInbodyCsv, csvRowToRecord, csvNumber } from './parseInbodyCsv'

const HEADER = '日付,測定機器,体重(kg),骨格筋量(kg),筋肉量(kg),体脂肪量(kg),BMI(kg/m²),体脂肪率(%),基礎代謝量(kcal),InBody点数,右腕体脂肪量(kg),腹囲(cm)'
const CSV = [
  HEADER,
  '20261019212827,470,64.2,29.8,49.6,11.1,22.2,17.3,1490,78,0.5,79.5',
  '20260930173653,470,63.5,28.9,48.1,12.4,22.0,19.5,1452,75,0.6,-',
  '',
].join('\r\n')

describe('parseInbodyCsv', () => {
  it('parses rows in ascending measurement order with JST dates', () => {
    const { header, rows } = parseInbodyCsv('﻿' + CSV)
    expect(header[0]).toBe('日付')
    expect(rows.map((r) => r.date)).toEqual(['2026-09-30', '2026-10-19'])
    // 21:28:27 JST = 12:28:27 UTC
    expect(rows[1].measuredAt).toBe('2026-10-19T12:28:27.000Z')
  })

  it('keeps the JST calendar date for early-morning measurements', () => {
    const { rows } = parseInbodyCsv([HEADER, '20260503075747,470,63.9,29.3,48.8,11.8,22.1,18.5,1470,76,0.6,80.2'].join('\n'))
    expect(rows[0].date).toBe('2026-05-03')
    expect(rows[0].measuredAt).toBe('2026-05-02T22:57:47.000Z')
  })

  it('rejects files that are not InBody exports', () => {
    expect(() => parseInbodyCsv('a,b\n1,2')).toThrow('InBody')
  })
})

describe('csvNumber', () => {
  it('reads by column name without the unit and treats "-" as 0', () => {
    const { rows } = parseInbodyCsv(CSV)
    expect(csvNumber(rows[1], '体脂肪量')).toBe(11.1) // not 右腕体脂肪量
    expect(csvNumber(rows[0], '腹囲')).toBe(0)
  })
})

describe('csvRowToRecord', () => {
  it('maps to the app record with skeletal muscle mass as muscleMass', () => {
    const { rows } = parseInbodyCsv(CSV)
    expect(csvRowToRecord(rows[1])).toEqual({
      timestamp: '2026-10-19T12:28:27.000Z',
      date: '2026-10-19',
      weight: 64.2,
      bodyFatPercent: 17.3,
      muscleMass: 29.8,
      bmi: 22.2,
      basalMetabolism: 1490,
      bodyFatMass: 11.1,
    })
  })
})
