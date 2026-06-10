import type { MealRecord, MealType } from '../types'

const SHEET_NAME = 'meals'
const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID

export function recordToRow(r: MealRecord): (string | number)[] {
  return [
    r.timestamp, r.date, r.mealType, r.photoUrl,
    r.memo, r.note, r.calories, r.protein, r.fat, r.carbs, r.comment,
  ]
}

export function rowToRecord(cells: string[]): MealRecord {
  return {
    timestamp: cells[0] ?? '',
    date: cells[1] ?? '',
    mealType: (cells[2] as MealType) ?? '間食',
    photoUrl: cells[3] ?? '',
    memo: cells[4] ?? '',
    note: cells[5] ?? '',
    calories: Number(cells[6] ?? 0),
    protein: Number(cells[7] ?? 0),
    fat: Number(cells[8] ?? 0),
    carbs: Number(cells[9] ?? 0),
    comment: cells[10] ?? '',
  }
}

export async function appendMeal(token: string, record: MealRecord): Promise<void> {
  const range = encodeURIComponent(`'${SHEET_NAME}'!A:K`)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [recordToRow(record)] }),
  })
  if (!res.ok) throw new Error(`appendMeal failed: ${res.status}`)
}

export async function fetchMeals(token: string): Promise<MealRecord[]> {
  const range = encodeURIComponent(`'${SHEET_NAME}'!A2:K`)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`fetchMeals failed: ${res.status}`)
  const data = (await res.json()) as { values?: string[][] }
  return (data.values ?? []).map(rowToRecord)
}
