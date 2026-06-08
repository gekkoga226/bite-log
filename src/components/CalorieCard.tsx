interface Props { consumed: number; target: number }

export function CalorieCard({ consumed, target }: Props) {
  const remaining = Math.max(0, target - consumed)
  const pct = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0
  return (
    <div className="rounded-2xl p-5 text-white mb-4" style={{ background: 'linear-gradient(135deg,#007AFF,#5856D6)' }}>
      <div className="text-xs opacity-80 mb-2">今日の摂取カロリー</div>
      <div className="flex items-end gap-2 mb-3">
        <div className="text-4xl font-bold leading-none">{consumed.toLocaleString()}</div>
        <div className="text-sm opacity-80 pb-1">kcal</div>
      </div>
      <div className="text-sm opacity-80">目標 {target.toLocaleString()} kcal まで残り <strong>{remaining.toLocaleString()}</strong> kcal</div>
      <div className="mt-2 bg-white/30 rounded-lg h-2">
        <div className="bg-white rounded-lg h-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
