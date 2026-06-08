import type { Nutrition } from '../types'

export function parseNutrition(raw: string): Nutrition {
  const cleaned = raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()
  const obj = JSON.parse(cleaned)
  if (typeof obj.calories !== 'number') {
    throw new Error('calories field missing or not a number')
  }
  return {
    calories: Math.round(obj.calories),
    protein: Math.round(obj.protein ?? 0),
    fat: Math.round(obj.fat ?? 0),
    carbs: Math.round(obj.carbs ?? 0),
    comment: String(obj.comment ?? ''),
  }
}
