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

/** InBody写真から抽出する体組成の数値（OCR結果） */
export interface InBodyMetrics {
  weight: number            // 体重 kg
  bodyFatPercent: number    // 体脂肪率 %
  muscleMass: number        // 骨格筋量 kg
  bmi: number               // BMI
  basalMetabolism: number   // 基礎代謝量 kcal
  bodyFatMass: number       // 体脂肪量 kg
}

/** Sheetsに保存する体組成の1行分 */
export interface InBodyRecord extends InBodyMetrics {
  timestamp: string   // ISO8601
  date: string        // YYYY-MM-DD（測定日）
}

/** 当日集計結果 */
export interface DailyTotals {
  calories: number
  protein: number
  fat: number
  carbs: number
  byType: Record<MealType, number>
}
