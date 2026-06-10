import type { MealRecord, MealType } from '../types'

const ICONS: Record<MealType, string> = { 朝食: '🌅', 昼食: '☀️', 夕食: '🌙', 間食: '🍪' }
const ORDER: MealType[] = ['朝食', '昼食', '夕食', '間食']

function mealLabel(meal: MealRecord): string {
  if (meal.memo) return meal.memo
  if (meal.note) return meal.note
  if (meal.comment) {
    // comment format: "食材A, 食材B : 評価..." → 食材リスト部分だけ表示
    const foodPart = meal.comment.split(':')[0].trim()
    if (foodPart) return foodPart
  }
  return '（メモなし）'
}

interface Props {
  meals: MealRecord[]
  onDelete?: (meal: MealRecord) => void
}

export function MealList({ meals, onDelete }: Props) {
  return (
    <div>
      <div className="text-sm font-semibold mb-2.5 text-gray-700">本日の食事記録</div>
      {ORDER.map((type) => {
        const items = meals.filter((m) => m.mealType === type)
        const total = items.reduce((s, m) => s + m.calories, 0)

        if (items.length === 0) {
          return (
            <div key={type} className="flex items-center py-3 border-b border-gray-100 gap-3 opacity-40">
              <div className="text-2xl w-9 text-center">{ICONS[type]}</div>
              <div className="flex-1">
                <div className="text-sm font-medium">{type}</div>
                <div className="text-xs text-gray-500 mt-0.5">未記録</div>
              </div>
              <div className="text-[15px] font-semibold text-brand">— kcal</div>
            </div>
          )
        }

        return (
          <div key={type} className="border-b border-gray-100">
            <div className="flex items-center pt-3 pb-1 gap-3">
              <div className="text-2xl w-9 text-center">{ICONS[type]}</div>
              <div className="flex-1 text-sm font-medium">{type}</div>
              <div className="text-[15px] font-semibold text-brand">{total} kcal</div>
            </div>
            {items.map((meal) => (
              <div key={meal.timestamp} className="flex items-center py-1.5 pl-12 pr-1 gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-700 leading-snug truncate">
                    {mealLabel(meal)}
                  </div>
                  {meal.memo && meal.note && (
                    <div className="text-[11px] text-gray-400 leading-snug truncate">{meal.note}</div>
                  )}
                </div>
                <div className="text-xs text-gray-400 shrink-0">{meal.calories} kcal</div>
                {onDelete && (
                  <button
                    onClick={() => onDelete(meal)}
                    className="text-gray-300 hover:text-red-400 active:text-red-500 p-1 shrink-0 text-base leading-none"
                    aria-label="削除"
                  >
                    🗑️
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
