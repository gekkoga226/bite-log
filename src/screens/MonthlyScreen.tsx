import { useEffect, useState, useMemo } from 'react'
import { fetchMeals } from '../services/sheets'
import { aggregateDay } from '../lib/aggregate'
import { toDateString } from '../lib/date'
import { DEFAULT_GOALS } from '../lib/goals'
import type { MealRecord } from '../types'

function monthDates(year: number, month: number): string[] {
  const days = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(year, month, i + 1)
    return toDateString(d)
  })
}

function prevMonth(year: number, month: number) {
  return month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
}

function nextMonth(year: number, month: number) {
  return month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
}

export function MonthlyScreen({ token }: { token: string }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [meals, setMeals] = useState<MealRecord[]>([])
  const [loading, setLoading] = useState(true)
  const today = toDateString(now)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchMeals(token)
      .then((all) => { if (active) setMeals(all) })
      .catch(() => { if (active) setMeals([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  const dates = useMemo(() => monthDates(year, month), [year, month])

  const dailyData = useMemo(() =>
    dates.map((date) => ({ date, day: Number(date.slice(8)), totals: aggregateDay(meals, date) })),
    [dates, meals],
  )

  const recordedDays = dailyData.filter((d) => d.totals.calories > 0)
  const totalCalories = recordedDays.reduce((s, d) => s + d.totals.calories, 0)
  const avgCalories = recordedDays.length > 0 ? Math.round(totalCalories / recordedDays.length) : 0
  const maxBar = Math.max(...dailyData.map((d) => d.totals.calories), DEFAULT_GOALS.calories, 1)
  const isFutureMonth =
    year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth())

  function goBack() {
    const p = prevMonth(year, month)
    setYear(p.year); setMonth(p.month)
  }
  function goForward() {
    if (isFutureMonth) return
    const n = nextMonth(year, month)
    setYear(n.year); setMonth(n.month)
  }

  const totalProtein = recordedDays.reduce((s, d) => s + d.totals.protein, 0)
  const totalFat = recordedDays.reduce((s, d) => s + d.totals.fat, 0)
  const totalCarbs = recordedDays.reduce((s, d) => s + d.totals.carbs, 0)

  return (
    <div className="p-4 pb-24">
      {/* Month navigator */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={goBack} className="p-2 text-gray-500 text-xl leading-none">←</button>
        <span className="font-bold text-lg">{year}年{month + 1}月</span>
        <button
          onClick={goForward}
          disabled={isFutureMonth}
          className="p-2 text-gray-500 text-xl leading-none disabled:opacity-25"
        >→</button>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm py-12 text-center">読み込み中…</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <SummaryCard label="月間合計" value={totalCalories.toLocaleString()} unit="kcal" />
            <SummaryCard label="1日平均" value={avgCalories.toLocaleString()} unit="kcal" />
            <SummaryCard label="記録日数" value={String(recordedDays.length)} unit={`/ ${dates.length}日`} />
          </div>

          {/* Daily calorie bar chart */}
          <div className="bg-gray-50 rounded-2xl p-3 mb-4">
            <div className="text-xs text-gray-500 mb-2">カロリー（日別）</div>
            <div className="relative">
              {/* Target guideline */}
              <div
                className="absolute left-0 right-0 border-t border-dashed border-gray-300 pointer-events-none"
                style={{ bottom: `${Math.round((DEFAULT_GOALS.calories / maxBar) * 80) + 12}px` }}
              />
              <div className="flex items-end gap-px h-24 pb-3">
                {dailyData.map(({ date, day, totals }) => {
                  const h = totals.calories > 0
                    ? Math.max(3, Math.round((totals.calories / maxBar) * 80))
                    : 0
                  const isToday = date === today
                  const color = isToday
                    ? 'bg-brand'
                    : totals.calories > DEFAULT_GOALS.calories
                      ? 'bg-orange-400'
                      : totals.calories > 0
                        ? 'bg-blue-300'
                        : 'bg-gray-200'
                  return (
                    <div key={date} className="flex-1 flex flex-col items-center justify-end">
                      <div className={`w-full rounded-t-sm ${color}`} style={{ height: `${h}px` }} />
                      {(day === 1 || day % 5 === 0) && (
                        <span className={`text-[8px] mt-0.5 ${isToday ? 'text-brand font-bold' : 'text-gray-400'}`}>{day}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <div className="w-4 border-t border-dashed border-gray-400" />
              <span className="text-[9px] text-gray-400">目標 {DEFAULT_GOALS.calories.toLocaleString()} kcal</span>
            </div>
          </div>

          {/* Monthly PFC breakdown */}
          <div className="bg-gray-50 rounded-2xl p-4">
            <div className="text-xs text-gray-500 mb-3">月間PFC合計（記録日のみ）</div>
            {recordedDays.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-2">この月の記録はありません</div>
            ) : (
              <>
                <PfcRow label="タンパク質" value={totalProtein} color="bg-blue-400" />
                <PfcRow label="脂質" value={totalFat} color="bg-yellow-400" />
                <PfcRow label="炭水化物" value={totalCarbs} color="bg-green-400" />
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function SummaryCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 text-center shadow-sm">
      <div className="text-[10px] text-gray-400 mb-1">{label}</div>
      <div className="text-base font-bold leading-tight">{value}</div>
      <div className="text-[10px] text-gray-400">{unit}</div>
    </div>
  )
}

function PfcRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-2 last:mb-0">
      <div className={`w-2.5 h-2.5 rounded-full ${color} shrink-0`} />
      <span className="text-xs text-gray-600 flex-1">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value.toLocaleString()} g</span>
    </div>
  )
}
