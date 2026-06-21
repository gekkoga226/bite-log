import { useEffect, useState } from 'react'
import { fetchMeals, deleteMeal } from '../services/sheets'
import { aggregateDay } from '../lib/aggregate'
import { toDateString, addDays } from '../lib/date'
import type { Goals } from '../lib/goals'
import { CalorieCard } from '../components/CalorieCard'
import { PfcBars } from '../components/PfcBars'
import { MealList } from '../components/MealList'
import type { MealRecord } from '../types'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function greeting(d: Date): string {
  const h = d.getHours()
  if (h < 11) return 'おはようございます 👋'
  if (h < 18) return 'こんにちは 👋'
  return 'こんばんは 👋'
}

function formatDateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dow = WEEKDAYS[new Date(y, m - 1, d).getDay()]
  return `${y}年${m}月${d}日（${dow}）`
}

interface Props {
  token: string
  date: string
  onDateChange: (date: string) => void
  reloadKey: number
  goals: Goals
}

export function TodayScreen({ token, date, onDateChange, reloadKey, goals }: Props) {
  const [meals, setMeals] = useState<MealRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [localReload, setLocalReload] = useState(0)
  const today = toDateString(new Date())
  const isToday = date === today

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchMeals(token)
      .then((all) => { if (active) setMeals(all.filter((m) => m.date === date)) })
      .catch(() => { if (active) setMeals([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token, date, reloadKey, localReload])

  async function handleDelete(meal: MealRecord) {
    const label = meal.memo || meal.note || meal.mealType
    if (!window.confirm(`「${label}」を削除しますか？`)) return
    try {
      await deleteMeal(token, meal.timestamp)
      setLocalReload((n) => n + 1)
    } catch (e) {
      alert(`削除に失敗しました: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const totals = aggregateDay(meals, date)

  return (
    <div className="p-4 pb-24">
      <div className="text-xl font-bold mb-3">{isToday ? greeting(new Date()) : '記録の確認・修正'}</div>

      {/* 日付ナビゲータ */}
      <div className="flex items-center justify-between bg-gray-50 rounded-xl px-2 py-1.5 mb-4">
        <button
          onClick={() => onDateChange(addDays(date, -1))}
          className="p-2 text-gray-500 text-xl leading-none active:text-gray-900"
          aria-label="前の日"
        >
          ←
        </button>
        <label className="relative flex items-center cursor-pointer">
          <span className="text-[13px] font-semibold text-gray-700">{formatDateLabel(date)}</span>
          {isToday && <span className="ml-1.5 text-[10px] bg-brand text-white rounded-full px-1.5 py-0.5">今日</span>}
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => { if (e.target.value) onDateChange(e.target.value) }}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label="日付を選択"
          />
        </label>
        <button
          onClick={() => { if (!isToday) onDateChange(addDays(date, 1)) }}
          disabled={isToday}
          className="p-2 text-gray-500 text-xl leading-none disabled:opacity-25 active:text-gray-900"
          aria-label="次の日"
        >
          →
        </button>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm py-8 text-center">読み込み中…</div>
      ) : (
        <>
          <CalorieCard consumed={totals.calories} target={goals.calories} />
          <PfcBars
            protein={{ value: totals.protein, target: goals.protein }}
            fat={{ value: totals.fat, target: goals.fat }}
            carbs={{ value: totals.carbs, target: goals.carbs }}
          />
          <MealList meals={meals} onDelete={handleDelete} title={isToday ? '本日の食事記録' : '食事記録'} />
        </>
      )}
    </div>
  )
}
