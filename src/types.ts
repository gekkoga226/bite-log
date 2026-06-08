export type MealType = '朝食' | '昼食' | '夕食' | '間食'

/** Gemini計算結果（1食分の栄養素） */
export interface Nutrition {
  calories: number
  protein: number   // g
  fat: number       // g
  carbs: number     // g
  comment: string   // AIコメント
}

/** Sheetsに保存する1行分 */
export interface MealRecord {
  timestamp: string   // ISO8601
  date: string        // YYYY-MM-DD
  mealType: MealType
  photoUrl: string    // 空文字可
  memo: string
  note: string        // 備考
  calories: number
  protein: number
  fat: number
  carbs: number
  comment: string
}

/** 当日集計結果 */
export interface DailyTotals {
  calories: number
  protein: number
  fat: number
  carbs: number
  byType: Record<MealType, number>
}
