import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { playersFromRuns } from '../../lib/gameBoard'
import { getLeaderboard } from '../../lib/leaderboard'
import { adoptBoardResult, dayRun } from './daily'
import { findbugMsFromBoardScore } from './score'

/*
 * Today's Wanted's board, for its cards: how many are on it, who leads, and where you are. Signed in, a
 * result the board already has for you today (from another device) is the day's here too, so this one
 * doesn't offer a first run the API would turn away.
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
  const { signedIn } = useAuth()
  const [board, setBoard] = useState<TodayBoard | null>(null)
  useEffect(() => {
    if (!day) return
    let cancelled = false
    getLeaderboard(SLUG, 'daily', me || undefined, { limit: 100 })
      .then(({ entries, you }) => {
        if (cancelled) return
        const players = playersFromRuns(entries)
        const top = players[0]
        const mine = me ? players.find((p) => p.name === me) : undefined
        const yours = mine ? { place: mine.place, score: mine.best.score } : you ? { place: you.rank, score: you.score } : null
        if (yours && signedIn && !dayRun(day)?.result) adoptBoardResult(day, findbugMsFromBoardScore(yours.score), Date.now())
        setBoard({ count: players.length, leader: top ? { name: top.name, score: top.best.score } : null, you: yours })
      })
      .catch(() => {
        if (!cancelled) setBoard(null)
      })
    return () => {
      cancelled = true
    }
  }, [day, me, again, signedIn])
  return board
}
