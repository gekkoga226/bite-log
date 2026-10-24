import type { MealRecord } from '../types'

/** AIコメント（「料理名,料理名 : 評価」形式）から料理名部分を取り出す */
function commentFoods(comment: string): string {
  if (!comment.includes(':')) return ''
  return comment.split(':')[0].trim()
}

/**
 * 食事のラベル: メモ > AIコメントの料理名 > 備考 > （メモなし）
 * 備考は「ライスおかわり」等の補足なので、料理名より優先しない
 */
export function mealLabel(meal: MealRecord): string {
  if (meal.memo) return meal.memo
  const foods = commentFoods(meal.comment)
  if (foods) return foods
  if (meal.note) return meal.note
  if (meal.comment) return meal.comment
  return '（メモなし）'
}
