import { useState, useRef } from 'react'
import type { MealType } from '../types'

export interface RecordFormValues {
  mealType: MealType
  memo: string
  note: string
  files: File[]
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
  const [files, setFiles] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  function handleAddPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) setFiles((prev) => [...prev, file])
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => { e.preventDefault(); onSubmit({ mealType, memo, note, files }) }}
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
        <label className="text-xs text-gray-500">写真（任意・複数可）</label>
        <div className="mt-1 flex flex-col gap-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
              <span className="text-xs text-gray-700 flex-1 truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                className="text-gray-400 hover:text-red-400 active:text-red-500 text-sm leading-none"
                aria-label="削除"
              >
                ✕
              </button>
            </div>
          ))}
          <label className="inline-flex items-center gap-1 cursor-pointer mt-0.5">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={handleAddPhoto}
              className="hidden"
            />
            <span className="text-sm text-brand font-medium">+ 写真を追加</span>
          </label>
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500">食事内容メモ</label>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder={'例:\n・牛丼（並）\n・みそ汁'}
          rows={3}
          className="w-full mt-1 bg-gray-100 rounded-lg px-3 py-2 text-sm resize-none"
        />
      </div>

      <div>
        <label className="text-xs text-gray-500">備考（店名・メニュー名など）</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={'例:\nセブンイレブン\nサラダチキン 115kcal'}
          rows={2}
          className="w-full mt-1 bg-gray-100 rounded-lg px-3 py-2 text-sm resize-none"
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
