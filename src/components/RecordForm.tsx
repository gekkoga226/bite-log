import { useState, useRef, useEffect } from 'react'
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

function PhotoThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
  return (
    <div className="relative w-16 h-16 shrink-0">
      {url && <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg" />}
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center leading-none"
        aria-label="削除"
      >
        ✕
      </button>
    </div>
  )
}

export function RecordForm({ initialMealType, submitting, onSubmit }: Props) {
  const [mealType, setMealType] = useState<MealType>(initialMealType)
  const [memo, setMemo] = useState('')
  const [note, setNote] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  function handleAddPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const newFiles = Array.from(e.target.files ?? [])
    if (newFiles.length > 0) setFiles((prev) => [...prev, ...newFiles])
    // リセットしておくことで同じファイルを再選択可能に
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
        <div className="mt-1">
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {files.map((f, i) => (
                <PhotoThumb
                  key={i}
                  file={f}
                  onRemove={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                />
              ))}
            </div>
          )}
          <label className="inline-flex items-center gap-1 cursor-pointer">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleAddPhotos}
              className="hidden"
            />
            <span className="text-sm text-brand font-medium">
              {files.length === 0 ? '+ 写真を選択' : '+ さらに追加'}
            </span>
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
