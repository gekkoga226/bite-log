export type Tab = 'today' | 'weekly' | 'progress' | 'settings'

interface Props {
  active: Tab
  onChange: (t: Tab) => void
  onRecord: () => void
}

const ITEMS: { key: Tab; icon: string; label: string }[] = [
  { key: 'today', icon: '🏠', label: '今日' },
  { key: 'weekly', icon: '📊', label: '月間' },
  { key: 'progress', icon: '🎯', label: '進捗' },
  { key: 'settings', icon: '⚙️', label: '設定' },
]

export function BottomNav({ active, onChange, onRecord }: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto bg-white border-t border-gray-200 flex items-center px-2 pt-2 pb-5">
      {ITEMS.slice(0, 2).map(({ key, icon, label }) => (
        <NavButton key={key} icon={icon} label={label} active={active === key} onClick={() => onChange(key)} />
      ))}
      <button
        onClick={onRecord}
        className="w-14 h-14 -mt-6 bg-brand text-white rounded-full text-3xl flex items-center justify-center shadow-lg mx-1"
        aria-label="記録する"
      >＋</button>
      {ITEMS.slice(2).map(({ key, icon, label }) => (
        <NavButton key={key} icon={icon} label={label} active={active === key} onClick={() => onChange(key)} />
      ))}
    </div>
  )
}

function NavButton({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex-1 text-center text-[10px] ${active ? 'text-brand' : 'text-gray-400'}`}>
      <span className="block text-xl mb-0.5">{icon}</span>{label}
    </button>
  )
}
