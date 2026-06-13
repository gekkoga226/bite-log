import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useGoals } from './useGoals'

vi.mock('../services/settings', () => ({
  fetchGoals: vi.fn(),
}))
import { fetchGoals } from '../services/settings'

beforeEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('useGoals', () => {
  it('returns DEFAULT_GOALS initially then updates after fetch', async () => {
    vi.mocked(fetchGoals).mockResolvedValue({ calories: 2000, protein: 100, fat: 50, carbs: 200 })
    const { result } = renderHook(() => useGoals('tok'))

    expect(result.current.goals.calories).toBe(1800)
    await waitFor(() => expect(result.current.goals.calories).toBe(2000))
    expect(result.current.loading).toBe(false)
  })

  it('does not call fetchGoals when token is null', () => {
    renderHook(() => useGoals(null))
    expect(fetchGoals).not.toHaveBeenCalled()
  })

  it('setGoals updates state immediately', async () => {
    vi.mocked(fetchGoals).mockResolvedValue({ calories: 1800, protein: 93, fat: 42, carbs: 195 })
    const { result } = renderHook(() => useGoals('tok'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    result.current.setGoals({ calories: 2200, protein: 110, fat: 55, carbs: 220 })
    await waitFor(() => expect(result.current.goals.calories).toBe(2200))
  })
})
