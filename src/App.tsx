import { useState } from 'react'
import { useAuth } from './auth/useAuth'
import { useGoals } from './auth/useGoals'
import { AuthGuard } from './auth/AuthGuard'
import { BottomNav, type Tab } from './components/BottomNav'
import { TodayScreen } from './screens/TodayScreen'
import { RecordScreen } from './screens/RecordScreen'
import { MonthlyScreen } from './screens/MonthlyScreen'
import { ProgressScreen } from './screens/ProgressScreen'
import { SettingsScreen } from './screens/SettingsScreen'

export default function App() {
  const auth = useAuth()
  const { goals, setGoals } = useGoals(auth.accessToken)
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
            {tab === 'today' && <TodayScreen token={auth.accessToken!} reloadKey={reloadKey} goals={goals} />}
            {tab === 'weekly' && <MonthlyScreen token={auth.accessToken!} goals={goals} />}
            {tab === 'progress' && <ProgressScreen token={auth.accessToken!} goals={goals} />}
            {tab === 'settings' && (
              <SettingsScreen token={auth.accessToken!} goals={goals} onSaved={setGoals} />
            )}
            <BottomNav active={tab} onChange={setTab} onRecord={() => setRecording(true)} />
          </>
        )}
      </div>
    </AuthGuard>
  )
}
