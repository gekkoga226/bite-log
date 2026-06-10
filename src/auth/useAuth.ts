import { useState, useCallback } from 'react'

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/fitness.nutrition.write',
].join(' ')

export interface AuthState {
  accessToken: string | null
  email: string | null
}

declare global {
  interface Window {
    google?: any
  }
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ accessToken: null, email: null })

  const signIn = useCallback(() => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: async (resp: { access_token?: string; error?: string }) => {
        // GISがエラー（キャンセル等）を返した場合は何もしない
        if (resp.error || !resp.access_token) {
          return
        }
        const token = resp.access_token
        const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!userRes.ok) {
          // メール取得に失敗したらトークンを保存しない（不完全な認証状態を避ける）
          return
        }
        const user = (await userRes.json()) as { email: string }
        setState({ accessToken: token, email: user.email })
      },
    })
    client.requestAccessToken()
  }, [])

  const signOut = useCallback(() => {
    setState({ accessToken: null, email: null })
  }, [])

  return { ...state, signIn, signOut }
}
