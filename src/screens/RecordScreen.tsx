import { useState } from 'react'
import { RecordForm, type RecordFormValues } from '../components/RecordForm'
import { detectMealType } from '../lib/mealType'
import { toDateString } from '../lib/date'
import { uploadImage } from '../services/drive'
import { calculateNutrition } from '../services/calculate'
import { appendMeal } from '../services/sheets'
import { fileToDataUrl, stripDataUrlPrefix } from '../lib/fileToBase64'
import type { Nutrition } from '../types'

interface Props {
  token: string
  onDone: () => void
}

export function RecordScreen({ token, onDone }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Nutrition | null>(null)

  async function handleSubmit(values: RecordFormValues) {
    setSubmitting(true)
    setError(null)
    try {
      let photoUrl = ''
      let imageBase64: string | undefined
      let mimeType: string | undefined
      if (values.file) {
        const dataUrl = await fileToDataUrl(values.file)
        imageBase64 = stripDataUrlPrefix(dataUrl)
        mimeType = values.file.type
        photoUrl = await uploadImage(token, values.file)
      }

      const nutrition = await calculateNutrition({
        memo: values.memo, note: values.note, imageBase64, mimeType,
      })

      const now = new Date()
      await appendMeal(token, {
        timestamp: now.toISOString(),
        date: toDateString(now),
        mealType: values.mealType,
        photoUrl,
        memo: values.memo,
        note: values.note,
        ...nutrition,
      })
      setResult(nutrition)
    } catch (e) {
      setError('計算または保存に失敗しました。もう一度お試しください。')
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <div className="p-4 flex flex-col gap-4">
        <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg,#007AFF,#5856D6)' }}>
          <div className="text-xs opacity-80 mb-1">計算結果</div>
          <div className="text-4xl font-bold">{result.calories} <span className="text-sm font-normal">kcal</span></div>
          <div className="flex gap-2 mt-3 text-xs font-semibold">
            <span className="flex-1 bg-white/20 rounded p-1.5 text-center">P {result.protein}g</span>
            <span className="flex-1 bg-white/20 rounded p-1.5 text-center">F {result.fat}g</span>
            <span className="flex-1 bg-white/20 rounded p-1.5 text-center">C {result.carbs}g</span>
          </div>
          {result.comment && <div className="text-xs opacity-90 mt-3">{result.comment}</div>}
        </div>
        <button onClick={onDone} className="bg-brand text-white rounded-xl py-3 font-semibold">完了</button>
      </div>
    )
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">食事を記録</h2>
      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-3">{error}</div>
      )}
      <RecordForm initialMealType={detectMealType(new Date())} submitting={submitting} onSubmit={handleSubmit} />
    </div>
  )
}
