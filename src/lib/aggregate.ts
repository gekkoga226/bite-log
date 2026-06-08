import type { MealRecord, DailyTotals, MealType } from '../types'

export function aggregateDay(records: MealRecord[], date: string): DailyTotals {
  const byType: Record<MealType, number> = { 朝食: 0, 昼食: 0, 夕食: 0, 間食: 0 }
  const totals: DailyTotals = { calories: 0, protein: 0, fat: 0, carbs: 0, byType }
  for (const r of records) {
    if (r.date !== date) continue
    totals.calories += r.calories
    totals.protein += r.protein
    totals.fat += r.fat
    totals.carbs += r.carbs
    byType[r.mealType] += r.calories
  }
  return totals
}
