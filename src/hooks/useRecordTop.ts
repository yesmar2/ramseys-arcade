import { useEffect, useState } from 'react'
import { fetchGameRecords } from '../lib/records'
import type { LeaderboardEntry } from '../lib/leaderboard'

/**
 * #1 all-time entry for one record book, or null while it loads or if nobody
 * has set it yet.
 *
 * The sibling of `useBoardRecord`, which answers the same question for a score
 * board. A game whose headline board rewards endurance can put a record that
 * rewards skill beside it, so the first screen offers both kinds of goal.
 */
export function useRecordTop(slug: string, recordId: string | null): LeaderboardEntry | null {
  const [top, setTop] = useState<LeaderboardEntry | null>(null)

  useEffect(() => {
    if (!recordId) {
      setTop(null)
      return
    }
    let cancelled = false
    fetchGameRecords(slug)
      .then((data) => {
        if (cancelled) return
        setTop(data.records.find((row) => row.id === recordId)?.top ?? null)
      })
      .catch(() => {
        if (!cancelled) setTop(null)
      })
    return () => {
      cancelled = true
    }
  }, [slug, recordId])

  return top
}
