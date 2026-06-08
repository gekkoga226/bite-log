interface Props {
  protein: { value: number; target: number }
  fat: { value: number; target: number }
  carbs: { value: number; target: number }
}

function Bar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0
  return (
    <div className="flex-1 bg-gray-100 rounded-2xl p-3 text-center">
      <div className="text-xl font-bold" style={{ color }}>{value}g</div>
      <div className="text-[11px] text-gray-500 mt-0.5">{label}</div>
      <div className="bg-gray-200 rounded h-1 mt-1.5">
        <div className="rounded h-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export function PfcBars({ protein, fat, carbs }: Props) {
  return (
    <div className="flex gap-2.5 mb-4">
      <Bar label="タンパク質" value={protein.value} target={protein.target} color="#FF3B30" />
      <Bar label="脂質" value={fat.value} target={fat.target} color="#FF9500" />
      <Bar label="炭水化物" value={carbs.value} target={carbs.target} color="#34C759" />
    </div>
  )
}
