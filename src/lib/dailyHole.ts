import { dailyHoleDef, dailyNumber, plannedPick, type DailyPick } from '../games/acechase/daily'
import { DAILY_PLAN } from '../games/acechase/dailyPlan'
import type { PathPoint, Shot, ShotEnd } from '../games/acechase/game'
import type { HoleDef, Style } from '../games/acechase/physics'
import { AUTH_EVENT, getSessionToken } from './auth'
import { api } from './leaderboard'

/*
 * Ace Chase's Today's Hole, for the site: which hole it is, what this device has done at it, and what the
 * API says about everyone's.
 *
 * Everyone gets the same hole, picked from the date on the boards' clock, and a new one comes at midnight
 * there. Every try counts, whenever it's played that day: the device keeps them, so closing the page and
 * coming back carries on the count. The first bullseye is the day's result. Signed in, it goes to the API,
 * which keeps one result a day for each account, first one kept; signed out, the device keeps it and
 * hands it over when the player signs in that day.
 */

const TZ = 'America/New_York'
const STORE_KEY = 'skermix-acechase-daily'
export const DAILY_EVENT = 'skermix-acechase-daily'

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const clockFormat = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** The day on the boards' clock, as YYYY-MM-DD. */
export function dailyDay(now = Date.now()): string {
  return dayFormat.format(new Date(now))
}

/** Until midnight on the boards' clock, when the next hole comes. */
export function msUntilNextHole(now = Date.now()): number {
  const [h, m, s] = clockFormat.format(new Date(now)).split(':').map(Number)
  return Math.max(0, (24 * 3600 - (h! * 3600 + m! * 60 + s!)) * 1000)
}

export const PLACE_NAME: Record<Style, string> = { garden: 'a garden', ice: 'an ice rink', moon: 'the Moon' }
export const PLACE_EMOJI: Record<Style, string> = { garden: '⛳', ice: '🥌', moon: '🌙' }

export type TodaysHole = { day: string; n: number; pick: DailyPick; def: HoleDef }

/**
 * A day's hole. From the checked plan; past the end of the plan (it runs months ahead, so only if nobody
 * wrote more), an earlier day's hole comes round again rather than one nobody checked.
 */
export function todaysHole(day = dailyDay()): TodaysHole {
  const n = Math.max(1, dailyNumber(day))
  const pick = DAILY_PLAN[n - 1] ?? DAILY_PLAN[(n - 1) % DAILY_PLAN.length] ?? { ...plannedPick(n), k: 0 }
  return { day, n, pick, def: dailyHoleDef(pick, day) }
}

/* ------------------------------------------------------ this device --- */

export type DailySolved = { tries: number; at: number; pattern: string }

/** Where a day's play stands on this device. */
export type DayProgress = {
  tries: number
  shots: Shot[]
  /** Today's last few paths, so they're still on the green when the player comes back. */
  ghosts: PathPoint[][]
  power: number
  angle: number
  solved?: DailySolved
  /** The API has the result. */
  sent?: boolean
}

type Store = { v: 1; days: Record<string, DayProgress> }

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<Store>) : null
    if (parsed?.v === 1 && parsed.days && typeof parsed.days === 'object') return { v: 1, days: parsed.days }
  } catch {
    // A private window or full storage: today's tries are kept for this visit.
  }
  return { v: 1, days: {} }
}

let store: Store | null = null

function current(): Store {
  if (!store) store = readStore()
  return store
}

function writeStore(next: Store) {
  store = next
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(next))
  } catch {
    // Kept in memory for this visit.
  }
  window.dispatchEvent(new Event(DAILY_EVENT))
}

export function dayProgress(day: string): DayProgress | null {
  return current().days[day] ?? null
}

const round2 = (v: number) => Math.round(v * 100) / 100

/** Keep a day's play: the last fortnight is kept, and only today's paths, rounded to the centimetre. */
export function saveProgress(day: string, progress: DayProgress) {
  const days = { ...current().days, [day]: progress }
  const keep = Object.keys(days).sort().slice(-14)
  const next: Record<string, DayProgress> = {}
  for (const d of keep) {
    const p = days[d]!
    next[d] = {
      ...p,
      shots: p.shots.slice(-30),
      ghosts: d === day ? p.ghosts.slice(-3).map((g) => g.map(([x, y, z]) => [round2(x), round2(y), round2(z)] as PathPoint)) : [],
    }
  }
  writeStore({ v: 1, days: next })
}

/** Days in a row with a bullseye: counting today if it's done, or up to yesterday while it isn't. */
export function deviceStreak(day = dailyDay()): number {
  const days = current().days
  const solved = (d: string) => Boolean(days[d]?.solved)
  let d = solved(day) ? day : previousDay(day)
  let n = 0
  while (solved(d)) {
    n++
    d = previousDay(d)
  }
  return n
}

function previousDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! - 1)).toISOString().slice(0, 10)
}

/* ---------------------------------------------------------- sharing --- */

const END_CODE: Record<ShotEnd, string> = { bull: 'b', inner: 'i', outer: 'o', off: 'x', lost: 'l' }
const CODE_EMOJI: Record<string, string> = { b: '🎯', i: '🟢', o: '🔵', x: '⚪', l: '💧' }

/** A day's tries as letters, one a try: the API keeps them, and the share line draws them. */
export function patternOf(shots: readonly Shot[]): string {
  return shots.map((s) => END_CODE[s.end] ?? 'x').join('')
}

/** What goes out when a player shares their day: no numbers, so it gives nothing away. */
export function shareText(hole: TodaysHole, tries: number, pattern: string): string {
  const marks = [...pattern].map((c) => CODE_EMOJI[c] ?? '⚪')
  const shown = marks.length > 24 ? [...marks.slice(0, 23), '…', marks[marks.length - 1]!] : marks
  return [
    `Ace Chase · Today's Hole #${hole.n} ${PLACE_EMOJI[hole.pick.style]}`,
    `${hole.def.name}: bullseye in ${tries} ${tries === 1 ? 'try' : 'tries'}`,
    shown.join(''),
  ].join('\n')
}

/* ------------------------------------------------------------ the API --- */

export type DailyEntry = { name: string; tries: number; at: number; avatarId?: string }

/** What the API says about a day: how everyone did, and, signed in, how you did. */
export type DailyServer = {
  day: string
  /** Players with a bullseye today. */
  solved: number
  /** Their tries on average, once there are some. */
  average: number | null
  /** How many took 1, 2 … 9 tries, and 10 or more. */
  spread: number[]
  /** Fewest tries, and first to it. */
  top: DailyEntry[]
  you?: { tries: number | null; place: number | null; streak: number }
}

let server: DailyServer | null = null

export function dailyServer(): DailyServer | null {
  return server
}

function apply(reply: DailyServer, token: string | null) {
  server = token === getSessionToken() ? reply : { ...reply, you: undefined }
  window.dispatchEvent(new Event(DAILY_EVENT))
}

const SYNC_EVERY_MS = 60_000
let syncedAt = 0
let syncing: Promise<void> | null = null

/**
 * Ask the API how today stands, and signed in, send up a result this device has and the API doesn't:
 * today's, or yesterday's if it came in just before midnight. Pages call this freely: once a minute at most.
 */
export function syncDaily(force = false): Promise<void> {
  if (syncing) return syncing
  if (!force && Date.now() - syncedAt < SYNC_EVERY_MS) return Promise.resolve()
  syncedAt = Date.now()
  syncing = (async () => {
    const token = getSessionToken()
    try {
      apply(await api<DailyServer>('/daily-hole'), token)
      if (!token) return
      const today = dailyDay()
      for (const day of [previousDay(today), today]) {
        const p = dayProgress(day)
        if (!p?.solved || p.sent) continue
        await sendResult(day, p.solved, token)
      }
    } catch {
      // Today's Hole plays without the API; it catches up next time.
    }
  })().finally(() => {
    syncing = null
  })
  return syncing
}

async function sendResult(day: string, solved: DailySolved, token: string) {
  const reply = await api<DailyServer>('/daily-hole/results', {
    method: 'POST',
    body: JSON.stringify({ day, tries: solved.tries, pattern: solved.pattern }),
  })
  const p = dayProgress(day)
  if (p) saveProgress(day, { ...p, sent: true })
  if (reply.day === dailyDay()) apply(reply, token)
}

/** Today's bullseye: kept here, and signed in, sent to the API. */
export function recordSolved(day: string, solved: DailySolved) {
  const p = dayProgress(day)
  if (!p || p.solved) return
  saveProgress(day, { ...p, solved, sent: false })
  const token = getSessionToken()
  if (token) void sendResult(day, solved, token).catch(() => {})
}

/** Listen for changes here or in another tab, for what the API says, and for signing in or out. */
export function subscribeDaily(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORE_KEY) return
    store = null
    onChange()
  }
  const onAuth = () => {
    if (server) server = { ...server, you: undefined }
    onChange()
    void syncDaily(true)
  }
  window.addEventListener(DAILY_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  window.addEventListener(AUTH_EVENT, onAuth)
  return () => {
    window.removeEventListener(DAILY_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(AUTH_EVENT, onAuth)
  }
}
