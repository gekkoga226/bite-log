import type { Nutrition } from '../types'
import { parseNutrition } from '../lib/parseGemini'

export interface CalculateInput {
  memo: string
  note: string
  images?: { base64: string; mimeType: string }[]
}

export async function calculateNutrition(input: CalculateInput): Promise<Nutrition> {
  const res = await fetch('/api/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    let detail = ''
    try {
      const body = (await res.json()) as { error?: string }
      detail = body.error ? ` - ${body.error}` : ''
    } catch {
      /* ignore */
    }
    throw new Error(`calculate failed: ${res.status}${detail}`)
  }
  const data = (await res.json()) as { raw: string }
  return parseNutrition(data.raw)
}
