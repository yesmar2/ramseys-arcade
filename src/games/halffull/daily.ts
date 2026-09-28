import { judge, summarize, type PourResult } from './game'
import { ROUNDS, type DayPlan } from './plan'

/*
 * Half Full as a daily: new glasses at midnight on the boards' clock (New York), the same for everyone.
 * The day's first run is the result; after it, the day pours again as practice, and so does any past
 * day's.
 *
 * This device keeps each day's first run as it's played, a level a glass, so one left halfway (the tab
 * closed, the phone rung) carries on from the glass it was on, with the pours already locked kept.
 */

const TZ = 'America/New_York'
/** Half Full #1: its board, day points and record book count from this day (the API's HALFFULL_FIRST_DAY). */
export const FIRST_DAY = '2026-09-28'

/**
 * The day Today's Pour joined today's ticket (lib/today.ts), YYYY-MM-DD: Half Full's launch. The same day as
 * the API's halffull/launch.ts HALFFULL_TODAY_FROM (`npm run check:halffull`).
 */
export const TODAY_FROM: string | null = '2026-09-28'

const STORE_KEY = 'skermix-halffull-daily'
const EVENT = 'skermix-halffull-daily'
const KEEP_DAYS = 120

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const clockFormat = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' })
const weekdayFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' })

/** The day on the boards' clock, as YYYY-MM-DD. */
export function pourDay(now = Date.now()): string {
  return dayFormat.format(new Date(now))
}

/**
 * Until midnight on the boards' clock, when the next glasses come. A day the clocks change on is 23 or 25
 * hours long, so the guess from the time of day is checked an hour either way.
 */
export function msUntilNextDay(now = Date.now()): number {
  const [h, m, s] = clockFormat.format(new Date(now)).split(':').map(Number)
  const guess = now + (24 * 3600 - (h! * 3600 + m! * 60 + s!)) * 1000
  const today = pourDay(now)
  for (const at of [guess - 3_600_000, guess, guess + 3_600_000]) {
    if (at > now && pourDay(at) !== today && pourDay(at - 1000) === today) return at - now
  }
  return Math.max(0, guess - now)
}

const utcNoon = (day: string) => Date.parse(`${day}T12:00:00Z`)

export function isDay(day: string | null | undefined): day is string {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  const t = utcNoon(day)
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === day
}

/** Half Full #1 on the first day. Nought or less is a day before it: a preview. */
export function dayNumber(day: string): number {
  return Math.round((utcNoon(day) - utcNoon(FIRST_DAY)) / 86_400_000) + 1
}

/** "#12", or "Preview" for a day before the first. */
export function dayTag(day: string): string {
  const n = dayNumber(day)
  return n >= 1 ? `#${n}` : 'Preview'
}

/** "Sun" */
export function weekdayShort(day: string): string {
  return weekdayFormat.format(new Date(utcNoon(day)))
}

/* ---------- what this device keeps ---------- */

export type DayRun = {
  startedAt: number
  /** The id the API opened the run under, so its save carries it even after a reload. */
  runId?: string
  /** Each locked pour's level, glass by glass (the split's is the first glass's). */
  levels: number[]
  /** Which of them the clock locked. */
  auto: boolean[]
  /**
   * The day's board figure when the board already has this account's pour from another device: the day is
   * done here too, though this device never saw its pours.
   */
  board?: number
}

type Store = Record<string, DayRun>

/** What was last written, for when storage is off: then the day lasts as long as the page. */
let memory: Store = {}

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? (parsed as Store) : {}
  } catch {
    return structuredClone(memory)
  }
}

function writeStore(store: Store) {
  const days = Object.keys(store).sort()
  for (const day of days.slice(0, Math.max(0, days.length - KEEP_DAYS))) delete store[day]
  memory = structuredClone(store)
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store))
  } catch {
    /* storage off: `memory` keeps it for the page */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}

export function dayRun(day: string): DayRun | null {
  const run = readStore()[day]
  return run && Array.isArray(run.levels) ? run : null
}

export function updateDayRun(day: string, change: (run: DayRun | null) => DayRun | null) {
  const store = readStore()
  const next = change(store[day] ?? null)
  if (next) store[day] = next
  else delete store[day]
  writeStore(store)
}

/** Whether the day's pour is done: all five glasses locked here, or poured on another device. */
export function dayDone(run: DayRun | null | undefined): boolean {
  return !!run && (run.levels.length >= ROUNDS || run.board != null)
}

/** The board already has this account's pour today, from another device: it's the day's here too. */
export function adoptBoardResult(day: string, board: number, at: number) {
  updateDayRun(day, (run) => (dayDone(run) ? run : { startedAt: run?.startedAt ?? at, runId: run?.runId, levels: [], auto: [], board }))
}

export function subscribePourDay(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORE_KEY) onChange()
  }
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

/** A kept run's pours, judged again from the day's glasses (a level is all that's kept). */
export function keptResults(plan: DayPlan, run: DayRun | null): PourResult[] {
  if (!run) return []
  return run.levels.slice(0, 5).map((level, round) => judge({ plan, round }, level, run.auto[round] === true))
}

/* ---------- passing it on ---------- */

/**
 * The day's result to send on: no glass named, no level shown, only how it went. From the day Today's Pour
 * joins today's ticket (TODAY_FROM), the link is the day's own, /today/<day>, as the other dailies send: it
 * unfurls into the day's card (scripts/today-cards.mjs) and opens at today's ticket. Before, it's the game's.
 */
export function shareText(plan: DayPlan, results: readonly PourResult[], origin: string): string {
  const sum = summarize(results)
  const link = TODAY_FROM != null && plan.day >= TODAY_FROM ? `${origin}/today/${plan.day}` : `${origin}/games/halffull/play`
  return [
    `Half Full ${dayTag(plan.day)} · ${weekdayShort(plan.day)} · ${plan.label} 🥛`,
    `${sum.scoreText} ${sum.tier}`,
    `${sum.marks.join('')} · Team Half-${sum.team}`,
    `${sum.story} ${link}`,
  ].join('\n')
}
