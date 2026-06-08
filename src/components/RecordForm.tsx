import { useState } from 'react'
import type { MealType } from '../types'

export interface RecordFormValues {
  mealType: MealType
  memo: string
  note: string
  file: File | null
}

interface Props {
  initialMealType: MealType
  submitting: boolean
  onSubmit: (values: RecordFormValues) => void
}

const TYPES: MealType[] = ['朝食', '昼食', '夕食', '間食']

export function RecordForm({ initialMealType, submitting, onSubmit }: Props) {
  const [mealType, setMealType] = useState<MealType>(initialMealType)
  const [memo, setMemo] = useState('')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => { e.preventDefault(); onSubmit({ mealType, memo, note, file }) }}
    >
      <div>
        <label className="text-xs text-gray-500">食事タイプ</label>
        <div className="flex gap-2 mt-1">
          {TYPES.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setMealType(t)}
              className={`flex-1 py-2 rounded-lg text-sm ${mealType === t ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500">写真（任意）</label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block mt-1 text-sm"
        />
      </div>

      <div>
        <label className="text-xs text-gray-500">食事内容メモ</label>
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="例: 牛丼"
          className="w-full mt-1 bg-gray-100 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="text-xs text-gray-500">備考（店名・メニュー名など）</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="例: セブンイレブン サラダチキン"
          className="w-full mt-1 bg-gray-100 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="bg-brand text-white rounded-xl py-3 font-semibold disabled:opacity-50"
      >
        {submitting ? '計算中…' : '記録する'}
      </button>
    </form>
  )
}
