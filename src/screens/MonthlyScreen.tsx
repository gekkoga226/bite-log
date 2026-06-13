import { useEffect, useState, useMemo } from 'react'
import { fetchMeals } from '../services/sheets'
import { aggregateDay } from '../lib/aggregate'
import { toDateString } from '../lib/date'
import type { Goals } from '../lib/goals'
import type { MealRecord, MealType } from '../types'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
const MEAL_ORDER: MealType[] = ['朝食', '昼食', '夕食', '間食']
const MEAL_COLORS: Record<MealType, string> = {
  朝食: '#378ADD',
  昼食: '#EF9F27',
  夕食: '#639922',
  間食: '#D4537E',
}

function prevMonth(year: number, month: number) {
  return month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
}
function nextMonth(year: number, month: number) {
  return month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
}

export function MonthlyScreen({ token, goals }: { token: string; goals: Goals }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [meals, setMeals] = useState<MealRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
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

  // 月が変わったら選択日をクリア
  useEffect(() => { setSelected(null) }, [year, month])

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay()

  const dailyTotals = useMemo(() => {
    const map = new Map<string, ReturnType<typeof aggregateDay>>()
    for (let d = 1; d <= daysInMonth; d++) {
      const date = toDateString(new Date(year, month, d))
      map.set(date, aggregateDay(meals, date))
    }
    return map
  }, [meals, year, month, daysInMonth])

  const recordedDays = [...dailyTotals.values()].filter((t) => t.calories > 0)
  const totalCalories = recordedDays.reduce((s, t) => s + t.calories, 0)
  const avgCalories = recordedDays.length > 0 ? Math.round(totalCalories / recordedDays.length) : 0
  const avgPct = Math.min(100, Math.round((avgCalories / goals.calories) * 100))

  const avgP = recordedDays.length ? Math.round(recordedDays.reduce((s, t) => s + t.protein, 0) / recordedDays.length) : 0
  const avgF = recordedDays.length ? Math.round(recordedDays.reduce((s, t) => s + t.fat, 0) / recordedDays.length) : 0
  const avgC = recordedDays.length ? Math.round(recordedDays.reduce((s, t) => s + t.carbs, 0) / recordedDays.length) : 0

  const isFutureMonth =
    year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth())

  function goBack() { const p = prevMonth(year, month); setYear(p.year); setMonth(p.month) }
  function goForward() {
    if (isFutureMonth) return
    const n = nextMonth(year, month); setYear(n.year); setMonth(n.month)
  }

  const selectedMeals = selected
    ? meals.filter((m) => m.date === selected).sort(
        (a, b) => MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType),
      )
    : []
  const selectedTotal = selectedMeals.reduce((s, m) => s + m.calories, 0)
  const selectedDay = selected ? Number(selected.slice(8)) : null

  return (
    <div className="p-4 pb-24">
      {/* 月ナビゲーター */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={goBack} className="p-2 text-gray-500 text-xl leading-none active:text-gray-900" aria-label="前の月">←</button>
        <span className="font-bold text-lg">{year}年{month + 1}月</span>
        <button onClick={goForward} disabled={isFutureMonth} className="p-2 text-gray-500 text-xl leading-none disabled:opacity-25 active:text-gray-900" aria-label="次の月">→</button>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm py-12 text-center">読み込み中…</div>
      ) : (
        <>
          {/* ヒーロー: 1日平均カロリー */}
          <div className="rounded-2xl p-5 text-white mb-4" style={{ background: 'linear-gradient(135deg,#007AFF,#5856D6)' }}>
            <div className="text-xs opacity-80 mb-1">1日平均カロリー</div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold leading-none">{avgCalories.toLocaleString()}</span>
              <span className="text-xs opacity-80">/ 目標 {goals.calories.toLocaleString()} kcal</span>
            </div>
            <div className="h-2 bg-white/25 rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: `${avgPct}%` }} />
            </div>
            <div className="text-[11px] opacity-80 mt-1.5">
              目標の{avgPct}% ・ 記録{recordedDays.length}日 ・ 合計 {totalCalories.toLocaleString()} kcal
            </div>
          </div>

          {/* 1日平均PFC */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 shadow-sm">
            <div className="text-xs text-gray-500 mb-3">1日平均PFC（目標比）</div>
            {recordedDays.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-2">この月の記録はありません</div>
            ) : (
              <>
                <PfcRow label="タンパク質" value={avgP} goal={goals.protein} color="bg-blue-400" />
                <PfcRow label="脂質" value={avgF} goal={goals.fat} color="bg-yellow-400" />
                <PfcRow label="炭水化物" value={avgC} goal={goals.carbs} color="bg-green-400" />
              </>
            )}
          </div>

          {/* カレンダーヒートマップ */}
          <div className="bg-white border border-gray-100 rounded-2xl p-3.5 mb-4 shadow-sm">
            <div className="text-xs text-gray-500 mb-2.5">記録カレンダー（タップで詳細）</div>
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {WEEKDAYS.map((w, i) => (
                <div key={w} className={`text-[10px] ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDow }).map((_, i) => <div key={`b${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const date = toDateString(new Date(year, month, day))
                const cal = dailyTotals.get(date)!.calories
                const isToday = date === today
                const isSelected = date === selected
                const over = cal > goals.calories
                const has = cal > 0
                const cls = has
                  ? over ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  : 'bg-gray-50 text-gray-300'
                return (
                  <button
                    key={date}
                    onClick={() => setSelected(isSelected ? null : date)}
                    className={`aspect-square flex items-center justify-center text-[11px] rounded-md ${cls} ${isSelected ? 'ring-2 ring-brand' : isToday ? 'ring-1 ring-brand/50' : ''}`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-100 inline-block" />目標内</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-100 inline-block" />超過</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-gray-100 inline-block" />記録なし</span>
            </div>
          </div>

          {/* 選択日の詳細 */}
          {selected && selectedDay !== null && (
            <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold">{selectedDay}日の記録</span>
                <span className="text-sm font-bold text-brand">{selectedTotal.toLocaleString()} kcal</span>
              </div>
              {selectedMeals.length === 0 ? (
                <div className="text-xs text-gray-400 py-2 text-center">この日の記録はありません</div>
              ) : (
                <DayPfcChart meals={selectedMeals} goals={goals} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function DayPfcChart({ meals, goals }: { meals: MealRecord[]; goals: Goals }) {
  const rows: { key: keyof Goals; label: string; unit: string; get: (m: MealRecord) => number }[] = [
    { key: 'calories', label: 'カロリー',   unit: 'kcal', get: (m) => m.calories },
    { key: 'protein',  label: 'タンパク質', unit: 'g',    get: (m) => m.protein },
    { key: 'fat',      label: '脂質',       unit: 'g',    get: (m) => m.fat },
    { key: 'carbs',    label: '炭水化物',   unit: 'g',    get: (m) => m.carbs },
  ]

  return (
    <div>
      {rows.map(({ key, label, unit, get }) => {
        const goal = goals[key]
        const totals = MEAL_ORDER.map((type) => ({
          type,
          value: meals.filter((m) => m.mealType === type).reduce((s, m) => s + get(m), 0),
        }))
        const total = totals.reduce((s, t) => s + t.value, 0)
        const maxVal = Math.max(total, goal, 1)
        const goalPct = Math.round((goal / maxVal) * 100)
        const over = total > goal
        return (
          <div key={key} className="mb-3 last:mb-0">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">{label}</span>
              <span className={`font-semibold tabular-nums ${over ? 'text-red-500' : 'text-gray-800'}`}>
                {total}{unit} <span className="text-gray-400 font-normal">/ {goal}{unit}</span>
              </span>
            </div>
            <div className="relative h-3">
              <div className="flex h-full rounded-full overflow-hidden bg-gray-100">
                {totals.map(({ type, value }) =>
                  value > 0 ? (
                    <div
                      key={type}
                      style={{ width: `${Math.round((value / maxVal) * 100)}%`, background: MEAL_COLORS[type] }}
                    />
                  ) : null,
                )}
              </div>
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-gray-700 opacity-40 rounded-full"
                style={{ left: `${goalPct}%`, transform: 'translateX(-50%)' }}
              />
            </div>
          </div>
        )
      })}
      <div className="flex flex-wrap gap-3 mt-3">
        {MEAL_ORDER.map((type) => (
          <span key={type} className="flex items-center gap-1 text-[11px] text-gray-500">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: MEAL_COLORS[type] }} />
            {type}
          </span>
        ))}
      </div>
    </div>
  )
}

function PfcRow({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const pct = Math.min(100, Math.round((value / goal) * 100))
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold tabular-nums">{value}g <span className="text-gray-400 font-normal">/ {goal}g</span></span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
