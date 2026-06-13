import { useState } from 'react'
import { saveGoals } from '../services/settings'
import type { Goals } from '../lib/goals'

interface Props {
  token: string
  goals: Goals
  onSaved: (g: Goals) => void
}

function isValid(v: string): boolean {
  return v !== '' && !isNaN(Number(v)) && Number(v) > 0
}

export function SettingsScreen({ token, goals, onSaved }: Props) {
  const [calories, setCalories] = useState(String(goals.calories))
  const [protein, setProtein] = useState(String(goals.protein))
  const [fat, setFat] = useState(String(goals.fat))
  const [carbs, setCarbs] = useState(String(goals.carbs))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const canSave = [calories, protein, fat, carbs].every(isValid)

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setMessage(null)
    const newGoals: Goals = {
      calories: Math.round(Number(calories)),
      protein: Math.round(Number(protein)),
      fat: Math.round(Number(fat)),
      carbs: Math.round(Number(carbs)),
    }
    try {
      await saveGoals(token, newGoals)
      onSaved(newGoals)
      setMessage({ type: 'success', text: '保存しました' })
    } catch {
      setMessage({ type: 'error', text: '保存に失敗しました。もう一度お試しください。' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 pb-24">
      <h2 className="text-lg font-bold mb-4">設定</h2>
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-4">
        <div className="text-xs text-gray-500 mb-4">目標値</div>
        <GoalField label="カロリー" unit="kcal" value={calories} onChange={setCalories} />
        <GoalField label="タンパク質" unit="g" value={protein} onChange={setProtein} />
        <GoalField label="脂質" unit="g" value={fat} onChange={setFat} />
        <GoalField label="炭水化物" unit="g" value={carbs} onChange={setCarbs} />
      </div>

      {message && (
        <div
          className={`text-sm rounded-lg p-3 mb-3 ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
          }`}
        >
          {message.text}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving || !canSave}
        aria-label="保存する"
        className="w-full bg-brand text-white rounded-xl py-3 font-semibold disabled:opacity-50"
      >
        {saving ? '保存中...' : '保存する'}
      </button>
    </div>
  )
}

function GoalField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string
  unit: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-700 flex-1">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 text-right bg-gray-50 rounded-lg px-3 py-1.5 text-sm tabular-nums"
      />
      <span className="text-xs text-gray-400 w-8">{unit}</span>
    </div>
  )
}
