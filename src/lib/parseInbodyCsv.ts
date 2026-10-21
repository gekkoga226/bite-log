import type { InBodyRecord } from '../types'

/** InBody アプリの「データのエクスポート」CSV の1行 */
export interface InBodyCsvRow {
  measuredAt: string            // ISO8601（UTC）。CSV の「日付」は日本時間の YYYYMMDDhhmmss
  date: string                  // YYYY-MM-DD（測定日・日本時間）
  values: Record<string, string> // 列名 → 値（未測定は "-"）
}

export interface InBodyCsv {
  header: string[]
  rows: InBodyCsvRow[]          // 測定日時の昇順
}

/** "体重(kg)" → "体重" のように単位を外した列名 */
function baseName(h: string): string {
  return h.replace(/\(.*\)$/, '').trim()
}

function parseStamp(s: string): { measuredAt: string; date: string } | null {
  const m = s.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/)
  if (!m) return null
  const [y, mo, d, h, mi, se] = m.slice(1).map(Number)
  const utc = new Date(Date.UTC(y, mo - 1, d, h - 9, mi, se)) // 日本時間 → UTC
  return { measuredAt: utc.toISOString(), date: `${m[1]}-${m[2]}-${m[3]}` }
}

export function parseInbodyCsv(text: string): InBodyCsv {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length === 0) throw new Error('CSV が空です')
  const header = lines[0].split(',').map((h) => h.trim())
  const dateIdx = header.findIndex((h) => baseName(h) === '日付')
  if (dateIdx < 0 || !header.some((h) => baseName(h) === '体重')) {
    throw new Error('InBody のエクスポート CSV ではありません（「日付」「体重」の列がありません）')
  }
  const rows: InBodyCsvRow[] = []
  for (const line of lines.slice(1)) {
    const cells = line.split(',').map((c) => c.trim())
    const stamp = parseStamp(cells[dateIdx] ?? '')
    if (!stamp) continue
    const values: Record<string, string> = {}
    header.forEach((h, i) => { values[h] = cells[i] ?? '' })
    rows.push({ ...stamp, values })
  }
  rows.sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
  return { header, rows }
}

/** 列名（単位なし）で数値を取る。"-" や空欄は 0 */
export function csvNumber(row: InBodyCsvRow, name: string): number {
  const key = Object.keys(row.values).find((h) => baseName(h) === name)
  const v = key ? Number(row.values[key]) : NaN
  return Number.isFinite(v) ? v : 0
}

/** アプリの inbody シート用レコードに変換する。muscleMass は骨格筋量 */
export function csvRowToRecord(row: InBodyCsvRow): InBodyRecord {
  return {
    timestamp: row.measuredAt,
    date: row.date,
    weight: csvNumber(row, '体重'),
    bodyFatPercent: csvNumber(row, '体脂肪率'),
    muscleMass: csvNumber(row, '骨格筋量'),
    bmi: csvNumber(row, 'BMI'),
    basalMetabolism: csvNumber(row, '基礎代謝量'),
    bodyFatMass: csvNumber(row, '体脂肪量'),
  }
}
