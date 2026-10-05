import { useEffect, useState } from 'react'
import { useAccountId } from '../../hooks/useAccountId'
import { useAuth } from '../../hooks/useAuth'
import { currentAccountId } from '../../lib/auth'
import { isImpersonating } from '../../lib/impersonate'
import { getPlayerBoard } from '../../lib/leaderboard'
import { adoptBoardResult } from './daily'

/*
 * Today's Wanted's board, for its cards: how many are on it, who leads, and where you are. Signed in, a
 * result the board already has for you today (from another device) is the day's here too, so this one
 * doesn't offer a first run the API would turn away. It's the account's that asked, and theirs alone.
 */

const SLUG = 'findbug'

export type TodayBoard = {
  /** Players on today's board, each at their one run. */
  count: number
  leader: { name: string; score: number } | null
  you: { place: number; score: number } | null
}

/**
 * Today's board and your place on it, asked again when the day, your tag or `again` changes. Null `day`
 * for none at all (Find the Bug played in an event).
 */
export function useTodayBoard(day: string | null, me: string, again: unknown = null): TodayBoard | null {
  // The API is asked whose the session is (useAuth's /auth/me) wherever the board is shown, so it's known
  // even on the play page, where nothing else asks: until it is, no result is adopted and no first run starts.
  useAuth()
  const viewer = useAccountId()
  // With who it was asked for: another account's place is never shown, even while theirs is asked.
  const [held, setHeld] = useState<{ for: string; board: TodayBoard | null }>({ for: '', board: null })
  const asker = `${viewer}|${me}`
  useEffect(() => {
    if (!day) return
    let cancelled = false
    // As players, counted by the API (getPlayerBoard): the leader, how many, and your place among them.
    getPlayerBoard(SLUG, 'daily', me || undefined, { limit: 1, around: 0 })
      .then((b) => {
        if (cancelled) return
        const top = b.entries[0]
        const yours = b.you ? { place: b.you.place, score: b.you.score } : null
        // Kept for the account it was asked for, if it's still the one signed in. Playing as another tag
        // (a dev's stand-in), the board's you isn't the account's own.
        if (yours && typeof viewer === 'string' && currentAccountId() === viewer && !isImpersonating()) {
          adoptBoardResult(day, viewer, yours.score, Date.now())
        }
        setHeld({ for: asker, board: { count: b.total, leader: top ? { name: top.name, score: top.score } : null, you: yours } })
      })
      .catch(() => {
        if (!cancelled) setHeld({ for: asker, board: null })
      })
    return () => {
      cancelled = true
    }
  }, [day, me, again, viewer, asker])
  return held.for === asker ? held.board : null
}
