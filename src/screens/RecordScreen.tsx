import { useState } from 'react'
import { RecordForm, type RecordFormValues } from '../components/RecordForm'
import { detectMealType } from '../lib/mealType'
import { uploadImage } from '../services/drive'
import { calculateNutrition } from '../services/calculate'
import { appendMeal } from '../services/sheets'
import { compressImages } from '../lib/compressImage'
import type { Nutrition, MealType } from '../types'

interface Props {
  token: string
  onDone: () => void
  onCancel: () => void
}

interface ResultState {
  nutrition: Nutrition
  total: Nutrition | null
  people: number
  mealType: MealType
  timestamp: string
}

function divideNutrition(n: Nutrition, people: number): Nutrition {
  return {
    calories: Math.round(n.calories / people),
    protein: Math.round(n.protein / people),
    fat: Math.round(n.fat / people),
    carbs: Math.round(n.carbs / people),
    comment: n.comment,
  }
}

export function RecordScreen({ token, onDone, onCancel }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ResultState | null>(null)

  async function handleSubmit(values: RecordFormValues) {
    setSubmitting(true)
    setError(null)
    try {
      let photoUrl = ''
      let images: { base64: string; mimeType: string }[] = []
      if (values.files.length > 0) {
        images = await compressImages(values.files)
        const urls = await Promise.all(
          values.files.map((f) => uploadImage(token, f).catch(() => '')),
        )
        photoUrl = urls.filter(Boolean).join(', ')
      }

      const total = await calculateNutrition({ memo: values.memo, note: values.note, images })
      const nutrition = values.people > 1 ? divideNutrition(total, values.people) : total
      const timestamp = new Date().toISOString()

      await appendMeal(token, {
        timestamp,
        date: values.date,
        mealType: values.mealType,
        photoUrl,
        memo: values.memo,
        note: values.note,
        ...nutrition,
      })

      setResult({ nutrition, total: values.people > 1 ? total : null, people: values.people, mealType: values.mealType, timestamp })
    } catch (e) {
      setError(`エラー: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    const { nutrition, total, people } = result
    return (
      <div className="p-4 flex flex-col gap-4">
        <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg,#007AFF,#5856D6)' }}>
          <div className="text-xs opacity-80 mb-1">
            {people > 1 ? `計算結果（${people}人でシェア）` : '計算結果'}
          </div>
          {total && (
            <div className="text-xs opacity-70 mb-1">
              全体 {total.calories} kcal ÷ {people}人
            </div>
          )}
          <div className="text-4xl font-bold">
            {nutrition.calories} <span className="text-sm font-normal">kcal</span>
          </div>
          <div className="flex gap-2 mt-3 text-xs font-semibold">
            <span className="flex-1 bg-white/20 rounded p-1.5 text-center">P {nutrition.protein}g</span>
            <span className="flex-1 bg-white/20 rounded p-1.5 text-center">F {nutrition.fat}g</span>
            <span className="flex-1 bg-white/20 rounded p-1.5 text-center">C {nutrition.carbs}g</span>
          </div>
          {nutrition.comment && <div className="text-xs opacity-90 mt-3">{nutrition.comment}</div>}
        </div>

        <button onClick={onDone} className="bg-brand text-white rounded-xl py-3 font-semibold">完了</button>
      </div>
    )
  }

  return (
    <div className="p-4 pb-8">
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700 active:text-gray-900 p-1 -ml-1 text-xl leading-none"
          aria-label="戻る"
        >
          ←
        </button>
        <h2 className="text-lg font-bold">食事を記録</h2>
      </div>
      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-3">{error}</div>
      )}
      <RecordForm initialMealType={detectMealType(new Date())} submitting={submitting} onSubmit={handleSubmit} />
    </div>
  )
}
