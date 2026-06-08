import type { Nutrition } from '../types'
import { parseNutrition } from '../lib/parseGemini'

export interface CalculateInput {
  memo: string
  note: string
  imageBase64?: string
  mimeType?: string
}

export async function calculateNutrition(input: CalculateInput): Promise<Nutrition> {
  const res = await fetch('/api/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    throw new Error(`calculate failed: ${res.status}`)
  }
  const data = (await res.json()) as { raw: string }
  return parseNutrition(data.raw)
}
