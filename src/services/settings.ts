import type { Goals } from '../lib/goals'
import { DEFAULT_GOALS } from '../lib/goals'

const SHEET_NAME = 'settings'
const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID

function rowToGoals(cells: string[]): Goals {
  const calories = Number(cells[0])
  const protein = Number(cells[1])
  const fat = Number(cells[2])
  const carbs = Number(cells[3])
  if (!calories || !protein || !fat || !carbs) return DEFAULT_GOALS
  return { calories, protein, fat, carbs }
}

function goalsToRow(g: Goals): (string | number)[] {
  return [g.calories, g.protein, g.fat, g.carbs]
}

async function sheetExists(token: string): Promise<boolean> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return false
  const data = (await res.json()) as { sheets: Array<{ properties: { title: string } }> }
  return data.sheets.some((s) => s.properties.title === SHEET_NAME)
}

async function ensureSettingsSheet(token: string): Promise<void> {
  if (await sheetExists(token)) return

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] }),
    },
  )

  const headerRange = encodeURIComponent(`'${SHEET_NAME}'!A1:D1`)
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${headerRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [['calories', 'protein', 'fat', 'carbs']] }),
    },
  )
}

export async function fetchGoals(token: string): Promise<Goals> {
  try {
    const range = encodeURIComponent(`'${SHEET_NAME}'!A2:D2`)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return DEFAULT_GOALS
    const data = (await res.json()) as { values?: string[][] }
    const row = data.values?.[0]
    if (!row) return DEFAULT_GOALS
    return rowToGoals(row)
  } catch {
    return DEFAULT_GOALS
  }
}

export async function saveGoals(token: string, goals: Goals): Promise<void> {
  await ensureSettingsSheet(token)
  const range = encodeURIComponent(`'${SHEET_NAME}'!A2:D2`)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [goalsToRow(goals)] }),
  })
  if (!res.ok) throw new Error(`saveGoals failed: ${res.status}`)
}
