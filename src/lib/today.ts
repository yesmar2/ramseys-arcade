import { isGameListed } from '../data/games'
import { TODAY_FROM } from '../games/halffull/daily'
import { TODAY_FROM as CAVE_FROM } from '../games/lander/daily'
import { TODAY_FROM as COURSE_FROM } from '../games/marblerun/daily'
import { ROUTE_EVENT } from '../hooks/useHashRoute'
import { sessionFingerprint, subscribeAccountId } from './auth'
import { api, ApiError, type LeaderboardGame } from './leaderboard'
import { formatLeaderboardScore } from './leaderboardFormat'

/*
 * The Today set, which players know as the Dailies (since 2026-09-30): the day's dailies on one punch card
 * (components/TodayCard.tsx, on the Dailies page at /dailies, pages/TodayPage.tsx, with a row of it on the
 * home page, HomeToday.tsx), and a streak of days kept, shown in the header too (components/TodayChip.tsx,
 * the way to the page). The dailies are Ace Chase's Today's Hole, Hot Lap's Today's Track and Find the
 * Bug's Today's Wanted, and Half Full's Today's Pour, Marble Run's Today's Course and Lander's Today's Cave from
 * the days they join (TODAY_DAILIES). Any three of a day's live dailies keep the streak; with more than three live, punching
 * every one is a Full ticket. Today's event, the One Shot and the bug hunt are bonus punches that don't
 * count.
 *
 * The API keeps the streak for a signed-in account (GET /today, its today.ts), and settles its rewards
 * when asked. This module holds the API's word and asks again whenever something may have changed it:
 * a daily finished, tickets paid, a page changed, the tab come back. The word is the session's it was
 * asked for, and only ever shown to that session: another account signed in on this device (or in
 * another tab) is asked for its own at once. The card also knows what this device has done today, so it
 * punches at once and works signed out.
 */

export type TodayKey = 'hole' | 'track' | 'wanted' | 'pour' | 'course' | 'cave'

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
  { key: 'course', slug: 'marblerun', label: 'Marble', emoji: '🔮', better: 'higher', from: COURSE_FROM },
  { key: 'cave', slug: 'lander', label: 'Cave', emoji: '🚀', better: 'higher', from: CAVE_FROM },
]

/** Any this many of a day's live dailies keep the streak (the API's TODAY_KEEP). */
export const TODAY_KEEP = 3

/**
 * One of the account's days, as the API's TodayDay has it: kept, a Full ticket, and (left out by an older
 * API) the dailies on that day's card and which of them were done, in the card's order.
 */
export type TodayServerDay = { day: string; kept: boolean; full?: boolean; live?: TodayKey[]; done?: TodayKey[] }

/** The first day there were Dailies to keep (the API's TODAY_SINCE), for when the API hasn't said: signed out. */
export const TODAY_SINCE_FALLBACK = '2026-09-27'

export type TodayServer = {
  /** The boards' day, YYYY-MM-DD. */
  day: string
  /** Whether each is done today. An API from before Today's Pour, Today's Course or Today's Cave leaves them out. */
  done: Record<Exclude<TodayKey, 'pour' | 'course' | 'cave'>, boolean> & { pour?: boolean; course?: boolean; cave?: boolean }
  /** Today's results as the boards keep them: tries, and board scores for the lap, the bug run, the pour, the marble's run and the ship's. */
  results: {
    hole: { tries: number } | null
    track: { score: number } | null
    wanted: { score: number } | null
    pour?: { score: number } | null
    course?: { score: number } | null
    cave?: { score: number } | null
  }
  streak: { current: number; best: number }
  /** The last seven days, oldest first, ending today: kept, and a Full ticket (left out by an older API). */
  week: TodayServerDay[]
  /**
   * The last five weeks (35 days), oldest first, ending today, as `week` has them: the Today page's
   * calendar. An older API leaves them out, and the calendar shows the week's seven.
   */
  days?: TodayServerDay[]
  /**
   * The first day the Today set could be kept, YYYY-MM-DD: the calendar leaves the days before it blank.
   * An older API leaves it out.
   */
  since?: string
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
  { day: 7, prize: 'The Dailies pin for your badge' },
  { day: 14, prize: '25 tickets' },
  { day: 30, prize: 'The gold badge finish' },
  { day: 100, prize: 'The “Every Day” title' },
]

/** The API's word changed. */
export const TODAY_EVENT = 'skermix:today'

/** Things that may move the card along: a hole solved, a day's bugs found or glasses poured, tickets paid for a lap or a run. */
const NUDGES = ['skermix-acechase-daily', 'skermix-findbug-daily', 'skermix-halffull-daily', 'arcade-tickets', ROUTE_EVENT] as const
/** Asked again at most this often, however many nudges come. */
const FRESH_MS = 4000

let held: TodayServer | null = null
/** The session `held` was asked for (auth.ts's sessionFingerprint): it's that session's day, and no one else's. */
let heldFor: number | null = null
let heldAt = 0
/** The question out now, and the session it went out for. */
let asking: { for: number; reply: Promise<TodayServer | null> } | null = null

export function todayServer(): TodayServer | null {
  return held && heldFor === sessionFingerprint() ? held : null
}

/** The signed-in account's Today, from the API, or null signed out. */
export function fetchToday(force = false): Promise<TodayServer | null> {
  const session = sessionFingerprint()
  // Another session's day (signed out now, or signed in as someone else) goes at once, and is said to go.
  if (held && heldFor !== session) {
    held = null
    heldFor = null
    window.dispatchEvent(new Event(TODAY_EVENT))
  }
  if (session == null) return Promise.resolve(null)
  if (asking?.for === session) return asking.reply
  if (!force && held && Date.now() - heldAt < FRESH_MS) return Promise.resolve(held)
  const reply = api<TodayServer>('/today')
    .then((state) => {
      // Signed in as someone else while it was asked: it isn't theirs to see.
      if (sessionFingerprint() !== session) return null
      held = state
      heldFor = session
      heldAt = Date.now()
      window.dispatchEvent(new Event(TODAY_EVENT))
      return state
    })
    .catch(() => todayServer())
    .finally(() => {
      if (asking?.reply === reply) asking = null
    })
  asking = { for: session, reply }
  return reply
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
// Signed in, out, or as someone else, here or in another tab: the day is asked for again at once.
const onAccount = () => void fetchToday(true)
let stopAccount: (() => void) | null = null

/** Keep the API's word fresh while anything shows it. */
export function subscribeToday(onChange: () => void): () => void {
  window.addEventListener(TODAY_EVENT, onChange)
  if (listening++ === 0) {
    for (const name of NUDGES) window.addEventListener(name, nudge)
    document.addEventListener('visibilitychange', onVisible)
    stopAccount = subscribeAccountId(onAccount)
  }
  void fetchToday()
  return () => {
    window.removeEventListener(TODAY_EVENT, onChange)
    if (--listening === 0) {
      for (const name of NUDGES) window.removeEventListener(name, nudge)
      document.removeEventListener('visibilitychange', onVisible)
      stopAccount?.()
      stopAccount = null
      window.clearTimeout(nudgeTimer)
    }
  }
}

/** A month of the account's days (GET /today/days?month=YYYY-MM): from the first day of Dailies to today. */
export type TodayMonth = { month: string; since: string; days: TodayServerDay[] }

/** Months asked, a little while each: today's month moves on as the day's dailies are played. */
const MONTH_FRESH_MS = 30_000
const months = new Map<string, { for: number; at: number; reply: Promise<TodayMonth | null> }>()

/**
 * A month of the signed-in account's days, for the Dailies page's calendar going back a month at a time.
 * Null signed out, or when it couldn't be had. Kept for the session it was asked for only.
 */
export function fetchTodayMonth(month: string): Promise<TodayMonth | null> {
  const session = sessionFingerprint()
  if (session == null) return Promise.resolve(null)
  const hit = months.get(month)
  if (hit && hit.for === session && Date.now() - hit.at < MONTH_FRESH_MS) return hit.reply
  const reply = api<TodayMonth>(`/today/days?month=${encodeURIComponent(month)}`)
    .then((m) => (sessionFingerprint() === session ? m : null))
    .catch(() => {
      months.delete(month)
      return null
    })
  months.set(month, { for: session, at: Date.now(), reply })
  return reply
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
  course: 'still to roll',
  cave: 'still to fly',
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
  const lines = [`Blipka · Dailies · ${date}`]
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
   * Tries on today's hole, the best lap's board score, the bug run's board score, the pour's, the best marble
   * run's and the best cave run's; null if not yet. An API from before Today's Pour, Course or Cave leaves them out.
   */
  hole: number | null
  track: number | null
  wanted: number | null
  pour?: number | null
  course?: number | null
  cave?: number | null
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

/** Tables kept by the session they were asked for as well as whose day they show: one account's is never another's. */
const rivalsHeld = new Map<string, { at: number; value: TodayRivals }>()

/** Friends' (or a group's) day on the dailies, from the API; null signed out. */
export async function fetchRivals(group: string | null, force = false): Promise<TodayRivals | null> {
  const session = sessionFingerprint()
  if (session == null) return null
  const key = `${session}:${group ?? 'friends'}`
  const hit = rivalsHeld.get(key)
  if (!force && hit && Date.now() - hit.at < RIVALS_FRESH_MS) return hit.value
  try {
    const value = await api<TodayRivals>(`/today/rivals${group ? `?group=${encodeURIComponent(group)}` : ''}`)
    // Signed in as someone else while it was asked: it isn't theirs to see.
    if (sessionFingerprint() !== session) return null
    rivalsHeld.set(key, { at: Date.now(), value })
    return value
  } catch (err) {
    if (sessionFingerprint() !== session) return null
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

