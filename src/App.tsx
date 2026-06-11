import { useState } from 'react'
import { useAuth } from './auth/useAuth'
import { AuthGuard } from './auth/AuthGuard'
import { BottomNav, type Tab } from './components/BottomNav'
import { TodayScreen } from './screens/TodayScreen'
import { RecordScreen } from './screens/RecordScreen'
import { MonthlyScreen } from './screens/MonthlyScreen'

export default function App() {
  const auth = useAuth()
  const [tab, setTab] = useState<Tab>('today')
  const [recording, setRecording] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  return (
    <AuthGuard auth={auth}>
      <div className="max-w-[430px] mx-auto min-h-full bg-white">
        {recording ? (
          <RecordScreen
            token={auth.accessToken!}
            onDone={() => { setRecording(false); setReloadKey((k) => k + 1); setTab('today') }}
            onCancel={() => setRecording(false)}
          />
        ) : (
          <>
            {tab === 'today' && <TodayScreen token={auth.accessToken!} reloadKey={reloadKey} />}
            {tab === 'weekly' && <MonthlyScreen token={auth.accessToken!} />}
            {tab === 'progress' && <Placeholder label="進捗（Phase 2/3で実装）" />}
            {tab === 'settings' && <Placeholder label="設定（Phase 3で実装）" />}
            <BottomNav active={tab} onChange={setTab} onRecord={() => setRecording(true)} />
          </>
        )}
      </div>
    </AuthGuard>
  )
}

function Placeholder({ label }: { label: string }) {
  return <div className="p-8 text-center text-gray-400 text-sm pb-24">{label}</div>
}
