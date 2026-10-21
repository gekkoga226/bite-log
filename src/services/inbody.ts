import type { InBodyRecord } from '../types'

const SHEET_NAME = 'inbody'
const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID
const HEADER = ['timestamp', 'date', 'weight', 'bodyFatPercent', 'muscleMass', 'bmi', 'basalMetabolism', 'bodyFatMass']

export function recordToRow(r: InBodyRecord): (string | number)[] {
  return [
    r.timestamp, r.date, r.weight, r.bodyFatPercent,
    r.muscleMass, r.bmi, r.basalMetabolism, r.bodyFatMass,
  ]
}

export function rowToRecord(cells: string[]): InBodyRecord {
  return {
    timestamp: cells[0] ?? '',
    date: cells[1] ?? '',
    weight: Number(cells[2] ?? 0),
    bodyFatPercent: Number(cells[3] ?? 0),
    muscleMass: Number(cells[4] ?? 0),
    bmi: Number(cells[5] ?? 0),
    basalMetabolism: Number(cells[6] ?? 0),
    bodyFatMass: Number(cells[7] ?? 0),
  }
}

async function sheetExists(token: string): Promise<boolean> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return false
  const data = (await res.json()) as { sheets: Array<{ properties: { title: string } }> }
  return data.sheets.some((s) => s.properties.title === SHEET_NAME)
}

async function ensureInbodySheet(token: string): Promise<void> {
  if (await sheetExists(token)) return

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] }),
    },
  )

  const headerRange = encodeURIComponent(`'${SHEET_NAME}'!A1:H1`)
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${headerRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [HEADER] }),
    },
  )
}

export async function fetchInbody(token: string): Promise<InBodyRecord[]> {
  try {
    const range = encodeURIComponent(`'${SHEET_NAME}'!A2:H`)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return []
    const data = (await res.json()) as { values?: string[][] }
    return (data.values ?? [])
      .map(rowToRecord)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  } catch {
    return []
  }
}

export interface InbodyImportPlan {
  rows: InBodyRecord[]      // 取り込み後の inbody シート全体（測定日時の昇順）
  added: InBodyRecord[]     // CSV にだけあった測定
  replaced: { before: InBodyRecord; after: InBodyRecord }[] // 既存行を CSV の値・測定日で置き換えたもの
  kept: InBodyRecord[]      // CSV に対応がなく、そのまま残す既存行
}

// 登録が測定の1週間以上あとになった例（8日後に登録）があるため14日
const MATCH_DAYS = 14

function dayDiff(a: string, b: string): number {
  return Math.abs(new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) / 86400000
}

/**
 * 既存の inbody シートと CSV を突き合わせる。
 * アプリは登録日を測定日として保存していることがあり、写真の OCR は筋肉量を骨格筋量欄に入れていたため、
 * 「日付が14日以内で体重・体脂肪率・BMI が同じ」行のうち日付が最も近いものを同じ測定とみなし、
 * CSV の値と測定日で置き換える。
 */
export function planInbodyImport(existing: InBodyRecord[], incoming: InBodyRecord[]): InbodyImportPlan {
  const used = new Set<number>()
  const replaced: InbodyImportPlan['replaced'] = []
  const added: InBodyRecord[] = []
  for (const inc of incoming) {
    let idx = -1
    existing.forEach((ex, i) => {
      if (used.has(i) || ex.weight !== inc.weight || ex.bodyFatPercent !== inc.bodyFatPercent || ex.bmi !== inc.bmi) return
      const diff = dayDiff(ex.date, inc.date)
      if (diff <= MATCH_DAYS && (idx < 0 || diff < dayDiff(existing[idx].date, inc.date))) idx = i
    })
    if (idx >= 0) {
      used.add(idx)
      replaced.push({ before: existing[idx], after: inc })
    } else {
      added.push(inc)
    }
  }
  const kept = existing.filter((_, i) => !used.has(i))
  const rows = [...kept, ...incoming].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  return { rows, added, replaced, kept }
}

async function ensureSheet(token: string, title: string): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`sheet lookup failed: ${res.status}`)
  const data = (await res.json()) as { sheets: Array<{ properties: { title: string } }> }
  if (data.sheets.some((s) => s.properties.title === title)) return
  const add = await fetch(`${url}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
  })
  if (!add.ok) throw new Error(`addSheet ${title} failed: ${add.status}`)
}

async function readValues(token: string, range: string): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`read ${range} failed: ${res.status}`)
  return ((await res.json()) as { values?: string[][] }).values ?? []
}

async function writeValues(token: string, range: string, values: (string | number)[][], input: 'RAW' | 'USER_ENTERED'): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=${input}`
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  })
  if (!res.ok) throw new Error(`write ${range} failed: ${res.status}`)
}

async function clearValues(token: string, range: string): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}:clear`
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`clear ${range} failed: ${res.status}`)
}

/**
 * 取り込み計画を inbody シートに書き込む。
 * 書き込み後の行数は既存の行数以上になる（既存行は置き換えか保持のどちらか）ため、
 * 先に消さずに上書きする。途中で失敗しても既存データが消えた状態にはならない。
 */
export async function writeInbodyRows(token: string, rows: InBodyRecord[], existingCount: number): Promise<void> {
  await ensureInbodySheet(token)
  await writeValues(token, `'${SHEET_NAME}'!A1:H${rows.length + 1}`, [HEADER, ...rows.map(recordToRow)], 'USER_ENTERED')
  if (existingCount > rows.length) {
    await clearValues(token, `'${SHEET_NAME}'!A${rows.length + 2}:H${existingCount + 1}`)
  }
}

export const FULL_SHEET_NAME = 'inbody_full'

/**
 * CSV の全列を inbody_full シートに保存する（レポート用）。既存の行とは「日付」列で統合する。
 */
export async function writeInbodyFull(token: string, header: string[], rows: Record<string, string>[]): Promise<number> {
  await ensureSheet(token, FULL_SHEET_NAME)
  const current = await readValues(token, `'${FULL_SHEET_NAME}'!A:ZZ`)
  const curHeader = current[0] ?? []
  const cols = [...header, ...curHeader.filter((h) => !header.includes(h))]
  const byStamp = new Map<string, Record<string, string>>()
  for (const line of current.slice(1)) {
    const rec: Record<string, string> = {}
    curHeader.forEach((h, i) => { rec[h] = line[i] ?? '' })
    if (rec['日付']) byStamp.set(rec['日付'], rec)
  }
  for (const r of rows) byStamp.set(r['日付'], { ...byStamp.get(r['日付']), ...r })
  const merged = [...byStamp.values()].sort((a, b) => a['日付'].localeCompare(b['日付']))
  await writeValues(token, `'${FULL_SHEET_NAME}'!A1`, [cols, ...merged.map((r) => cols.map((c) => r[c] ?? ''))], 'RAW')
  return merged.length
}

export async function appendInbody(token: string, record: InBodyRecord): Promise<void> {
  await ensureInbodySheet(token)
  const range = encodeURIComponent(`'${SHEET_NAME}'!A:H`)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [recordToRow(record)] }),
  })
  if (!res.ok) throw new Error(`appendInbody failed: ${res.status}`)
}
