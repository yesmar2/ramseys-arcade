import { claimableRun, ownKey, ownRun, SIGNED_OUT, subscribeViewer, type OwnedRuns, type Viewer } from '../../lib/deviceRuns'
import { dayPlan, PLATES, type DayPlan } from './plan'
import type { Point } from './plates'
import { dayScore, formatScore, judgeTaps, markFor, tierFor, type Mark, type Tier } from './score'

/*
 * Centroid as a daily (Ramsey, 2026-10-06: "centroid should be a daily like the fill the cup game"): six new
 * plates at midnight on the boards' clock (New York), the same for everyone. The day's first run is the
 * result; after it, the day's plates play again as practice, and so does any past day's. Just for fun: it
 * sits under the Dailies ticket with the other puzzles ("Also today"), off the streak.
 *
 * This device keeps each day's first run as it's played, a tap a plate, so one left halfway carries on from
 * the plate it was on. It keeps one a player: each run is stamped with whoever began it (lib/deviceRuns.ts),
 * and is only ever shown and saved as theirs. Half Full's daily.ts is the model for all of it.
 */

const TZ = 'America/New_York'
/** Centroid's daily #1: its board, day points and record book count from this day (the API's CENTROID_FIRST_DAY). */
export const FIRST_DAY = '2026-10-06'

/**
 * The day it joined the Dailies, under the ticket with the puzzles (lib/today.ts), YYYY-MM-DD. The same as the
 * API's centroid/launch.ts CENTROID_TODAY_FROM (`npm run check:centroid`).
 */
export const TODAY_FROM: string | null = '2026-10-06'

const STORE_KEY = 'skermix-centroid-daily'
/** Said on every change: lib/today.ts listens for it. */
const EVENT = 'skermix-centroid-daily'
const KEEP_DAYS = 120

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const weekdayFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' })

/** The day on the boards' clock, as YYYY-MM-DD. */
export function plateDay(now = Date.now()): string {
  return dayFormat.format(new Date(now))
}

const utcNoon = (day: string) => Date.parse(`${day}T12:00:00Z`)

export function isDay(day: string | null | undefined): day is string {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  const t = utcNoon(day)
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === day
}

/** #1 on the first day; nought or less is a day before it, a preview. */
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
  /** Each plate's tap, plate by plate, as it was saved (to a ten-thousandth). */
  taps: Point[]
  /** The day's board figure when the board already has this account's day from another device. */
  board?: number
}

type Store = Record<string, OwnedRuns<DayRun>>

let memory: Store = {}

function isRun(run: unknown): run is DayRun {
  return !!run && typeof run === 'object' && Array.isArray((run as DayRun).taps)
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

export type ViewerRuns = { own: DayRun | null; owner: string | null; claimable: DayRun | null }

export function viewerRuns(day: string, viewer: Viewer): ViewerRuns {
  const runs = runsOn(readStore(), day)
  const key = ownKey(viewer)
  const own = ownRun(runs, viewer)
  return { own, owner: own && key !== undefined ? key : null, claimable: own ? null : claimableRun(runs, viewer) }
}

/** The viewer's own run of the day, or null. */
export function dayRun(day: string, viewer: Viewer): DayRun | null {
  return viewerRuns(day, viewer).own
}

/** Change one owner's run of the day, and only theirs. */
export function updateDayRun(day: string, owner: string, change: (run: DayRun | null) => DayRun | null) {
  const store = readStore()
  const runs = runsOn(store, day)
  const next = change(runs[owner] ?? null)
  if (next) runs[owner] = next
  else delete runs[owner]
  keepRuns(store, day, runs)
}

/** The id the API opened a run under, come back: onto that run (known by when it began), unless it has one. */
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

/** Stamp a run played signed out as `to`'s, known by when it began. */
export function claimDayRun(day: string, startedAt: number, to: string) {
  const store = readStore()
  const runs = runsOn(store, day)
  const signedOut = runs[SIGNED_OUT]
  if (signedOut?.startedAt !== startedAt) return
  delete runs[SIGNED_OUT]
  runs[to] = signedOut
  keepRuns(store, day, runs)
}

/** Whether the day is done: all six plates tapped here, or played on another device. */
export function dayDone(run: DayRun | null | undefined): boolean {
  return !!run && (run.taps.length >= PLATES || run.board != null)
}

/**
 * The board already has the account's day. A finished run on this device that works out to it exactly
 * (played signed out) is that run, stamped as theirs; else it was played on another device, and is the
 * day's here too, as the board's figure.
 */
export function adoptBoardResult(day: string, account: string, board: number, at: number) {
  const store = readStore()
  const runs = runsOn(store, day)
  if (dayDone(runs[account])) return
  const plan = dayPlan(day)
  const signedOut = runs[SIGNED_OUT]
  if (signedOut && signedOut.taps.length >= PLATES && judgeTaps(plan, signedOut.taps.slice(0, PLATES)).board === board) {
    claimDayRun(day, signedOut.startedAt, account)
    return
  }
  updateDayRun(day, account, (run) => ({ startedAt: run?.startedAt ?? at, runId: run?.runId, taps: [], board }))
}

/** Hear of any change to the days' runs, here or in another tab, and of the viewer changing. */
export function subscribePlateDay(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORE_KEY) onChange()
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

/** A kept run's points, plate by plate, judged again from the day's plates. */
export function keptScores(plan: DayPlan, run: DayRun | null): number[] {
  if (!run?.taps.length) return []
  const taps = run.taps.slice(0, PLATES)
  return judgeTaps({ ...plan, plates: plan.plates.slice(0, taps.length) }, taps).scores
}

/** A finished day, summed up: its score, tier and squares. */
export type DaySummary = { day: number; scoreText: string; tier: Tier; marks: Mark[] }

export function summarize(scores: readonly number[]): DaySummary {
  const day = dayScore(scores)
  return { day, scoreText: formatScore(day), tier: tierFor(day), marks: scores.map(markFor) }
}

/* ---------- passing it on ---------- */

/** The day's result to send on: no plate shown, only how it went. */
export function shareText(plan: DayPlan, scores: readonly number[], origin: string): string {
  const sum = summarize(scores)
  return [
    `Centroid ${dayTag(plan.day)} · ${weekdayShort(plan.day)} · ${plan.label} ⚖️`,
    `${sum.scoreText} ${sum.tier}`,
    sum.marks.join(''),
    `${origin}/games/centroid/play`,
  ].join('\n')
}
