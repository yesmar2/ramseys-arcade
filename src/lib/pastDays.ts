import { useEffect, useReducer, useState } from 'react'
import { fetchTodayMonth, subscribeToday, todayServer, type TodayServerDay } from './today'

/*
 * The Dailies page's past days (pages/TodayPage.tsx, components/DayStrip.tsx, DayPicker.tsx and
 * PastDayTicket.tsx): what each day was for the account, as the API's days have them (GET /today's last
 * five weeks, and GET /today/days a month at a time), and the months the page can step through.
 */

/** A day as the strip and the calendar mark it: a Full ticket, kept, played but not kept, or nothing done. */
export type DayMark = 'full' | 'kept' | 'played' | 'none'

export function markOf(d: TodayServerDay): DayMark {
  if (d.full) return 'full'
  if (d.kept) return 'kept'
  return d.done && d.done.length > 0 ? 'played' : 'none'
}

/** "3 of 4": a day's dailies done, of those on its card; null from an API that doesn't say. */
export function doneOf(d: TodayServerDay): { done: number; of: number } | null {
  return d.done && d.live ? { done: d.done.length, of: d.live.length } : null
}

/** YYYY-MM of a YYYY-MM-DD. */
export const monthOf = (day: string) => day.slice(0, 7)

/** The month `n` months after `month` (before, for a negative `n`), YYYY-MM. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y!, m! - 1 + n, 1))
  return d.toISOString().slice(0, 7)
}

/** "September 2026". */
export function monthWords(month: string): string {
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** "Sep". */
export function monthShort(month: string): string {
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
}

/**
 * The account's days the page knows, by day: GET /today's last five weeks, and each month asked for
 * (`months`), newest word winning. Empty signed out. Asks again as today's moves.
 */
export function useAccountDays(signedIn: boolean, months: readonly string[]): Map<string, TodayServerDay> {
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  const [held, setHeld] = useState<Record<string, TodayServerDay[]>>({})
  useEffect(() => subscribeToday(refresh), [])
  const key = months.join(',')
  useEffect(() => {
    if (!signedIn) return
    let live = true
    for (const month of key ? key.split(',') : []) {
      void fetchTodayMonth(month).then((reply) => {
        if (live && reply) setHeld((h) => ({ ...h, [month]: reply.days }))
      })
    }
    return () => {
      live = false
    }
  }, [signedIn, key])
  const known = new Map<string, TodayServerDay>()
  if (!signedIn) return known
  for (const month of months) for (const d of held[month] ?? []) known.set(d.day, d)
  for (const d of todayServer()?.days ?? todayServer()?.week ?? []) known.set(d.day, d)
  return known
}

/** The streak as it stood at the end of `day`: the kept days in a row up to it, as far as the page knows them. */
export function streakThrough(day: string, known: ReadonlyMap<string, TodayServerDay>, dayBefore: (d: string) => string): number {
  let n = 0
  for (let d = day; known.get(d)?.kept; d = dayBefore(d)) n++
  return n
}
