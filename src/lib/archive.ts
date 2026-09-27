import { useEffect, useState } from 'react'
import { api } from './leaderboard'

/*
 * The archive of a daily game's past days (ArchivePage): each day's hole or track, how many played it and
 * who did best, and your own result. The days themselves come from the game's own plan; this is what the
 * API says about them (GET /leaderboards/:game/days). A day played from the archive is practice, and
 * counts for nothing.
 */

/** A day of a daily game, as the API has it: its runs and players, its best run, and yours. */
export type ArchiveDay = {
  day: string
  runs: number
  players: number
  top: { name: string; score: number; avatarId?: string }
  you: { score: number } | null
}

const HOLD_MS = 60_000
const held = new Map<string, { at: number; days: ArchiveDay[] }>()

/** A daily game's days as the API has them, with `name`'s results, kept a minute. Null while it's asked. */
export function useArchiveDays(slug: string, name: string): ArchiveDay[] | null {
  const key = `${slug}|${name}`
  const [answer, setAnswer] = useState<{ key: string; days: ArchiveDay[] } | null>(() => {
    const hit = held.get(key)
    return hit ? { key, days: hit.days } : null
  })
  useEffect(() => {
    const hit = held.get(key)
    if (hit && Date.now() - hit.at < HOLD_MS) return
    let live = true
    api<{ days: ArchiveDay[] }>(`/leaderboards/${encodeURIComponent(slug)}/days${name ? `?name=${encodeURIComponent(name)}` : ''}`)
      .then((reply) => {
        held.set(key, { at: Date.now(), days: reply.days })
        if (live) setAnswer({ key, days: reply.days })
      })
      .catch(() => {
        if (live) setAnswer({ key, days: [] })
      })
    return () => {
      live = false
    }
  }, [key, slug, name])
  if (answer?.key === key) return answer.days
  return held.get(key)?.days ?? null
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
