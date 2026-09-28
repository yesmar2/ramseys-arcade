import { isGameListed } from '../data/games'
import { TODAY_FROM } from '../games/halffull/daily'
import { currentRoute, homeHref, navigate, ROUTE_EVENT } from '../hooks/useHashRoute'
import { AUTH_EVENT, getSessionToken } from './auth'
import { api, ApiError, type LeaderboardGame } from './leaderboard'
import { formatLeaderboardScore } from './leaderboardFormat'

/*
 * The Today set: the day's dailies on one punch card (components/TodayCard.tsx, on the home page), and a
 * streak of days kept, shown in the header too (components/TodayChip.tsx). The dailies are Ace Chase's
 * Today's Hole, Hot Lap's Today's Track and Find the Bug's Today's Wanted, and Half Full's Today's Pour
 * from the day it joins (TODAY_DAILIES). Any three of a day's live dailies keep the streak; with more
 * than three live, punching every one is a Full ticket. The Daily, the One Shot and the bug hunt are
 * bonus punches that don't count.
 *
 * The API keeps the streak for a signed-in account (GET /today, its today.ts), and settles its rewards
 * when asked. This module holds the API's word and asks again whenever something may have changed it:
 * a daily finished, tickets paid, a page changed, the tab come back. The card also knows what this
 * device has done today, so it punches at once and works signed out.
 */

export type TodayKey = 'hole' | 'track' | 'wanted' | 'pour'

/** One of the Today set's dailies. */
export type TodayDaily = {
  key: TodayKey
  slug: LeaderboardGame
  /** Its short name: a phone's punch, and a rivals column. */
  label: string
  /** Its line in the day's share. */
  emoji: string
  /** Which way a result is better: fewer tries on the hole, a higher board score on the rest. */
  better: 'lower' | 'higher'
  /** The first day it's on the ticket, YYYY-MM-DD: '' for from the start, null for not yet (as the API's). */
  from: string | null
}

/**
 * The dailies, in the ticket's order, as the API's TODAY_DAILIES has them. The first three have been on
 * every day, so every day before Today's Pour joins is judged as it always was: all three needed.
 */
export const TODAY_DAILIES: readonly TodayDaily[] = [
  { key: 'hole', slug: 'acechase', label: 'Hole', emoji: '⛳', better: 'lower', from: '' },
  { key: 'track', slug: 'hotlap', label: 'Track', emoji: '🏎️', better: 'higher', from: '' },
  { key: 'wanted', slug: 'findbug', label: 'Bugs', emoji: '🐞', better: 'higher', from: '' },
  { key: 'pour', slug: 'halffull', label: 'Pour', emoji: '🥛', better: 'higher', from: TODAY_FROM },
]

/** Any this many of a day's live dailies keep the streak (the API's TODAY_KEEP). */
export const TODAY_KEEP = 3

export type TodayServer = {
  /** The boards' day, YYYY-MM-DD. */
  day: string
  /** Whether each is done today. An API from before Today's Pour leaves `pour` out. */
  done: Record<Exclude<TodayKey, 'pour'>, boolean> & { pour?: boolean }
  /** Today's results as the boards keep them: tries, and board scores for the lap, the run and the pour. */
  results: {
    hole: { tries: number } | null
    track: { score: number } | null
    wanted: { score: number } | null
    pour?: { score: number } | null
  }
  streak: { current: number; best: number }
  /** The last seven days, oldest first, ending today: kept, and a Full ticket (left out by an older API). */
  week: { day: string; kept: boolean; full?: boolean }[]
  /*
   * Today's rule, as the API has it: the live dailies, how many keep the streak, how many are live, and
   * whether today is a Full ticket. An older API leaves them out; todayRule works them out instead.
   */
  live?: TodayKey[]
  need?: number
  count?: number
  full?: boolean
}

/**
 * A day's live dailies: those on the ticket by then whose game is listed, and, when the API has the day,
 * only those it counts too.
 */
export function liveDailies(day: string, server?: Pick<TodayServer, 'day' | 'live'> | null): TodayDaily[] {
  const told = server?.day === day ? server.live : undefined
  return TODAY_DAILIES.filter((d) => d.from != null && d.from <= day && isGameListed(d.slug) && (!told || told.includes(d.key)))
}

/** How many of a day's live dailies keep the streak, and how many there are. */
export function todayRule(liveCount: number): { need: number; count: number } {
  return { need: Math.min(TODAY_KEEP, liveCount), count: liveCount }
}

/** Whether a day with `done` of its live dailies punched is kept, and whether it's a Full ticket. */
export function dayMarks(done: number, rule: { need: number; count: number }): { kept: boolean; full: boolean } {
  return { kept: rule.count > 0 && done >= rule.need, full: rule.count > TODAY_KEEP && done >= rule.count }
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

/** Things that may move the card along: a hole solved, a day's bugs found or glasses poured, tickets paid for a lap. */
const NUDGES = ['skermix-acechase-daily', 'skermix-findbug-daily', 'skermix-halffull-daily', 'arcade-tickets', ROUTE_EVENT, AUTH_EVENT] as const
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

/** A daily's line in the share while it's still to do. */
const STILL: Record<TodayKey, string> = {
  hole: 'still to play',
  track: 'still to drive',
  wanted: 'still to find',
  pour: 'still to pour',
}

/**
 * The day's share, one line for each live daily, and the streak: results only, nothing that gives a day
 * away. A Full ticket says so.
 */
export function todayShareText(opts: {
  day: string
  lines: readonly { key: TodayKey; text: string | null }[]
  streak: number
  full: boolean
}): string {
  const [y, m, d] = opts.day.split('-').map(Number)
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const lines = [`Blipka · Today · ${date}`]
  for (const { key, text } of opts.lines) {
    const daily = TODAY_DAILIES.find((t) => t.key === key)
    if (daily) lines.push(`${daily.emoji} ${text ?? STILL[key]}`)
  }
  if (opts.streak > 0) lines.push(`🔥 Day ${opts.streak}`)
  if (opts.full) lines.push('⭐ Full ticket')
  return lines.join('\n')
}

/* ---------- rivals: friends, or a group, on today's dailies ---------- */

export type TodayRival = {
  name: string
  me: boolean
  /**
   * Tries on today's hole, the best lap's board score, the bug run's board score and the pour's; null if
   * not yet. An API from before Today's Pour leaves `pour` out.
   */
  hole: number | null
  track: number | null
  wanted: number | null
  pour?: number | null
  streak: number
  avatarId: string
}

export type TodayRivals = {
  day: string
  scope: { kind: 'friends' } | { kind: 'group'; id: string; name: string }
  rivals: TodayRival[]
  groups: { id: string; name: string }[]
}

const RIVALS_KEY = 'skermix-today-rivals'
/** A rivals table is asked again at most this often, unless the player's own day moved. */
const RIVALS_FRESH_MS = 20_000

/** Whose day the table shows: a group's id, or null for friends. This device remembers the pick. */
export function rivalsScope(): string | null {
  try {
    return localStorage.getItem(RIVALS_KEY) || null
  } catch {
    return null
  }
}

export function setRivalsScope(group: string | null) {
  try {
    if (group) localStorage.setItem(RIVALS_KEY, group)
    else localStorage.removeItem(RIVALS_KEY)
  } catch {
    /* storage may be off; the pick lasts the visit */
  }
}

const rivalsHeld = new Map<string, { at: number; value: TodayRivals }>()

/** Friends' (or a group's) day on the dailies, from the API; null signed out. */
export async function fetchRivals(group: string | null, force = false): Promise<TodayRivals | null> {
  if (!getSessionToken()) return null
  const key = group ?? 'friends'
  const hit = rivalsHeld.get(key)
  if (!force && hit && Date.now() - hit.at < RIVALS_FRESH_MS) return hit.value
  try {
    const value = await api<TodayRivals>(`/today/rivals${group ? `?group=${encodeURIComponent(group)}` : ''}`)
    rivalsHeld.set(key, { at: Date.now(), value })
    return value
  } catch (err) {
    // A group left or gone: back to friends.
    if (group && err instanceof ApiError && (err.status === 403 || err.status === 404)) {
      setRivalsScope(null)
      return fetchRivals(null, force)
    }
    return hit?.value ?? null
  }
}

/** A result on one of the dailies, in words: "3 tries", a lap, a run's time, a pour. */
export function rivalWords(key: TodayKey, value: number): string {
  if (key === 'hole') return `${value} ${value === 1 ? 'try' : 'tries'}`
  const daily = TODAY_DAILIES.find((d) => d.key === key)
  return formatLeaderboardScore(daily?.slug ?? '', value)
}

/** A player's result on one of the dailies, or null if not yet. */
export function rivalResult(r: TodayRival, key: TodayKey): number | null {
  return r[key] ?? null
}

/** Which way is better on each (TODAY_DAILIES): fewer tries on the hole, a higher board score on the rest. */
export function betterFirst(key: TodayKey): (a: number, b: number) => number {
  const lower = TODAY_DAILIES.find((d) => d.key === key)?.better === 'lower'
  return lower ? (a, b) => a - b : (a, b) => b - a
}

/** Where the player stands among those who've done one of the dailies, or who leads if they haven't. */
export function rivalStanding(
  rivals: readonly TodayRival[],
  key: TodayKey,
): { place: number; field: number } | { leader: TodayRival } | null {
  const done = rivals.filter((r) => rivalResult(r, key) != null)
  const others = rivals.filter((r) => !r.me)
  if (!others.length || !done.length) return null
  const order = betterFirst(key)
  const me = rivals.find((r) => r.me)
  const mine = me ? rivalResult(me, key) : null
  if (mine == null) {
    const leader = [...done].sort((a, b) => order(rivalResult(a, key)!, rivalResult(b, key)!))[0]
    return leader ? { leader } : null
  }
  if (done.length < 2) return null
  const place = 1 + done.filter((r) => !r.me && order(rivalResult(r, key)!, mine) < 0).length
  return { place, field: done.length }
}

