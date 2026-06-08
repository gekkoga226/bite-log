import { useEffect, useState } from 'react'
import { fetchMeals } from '../services/sheets'
import { aggregateDay } from '../lib/aggregate'
import { toDateString } from '../lib/date'
import { DEFAULT_GOALS } from '../lib/goals'
import { CalorieCard } from '../components/CalorieCard'
import { PfcBars } from '../components/PfcBars'
import { MealList } from '../components/MealList'
import type { MealRecord } from '../types'

function greeting(d: Date): string {
  const h = d.getHours()
  if (h < 11) return 'おはようございます 👋'
  if (h < 18) return 'こんにちは 👋'
  return 'こんばんは 👋'
}

export function TodayScreen({ token, reloadKey }: { token: string; reloadKey: number }) {
  const [meals, setMeals] = useState<MealRecord[]>([])
  const [loading, setLoading] = useState(true)
  const today = toDateString(new Date())

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchMeals(token)
      .then((all) => { if (active) setMeals(all.filter((m) => m.date === today)) })
      .catch(() => { if (active) setMeals([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token, today, reloadKey])

  const totals = aggregateDay(meals, today)

  return (
    <div className="p-4 pb-24">
      <div className="text-xl font-bold mb-0.5">{greeting(new Date())}</div>
      <div className="text-[13px] text-gray-500 mb-4">{today}</div>
      {loading ? (
        <div className="text-gray-400 text-sm py-8 text-center">読み込み中…</div>
      ) : (
        <>
          <CalorieCard consumed={totals.calories} target={DEFAULT_GOALS.calories} />
          <PfcBars
            protein={{ value: totals.protein, target: DEFAULT_GOALS.protein }}
            fat={{ value: totals.fat, target: DEFAULT_GOALS.fat }}
            carbs={{ value: totals.carbs, target: DEFAULT_GOALS.carbs }}
          />
          <MealList meals={meals} />
        </>
      )}
    </div>
  )
}
