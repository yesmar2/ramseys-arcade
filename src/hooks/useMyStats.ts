import { useEffect, useState } from 'react'
import { normalizePlayerName, type LeaderboardPeriod } from '../lib/leaderboard'
import { fetchMyStats, type StatsResponse } from '../lib/stats'
import { useAuth } from './useAuth'
import { usePlayerName } from './usePlayerName'

export type MyStats = {
  loading: boolean
  error: boolean
  /** Null until it lands, and when signed out. */
  data: StatsResponse | null
}

/*
 * One answer per account, tag and period is kept for the visit, so going from the
 * player card to Stats and back doesn't ask again. It is a heavy question for
 * the API (it places every run on every board), and the numbers only move
 * when you play.
 */
const cache = new Map<string, { at: number; body: StatsResponse }>()
const FRESH_MS = 60_000

/**
 * Your own stats for a period, for the tag you play as here: the Stats view
 * reads all of it, the player card only the streak.
 */
export function useMyStats(period: LeaderboardPeriod, enabled = true): MyStats {
  const { account, loading: authLoading } = useAuth()
  const name = normalizePlayerName(usePlayerName())
  const key = account ? `${account.id}:${name}:${period}` : ''
  const cached = key ? cache.get(key) : undefined
  const [state, setState] = useState<MyStats>(() =>
    cached ? { loading: false, error: false, data: cached.body } : { loading: true, error: false, data: null },
  )

  useEffect(() => {
    if (!enabled) return
    if (!key) {
      setState({ loading: authLoading, error: false, data: null })
      return
    }
    const have = cache.get(key)
    if (have) {
      setState({ loading: false, error: false, data: have.body })
      if (Date.now() - have.at < FRESH_MS) return
    } else {
      setState({ loading: true, error: false, data: null })
    }
    let cancelled = false
    fetchMyStats(period, name || undefined)
      .then((body) => {
        cache.set(key, { at: Date.now(), body })
        if (!cancelled) setState({ loading: false, error: false, data: body })
      })
      .catch(() => {
        if (!cancelled) setState((prev) => ({ loading: false, error: !prev.data, data: prev.data }))
      })
    return () => {
      cancelled = true
    }
  }, [key, period, name, enabled, authLoading])

  return state
}
