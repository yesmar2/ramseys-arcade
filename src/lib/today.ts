import { currentRoute, homeHref, navigate, ROUTE_EVENT } from '../hooks/useHashRoute'
import { AUTH_EVENT, getSessionToken } from './auth'
import { api } from './leaderboard'

/*
 * The Today set: the day's three dailies on one punch card (components/TodayCard.tsx, on the home page),
 * and a streak of days all three were done, shown in the header too (components/TodayChip.tsx). The
 * three are Ace Chase's Today's Hole, Hot Lap's Today's Track and Find the Bug's Today's Wanted; the
 * Daily, the One Shot and the bug hunt are bonus punches that don't count.
 *
 * The API keeps the streak for a signed-in account (GET /today, its today.ts), and settles its rewards
 * when asked. This module holds the API's word and asks again whenever something may have changed it:
 * a daily finished, tickets paid, a page changed, the tab come back. The card also knows what this
 * device has done today, so it punches at once and works signed out.
 */

export type TodayKey = 'hole' | 'track' | 'wanted'

export type TodayServer = {
  /** The boards' day, YYYY-MM-DD. */
  day: string
  done: Record<TodayKey, boolean>
  /** Today's results as the boards keep them: tries, and board scores for the lap and the run. */
  results: { hole: { tries: number } | null; track: { score: number } | null; wanted: { score: number } | null }
  streak: { current: number; best: number }
  /** The last seven days, oldest first, ending today. */
  week: { day: string; kept: boolean }[]
}

/** What a streak earns, once an account (the API's TODAY_MILESTONES): looks and tickets, never score. */
export const TODAY_MILESTONES: readonly { day: number; prize: string }[] = [
  { day: 3, prize: '10 tickets' },
  { day: 7, prize: 'The Today pin for your badge' },
  { day: 14, prize: '25 tickets' },
  { day: 30, prize: 'The gold badge finish' },
  { day: 100, prize: 'The “Every Day” title' },
]

/** The API's word changed. */
export const TODAY_EVENT = 'skermix:today'

/** Things that may move the card along: a hole solved, a day's bugs found, tickets paid for a lap. */
const NUDGES = ['skermix-acechase-daily', 'skermix-findbug-daily', 'arcade-tickets', ROUTE_EVENT, AUTH_EVENT] as const
/** Asked again at most this often, however many nudges come. */
const FRESH_MS = 4000

let held: TodayServer | null = null
let heldAt = 0
let asking: Promise<TodayServer | null> | null = null

export function todayServer(): TodayServer | null {
  return held
}

/** The signed-in account's Today, from the API, or null signed out. */
export function fetchToday(force = false): Promise<TodayServer | null> {
  if (!getSessionToken()) {
    if (held) {
      held = null
      window.dispatchEvent(new Event(TODAY_EVENT))
    }
    return Promise.resolve(null)
  }
  if (asking) return asking
  if (!force && held && Date.now() - heldAt < FRESH_MS) return Promise.resolve(held)
  asking = api<TodayServer>('/today')
    .then((state) => {
      held = state
      heldAt = Date.now()
      window.dispatchEvent(new Event(TODAY_EVENT))
      return state
    })
    .catch(() => held)
    .finally(() => {
      asking = null
    })
  return asking
}

let listening = 0
let nudgeTimer = 0
const nudge = () => {
  window.clearTimeout(nudgeTimer)
  // A beat after, so a save has reached the API before it's asked.
  nudgeTimer = window.setTimeout(() => void fetchToday(), 600)
}
const onVisible = () => {
  if (document.visibilityState === 'visible') nudge()
}

/** Keep the API's word fresh while anything shows it. */
export function subscribeToday(onChange: () => void): () => void {
  window.addEventListener(TODAY_EVENT, onChange)
  if (listening++ === 0) {
    for (const name of NUDGES) window.addEventListener(name, nudge)
    document.addEventListener('visibilitychange', onVisible)
  }
  void fetchToday()
  return () => {
    window.removeEventListener(TODAY_EVENT, onChange)
    if (--listening === 0) {
      for (const name of NUDGES) window.removeEventListener(name, nudge)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearTimeout(nudgeTimer)
    }
  }
}

/** Where the card is on the home page, as an anchor and in the address (?focus=today). */
export const TODAY_ANCHOR = 'today'

export function todayHref() {
  return `${homeHref()}?focus=${TODAY_ANCHOR}`
}

/** Bring the card into view on the home page, or go there and have it brought into view. */
export function goToToday(e?: { preventDefault(): void }) {
  const card = currentRoute().name === 'home' ? document.getElementById(TODAY_ANCHOR) : null
  e?.preventDefault()
  if (!card) {
    navigate(todayHref())
    return
  }
  card.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
}

/** The milestone a streak is heading for next, or null past the last. */
export function nextMilestone(streak: number): { day: number; prize: string } | null {
  return TODAY_MILESTONES.find((m) => m.day > streak) ?? null
}

/** "3 days to go", "1 day to go". */
export function daysToGo(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'} to go`
}

/** The day's share, one line a daily, and the streak: results only, nothing that gives a day away. */
export function todayShareText(opts: {
  day: string
  hole: string | null
  track: string | null
  wanted: string | null
  streak: number
}): string {
  const [y, m, d] = opts.day.split('-').map(Number)
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const lines = [`Blipka · Today · ${date}`]
  lines.push(`⛳ ${opts.hole ?? 'still to play'}`)
  lines.push(`🏎️ ${opts.track ?? 'still to drive'}`)
  lines.push(`🐞 ${opts.wanted ?? 'still to find'}`)
  if (opts.streak > 0) lines.push(`🔥 Day ${opts.streak}`)
  return lines.join('\n')
}
