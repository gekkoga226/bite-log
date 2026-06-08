import type { ReactNode } from 'react'
import type { AuthState } from './useAuth'

interface Props {
  auth: AuthState & { signIn: () => void }
  children: ReactNode
}

export function AuthGuard({ auth, children }: Props) {
  const allowed = import.meta.env.VITE_ALLOWED_EMAIL

  if (!auth.accessToken) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 px-8">
        <h1 className="text-3xl font-extrabold">🍽️ Bite-Log</h1>
        <p className="text-gray-500 text-sm">ログインして食事記録を始めましょう</p>
        <button
          onClick={auth.signIn}
          className="bg-brand text-white rounded-xl px-6 py-3 font-semibold"
        >
          Googleでログイン
        </button>
      </div>
    )
  }

  if (auth.email !== allowed) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-8">
        <p className="text-red-500 font-semibold">このアカウントはアクセスできません</p>
        <p className="text-gray-500 text-sm">{auth.email}</p>
      </div>
    )
  }

  return <>{children}</>
}
