import type { MealType } from '../types'

export function detectMealType(d: Date): MealType {
  const h = d.getHours()
  if (h >= 5 && h < 11) return '朝食'
  if (h >= 11 && h < 15) return '昼食'
  if (h >= 17 && h < 22) return '夕食'
  return '間食'
}
