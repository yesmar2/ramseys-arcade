import { todayShareHref } from '../../hooks/useHashRoute'
import { claimableRun, ownKey, ownRun, SIGNED_OUT, subscribeViewer, type OwnedRuns, type Viewer } from '../../lib/deviceRuns'
import { judge, summarize, type PourResult } from './game'
import { dayPlan, ROUNDS, type DayPlan } from './plan'
import { judgeLevels } from './score'

/*
 * Half Full as a daily: new glasses at midnight on the boards' clock (New York), the same for everyone.
 * The day's first run is the result; after it, the day pours again as practice, and so does any past
 * day's.
 *
 * This device keeps each day's first run as it's played, a level a glass, so one left halfway (the tab
 * closed, the phone rung) carries on from the glass it was on, with the pours already locked kept. It
 * keeps one a player: each run is stamped with whoever began it (lib/deviceRuns.ts), and is only ever
 * shown and saved as theirs.
 */

const TZ = 'America/New_York'
/** Half Full #1: its board, day points and record book count from this day (the API's HALFFULL_FIRST_DAY). */
export const FIRST_DAY = '2026-09-28'

/**
 * The day Today's Pour joined today's ticket (lib/today.ts), YYYY-MM-DD: Half Full's launch. The same day as
 * the API's halffull/launch.ts HALFFULL_TODAY_FROM (`npm run check:halffull`).
 */
export const TODAY_FROM: string | null = '2026-09-28'

/**
 * Each day's runs, one an owner. A new key, so a bundle from before runs were stamped (still served for a
 * load or two after a deploy) never reads these as its own, nor writes over them.
 */
const STORE_KEY = 'skermix-halffull-daily-2'
/** Where runs were kept before they were stamped, one a day: only read now, as each day's legacy run. */
const LEGACY_KEY = 'skermix-halffull-daily'
/** Said on every change, by the name it always had: lib/today.ts listens for it. */
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

/** Each day's runs, by owner: an account's id, or SIGNED_OUT (lib/deviceRuns.ts). */
type Store = Record<string, OwnedRuns<DayRun>>

/** What was last written, for when storage is off: then the day lasts as long as the page. */
let memory: Store = {}

function isRun(run: unknown): run is DayRun {
  return !!run && typeof run === 'object' && Array.isArray((run as DayRun).levels)
}

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

/** The day's runs, owner by owner (only what really is a run). */
function runsOn(store: Store, day: string): OwnedRuns<DayRun> {
  const out: OwnedRuns<DayRun> = {}
  const runs: unknown = store[day]
  if (runs && typeof runs === 'object') {
    for (const [owner, run] of Object.entries(runs)) if (isRun(run)) out[owner] = run
  }
  return out
}

function keepRuns(store: Store, day: string, runs: OwnedRuns<DayRun>) {
  if (Object.keys(runs).length > 0) store[day] = runs
  else delete store[day]
  writeStore(store)
}

/**
 * The day's run as it was kept before runs were stamped, or null: none, or one taken up here since (found
 * to be an account's own board result), which is kept under its owner now. Nobody's otherwise.
 */
function legacyRun(store: Store, day: string): DayRun | null {
  let parsed: unknown = null
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    parsed = raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
  const run: unknown = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>)[day] : null
  if (!isRun(run)) return null
  const taken = Object.values(runsOn(store, day)).some((r) => r?.startedAt === run.startedAt)
  return taken ? null : run
}

/** A day's runs as the viewer has them on this device (lib/deviceRuns.ts). */
export type ViewerRuns = {
  /** Their own run, or null. */
  own: DayRun | null
  /** Where it's kept: their stamp (an account's id, or SIGNED_OUT); null with no run. */
  owner: string | null
  /** With no run of their own, one played signed out here that they may take up, in the game only; signed in only. */
  claimable: DayRun | null
}

export function viewerRuns(day: string, viewer: Viewer): ViewerRuns {
  const store = readStore()
  const runs = runsOn(store, day)
  const key = ownKey(viewer)
  const own = ownRun(runs, viewer)
  return {
    own,
    owner: own && key !== undefined ? key : null,
    claimable: own ? null : claimableRun(runs, viewer),
  }
}

/** The viewer's own run of the day, or null: all the ticket, the cards and the archive ever show as theirs. */
export function dayRun(day: string, viewer: Viewer): DayRun | null {
  return viewerRuns(day, viewer).own
}

/** Change one owner's run of the day (by its stamp: an account's id, or SIGNED_OUT), and only theirs. */
export function updateDayRun(day: string, owner: string, change: (run: DayRun | null) => DayRun | null) {
  const store = readStore()
  const runs = runsOn(store, day)
  const next = change(runs[owner] ?? null)
  if (next) runs[owner] = next
  else delete runs[owner]
  keepRuns(store, day, runs)
}

/**
 * The id the API opened a run under, come back: onto that run (known by when it began), unless it has one.
 * Whoever's it is by now: one played signed out may have been taken up since.
 */
export function keepRunId(day: string, startedAt: number, runId: string) {
  const store = readStore()
  const runs = runsOn(store, day)
  for (const [owner, run] of Object.entries(runs)) {
    if (!run || run.startedAt !== startedAt || run.runId) continue
    runs[owner] = { ...run, runId }
    keepRuns(store, day, runs)
    return
  }
}

/**
 * Stamp a run as `to`'s: one played signed out, taken up by the account signed in (carried on, or saved as
 * theirs), or one kept before runs were stamped that is exactly an account's own board result. Known by
 * when it began, and looked for only there: a run another account began is never anyone else's. Whatever
 * `to` had here that day gives way to it.
 */
export function claimDayRun(day: string, startedAt: number, to: string) {
  const store = readStore()
  const runs = runsOn(store, day)
  const signedOut = runs[SIGNED_OUT]
  let run: DayRun | null = null
  if (signedOut?.startedAt === startedAt) {
    run = signedOut
    delete runs[SIGNED_OUT]
  } else {
    const legacy = legacyRun(store, day)
    if (legacy?.startedAt === startedAt) run = legacy
  }
  if (!run) return
  runs[to] = run
  keepRuns(store, day, runs)
}

/** Whether the day's pour is done: all five glasses locked here, or poured on another device. */
export function dayDone(run: DayRun | null | undefined): boolean {
  return !!run && (run.levels.length >= ROUNDS || run.board != null)
}

/**
 * The board already has the account's pour today. A finished pour on this device that works out to it
 * exactly (played signed out, or kept before runs were stamped) is that pour: it's stamped as theirs,
 * squares and all. Else it was poured on another device, and is the day's here too, as the board's figure.
 * Only the account's own run is ever written, and nobody else's run id goes with it.
 */
export function adoptBoardResult(day: string, account: string, board: number, at: number) {
  const store = readStore()
  const runs = runsOn(store, day)
  if (dayDone(runs[account])) return
  const plan = dayPlan(day)
  const same = (run: DayRun | null | undefined): run is DayRun =>
    !!run && run.levels.length >= ROUNDS && judgeLevels(plan, run.levels.slice(0, ROUNDS)).board === board
  const found = [runs[SIGNED_OUT], legacyRun(store, day)].find(same)
  if (found) {
    claimDayRun(day, found.startedAt, account)
    return
  }
  updateDayRun(day, account, (run) => ({ startedAt: run?.startedAt ?? at, runId: run?.runId, levels: [], auto: [], board }))
}

/** Hear of any change to the days' runs, here or in another tab, and of the viewer changing: whose they are. */
export function subscribePourDay(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    // A tab still on a bundle from before runs were stamped writes the old key.
    if (e.key === STORE_KEY || e.key === LEGACY_KEY) onChange()
  }
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onStorage)
  const offViewer = subscribeViewer(onChange)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('storage', onStorage)
    offViewer()
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
 * unfurls into the day's card (scripts/today-cards.mjs) and opens the Today page. Before, it's the game's.
 */
export function shareText(plan: DayPlan, results: readonly PourResult[], origin: string): string {
  const sum = summarize(results)
  const link = TODAY_FROM != null && plan.day >= TODAY_FROM ? `${origin}${todayShareHref(plan.day)}` : `${origin}/games/halffull/play`
  return [
    `Half Full ${dayTag(plan.day)} · ${weekdayShort(plan.day)} · ${plan.label} 🥛`,
    `${sum.scoreText} ${sum.tier}`,
    `${sum.marks.join('')} · Team Half-${sum.team}`,
    `${sum.story} ${link}`,
  ].join('\n')
}
