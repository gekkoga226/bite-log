import type { MealRecord, MealType } from '../types'

const ICONS: Record<MealType, string> = { 朝食: '🌅', 昼食: '☀️', 夕食: '🌙', 間食: '🍪' }
const ORDER: MealType[] = ['朝食', '昼食', '夕食', '間食']

export function MealList({ meals }: { meals: MealRecord[] }) {
  return (
    <div>
      <div className="text-sm font-semibold mb-2.5 text-gray-700">本日の食事記録</div>
      {ORDER.map((type) => {
        const items = meals.filter((m) => m.mealType === type)
        const total = items.reduce((s, m) => s + m.calories, 0)
        const memo = items.map((m) => m.memo).filter(Boolean).join('、')
        const recorded = items.length > 0
        return (
          <div key={type} className={`flex items-center py-3 border-b border-gray-100 gap-3 ${recorded ? '' : 'opacity-40'}`}>
            <div className="text-2xl w-9 text-center">{ICONS[type]}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{type}</div>
              <div className="text-xs text-gray-500 mt-0.5">{recorded ? memo || '（メモなし）' : '未記録'}</div>
            </div>
            <div className="text-[15px] font-semibold text-brand">{recorded ? `${total} kcal` : '— kcal'}</div>
          </div>
        )
      })}
    </div>
  )
}
