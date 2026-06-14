import type { Goals } from '../lib/goals'

export interface SuggestGoalsTargets {
  bodyFatPercent?: number | null
  weight?: number | null
  muscleMass?: number | null
  deadlineMonths: number
}

export interface SuggestGoalsInput {
  current: Goals
  inbody: {
    weight: number
    bodyFatPercent: number
    muscleMass: number
    basalMetabolism: number
    bodyFatMass: number
  } | null
  mealAvg: { calories: number; protein: number; fat: number; carbs: number } | null
  targets: SuggestGoalsTargets
}

export interface SuggestGoalsResult {
  goals: Goals
  reasoning: string
}

export async function suggestGoals(input: SuggestGoalsInput): Promise<SuggestGoalsResult> {
  const res = await fetch('/api/suggest-goals', {
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
    throw new Error(`suggest-goals failed: ${res.status}${detail}`)
  }
  const data = (await res.json()) as {
    calories: number; protein: number; fat: number; carbs: number; reasoning: string
  }
  return {
    goals: {
      calories: Math.round(data.calories),
      protein: Math.round(data.protein),
      fat: Math.round(data.fat),
      carbs: Math.round(data.carbs),
    },
    reasoning: String(data.reasoning ?? '').trim(),
  }
}
