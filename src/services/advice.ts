import type { MealRecord, InBodyRecord } from '../types'
import type { Goals } from '../lib/goals'

export interface AdviceInput {
  goals: Goals
  /** 日付ごとのPFC合計（直近分のみ） */
  days: { date: string; calories: number; protein: number; fat: number; carbs: number }[]
  /** 最新の体組成（無ければ null） */
  latest: InBodyRecord | null
  /** 体組成の変化（最新 − 1つ前。無ければ null） */
  previous: InBodyRecord | null
}

export async function fetchAdvice(input: AdviceInput): Promise<string> {
  const res = await fetch('/api/advice', {
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
    throw new Error(`advice failed: ${res.status}${detail}`)
  }
  const data = (await res.json()) as { advice?: string }
  return String(data.advice ?? '').trim()
}

/** 直近 n 日分の食事を日付ごとにPFC合算する */
export function summarizeDays(meals: MealRecord[], n: number): AdviceInput['days'] {
  const map = new Map<string, AdviceInput['days'][number]>()
  for (const m of meals) {
    if (!m.date) continue
    const d = map.get(m.date) ?? { date: m.date, calories: 0, protein: 0, fat: 0, carbs: 0 }
    d.calories += m.calories
    d.protein += m.protein
    d.fat += m.fat
    d.carbs += m.carbs
    map.set(m.date, d)
  }
  return [...map.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, n)
    .reverse()
}
