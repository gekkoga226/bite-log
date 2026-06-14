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
