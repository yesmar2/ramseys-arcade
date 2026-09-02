import { useEffect, useState } from 'react'
import { fetchTrophySummary, type TrophySummary } from '../lib/trophies'

const empty: TrophySummary = { total: 0, podium: 0, topTen: 0 }

export function useTrophySummary(name: string) {
  const [summary, setSummary] = useState<TrophySummary>(empty)

  useEffect(() => {
    if (!name) {
      setSummary(empty)
      return
    }
    let cancelled = false
    void fetchTrophySummary(name).then((next) => {
      if (!cancelled) setSummary(next)
    })
    return () => {
      cancelled = true
    }
  }, [name])

  return summary
}
