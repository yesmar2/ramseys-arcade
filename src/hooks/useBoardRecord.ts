import { useEffect, useState } from 'react'
import { fetchTopScore } from '../lib/leaderboard'

/** #1 all-time score for a game (house or player). */
export function useBoardRecord(slug: string): number {
  const [top, setTop] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetchTopScore(slug)
      .then((score) => {
        if (!cancelled) setTop(score)
      })
      .catch(() => {
        if (!cancelled) setTop(0)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  return top
}
