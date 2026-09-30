import { useCallback, useEffect, useState } from 'react'
import { api } from './leaderboard'

/*
 * A daily game's days as the API has them (GET /leaderboards/:game/days): each day's runs and players,
 * who was 1st, and your own result and place that day. The past tab of a daily's page (DailyPastTab)
 * shows them as "On its day" beside each past course; the days themselves come from the game's own plan.
 */

/** A day of a daily game, as the API has it: its runs and players, its 1st, and your result and place. */
export type ArchiveDay = {
  day: string
  runs: number
  players: number
  top: { name: string; score: number; avatarId?: string }
  /**
   * `place` is null on a day before the game's days counted (the API's DAILY_SINCE: Ace Chase's holes #1
   * and #2): the result is there, with no place to go with it.
   */
  you: { score: number; place: number | null } | null
}

/** A game's days, or null while they're asked; `failed` when asking didn't work, and `retry` asks again. */
export type DailyDays = { days: ArchiveDay[] | null; failed: boolean; retry: () => void }

const HOLD_MS = 60_000
const held = new Map<string, { at: number; days: ArchiveDay[] }>()

/** A daily game's days, with `name`'s results (none for no name), kept a minute. */
export function useDailyDays(slug: string, name: string): DailyDays {
  const key = `${slug}|${name}`
  const [asks, setAsks] = useState(0)
  const [answer, setAnswer] = useState<{ key: string; days: ArchiveDay[] | null; failed: boolean } | null>(() => {
    const hit = held.get(key)
    return hit ? { key, days: hit.days, failed: false } : null
  })
  useEffect(() => {
    const hit = held.get(key)
    if (hit && Date.now() - hit.at < HOLD_MS) return
    let live = true
    api<{ days: ArchiveDay[] }>(`/leaderboards/${encodeURIComponent(slug)}/days${name ? `?name=${encodeURIComponent(name)}` : ''}`)
      .then((reply) => {
        held.set(key, { at: Date.now(), days: reply.days })
        if (live) setAnswer({ key, days: reply.days, failed: false })
      })
      .catch(() => {
        // Days asked a while ago still stand; none at all is a failure to say.
        const kept = held.get(key)?.days ?? null
        if (live) setAnswer({ key, days: kept, failed: kept === null })
      })
    return () => {
      live = false
    }
  }, [key, slug, name, asks])
  const retry = useCallback(() => {
    setAnswer(null)
    setAsks((n) => n + 1)
  }, [])
  if (answer?.key === key) return { days: answer.days, failed: answer.failed, retry }
  return { days: held.get(key)?.days ?? null, failed: false, retry }
}

const dayFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })

/** "Sat, Sep 26": a day, given as YYYY-MM-DD, in words. */
export function archiveDayWords(day: string): string {
  return dayFormat.format(new Date(`${day}T12:00:00Z`))
}

/** The day before a day, both as YYYY-MM-DD. */
export function dayBefore(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! - 1)).toISOString().slice(0, 10)
}
