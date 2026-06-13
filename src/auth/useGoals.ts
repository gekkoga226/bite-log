import { useState, useEffect } from 'react'
import { fetchGoals } from '../services/settings'
import { DEFAULT_GOALS } from '../lib/goals'
import type { Goals } from '../lib/goals'

export function useGoals(token: string | null) {
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) return
    let active = true
    setLoading(true)
    fetchGoals(token)
      .then((g) => { if (active) setGoals(g) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  return { goals, setGoals, loading }
}
