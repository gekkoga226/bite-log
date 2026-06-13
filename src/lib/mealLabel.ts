import type { MealRecord } from '../types'

/** 食事のラベル: メモ > 備考 > AIコメントの食材リスト部分 > （メモなし） */
export function mealLabel(meal: MealRecord): string {
  if (meal.memo) return meal.memo
  if (meal.note) return meal.note
  if (meal.comment) {
    const foodPart = meal.comment.split(':')[0].trim()
    if (foodPart) return foodPart
  }
  return '（メモなし）'
}
