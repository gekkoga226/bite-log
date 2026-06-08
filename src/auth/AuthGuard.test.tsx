import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuthGuard } from './AuthGuard'

const allowed = import.meta.env.VITE_ALLOWED_EMAIL ?? 'mizuko226@gmail.com'

describe('AuthGuard', () => {
  it('shows login button when not authenticated', () => {
    render(
      <AuthGuard auth={{ accessToken: null, email: null, signIn: vi.fn() }}>
        <div>secret</div>
      </AuthGuard>
    )
    expect(screen.getByText('Googleでログイン')).toBeInTheDocument()
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
  })

  it('renders children when email matches allowlist', () => {
    render(
      <AuthGuard auth={{ accessToken: 'tok', email: allowed, signIn: vi.fn() }}>
        <div>secret</div>
      </AuthGuard>
    )
    expect(screen.getByText('secret')).toBeInTheDocument()
  })
})
