import { useState } from 'react'
import { saveGoals } from '../services/settings'
import { fetchInbody } from '../services/inbody'
import { fetchMeals } from '../services/sheets'
import { summarizeDays } from '../services/advice'
import { suggestGoals } from '../services/suggestGoals'
import type { Goals } from '../lib/goals'
import type { InBodyRecord } from '../types'

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
  const [aiReasoning, setAiReasoning] = useState<string | null>(null)

  const canSave = [calories, protein, fat, carbs].every(isValid)

  function handleSuggest(suggested: Goals, reasoning: string) {
    setCalories(String(suggested.calories))
    setProtein(String(suggested.protein))
    setFat(String(suggested.fat))
    setCarbs(String(suggested.carbs))
    setAiReasoning(reasoning)
    setMessage(null)
  }

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
      setAiReasoning(null)
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

      <AiGoalPanel token={token} goals={goals} onSuggest={handleSuggest} />

      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-4">
        <div className="text-xs text-gray-500 mb-4">目標値</div>
        {aiReasoning && (
          <div className="text-[11px] text-blue-700 bg-blue-50 rounded-lg p-2.5 mb-3 leading-relaxed">
            {aiReasoning}
          </div>
        )}
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

// ── AiGoalPanel ──────────────────────────────────────────────────────────────

type NullableNumber = number | null

interface AiGoalPanelProps {
  token: string
  goals: Goals
  onSuggest: (g: Goals, reasoning: string) => void
}

interface BodyTargets {
  bodyFatPercent: string
  weight: string
  muscleMass: string
  deadlineMonths: string
}

interface SuggestResult {
  goals: Goals
  reasoning: string
}

const EMPTY_TARGETS: BodyTargets = { bodyFatPercent: '', weight: '', muscleMass: '', deadlineMonths: '3' }

function parseOptional(v: string): NullableNumber {
  return v.trim() === '' ? null : Number(v)
}

function AiGoalPanel({ token, goals, onSuggest }: AiGoalPanelProps) {
  const [targets, setTargets] = useState<BodyTargets>(EMPTY_TARGETS)
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SuggestResult | null>(null)

  function set(key: keyof BodyTargets) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setTargets((t) => ({ ...t, [key]: e.target.value }))
      setResult(null)
    }
  }

  async function calculate() {
    setCalculating(true)
    setError(null)
    setResult(null)
    try {
      const [inbodyRecords, meals] = await Promise.all([
        fetchInbody(token),
        fetchMeals(token).catch(() => []),
      ])
      const latest: InBodyRecord | null = inbodyRecords.length > 0
        ? inbodyRecords[inbodyRecords.length - 1]
        : null
      const days = summarizeDays(meals, 7)
      const mealAvg = days.length > 0
        ? {
            calories: days.reduce((s, d) => s + d.calories, 0) / days.length,
            protein: days.reduce((s, d) => s + d.protein, 0) / days.length,
            fat: days.reduce((s, d) => s + d.fat, 0) / days.length,
            carbs: days.reduce((s, d) => s + d.carbs, 0) / days.length,
          }
        : null

      const deadlineMonths = targets.deadlineMonths.trim() === ''
        ? 3
        : Math.max(1, Number(targets.deadlineMonths))

      const suggested = await suggestGoals({
        current: goals,
        inbody: latest
          ? {
              weight: latest.weight,
              bodyFatPercent: latest.bodyFatPercent,
              muscleMass: latest.muscleMass,
              basalMetabolism: latest.basalMetabolism,
              bodyFatMass: latest.bodyFatMass,
            }
          : null,
        mealAvg,
        targets: {
          bodyFatPercent: parseOptional(targets.bodyFatPercent),
          weight: parseOptional(targets.weight),
          muscleMass: parseOptional(targets.muscleMass),
          deadlineMonths,
        },
      })
      setResult(suggested)
    } catch (e) {
      setError(`計算エラー: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setCalculating(false)
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-4">
      <div className="text-xs text-gray-500 mb-1">AI目標値を計算する</div>
      <p className="text-[11px] text-gray-400 mb-3">
        達成したい体組成の目標を入力してください。未入力の項目は「現状維持」として計算します。
      </p>

      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <TargetField label="目標体脂肪率" unit="%" value={targets.bodyFatPercent} onChange={set('bodyFatPercent')} placeholder="例: 15" />
        <TargetField label="目標体重" unit="kg" value={targets.weight} onChange={set('weight')} placeholder="例: 65" />
        <TargetField label="目標骨格筋量" unit="kg" value={targets.muscleMass} onChange={set('muscleMass')} placeholder="例: 35" />
        <TargetField label="達成期限" unit="ヶ月" value={targets.deadlineMonths} onChange={set('deadlineMonths')} placeholder="3" />
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-xs rounded-lg p-2.5 mb-3">{error}</div>
      )}

      {result && (
        <div className="bg-blue-50 rounded-xl p-3 mb-3">
          <div className="text-[11px] text-blue-700 leading-relaxed mb-2">{result.reasoning}</div>
          <div className="flex gap-2 text-xs font-semibold text-blue-800">
            <span className="flex-1 bg-white/70 rounded p-1.5 text-center">{result.goals.calories} kcal</span>
            <span className="flex-1 bg-white/70 rounded p-1.5 text-center">P {result.goals.protein}g</span>
            <span className="flex-1 bg-white/70 rounded p-1.5 text-center">F {result.goals.fat}g</span>
            <span className="flex-1 bg-white/70 rounded p-1.5 text-center">C {result.goals.carbs}g</span>
          </div>
          <button
            onClick={() => onSuggest(result.goals, result.reasoning)}
            className="w-full mt-2 bg-brand text-white rounded-lg py-2 text-xs font-semibold active:opacity-80"
          >
            この値を目標にする
          </button>
        </div>
      )}

      <button
        onClick={calculate}
        disabled={calculating}
        className="w-full bg-gray-900 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
      >
        {calculating ? '計算中 (gemini-2.5-pro)…' : result ? '再計算する' : 'AIに目標値を計算してもらう'}
      </button>
    </div>
  )
}

function TargetField({
  label, unit, value, onChange, placeholder,
}: {
  label: string; unit: string; value: string; onChange: React.ChangeEventHandler<HTMLInputElement>; placeholder: string
}) {
  return (
    <div>
      <label className="text-[11px] text-gray-500">{label}{unit && `（${unit}）`}</label>
      <input
        type="number"
        inputMode="decimal"
        step="0.1"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full mt-1 bg-gray-100 rounded-lg px-3 py-2 text-sm tabular-nums placeholder:text-gray-300"
      />
    </div>
  )
}

// ── GoalField ─────────────────────────────────────────────────────────────────

function GoalField({
  label, unit, value, onChange,
}: {
  label: string; unit: string; value: string; onChange: (v: string) => void
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
