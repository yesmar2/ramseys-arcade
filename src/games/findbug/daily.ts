import { claimableRun, ownKey, ownRun, SIGNED_OUT, subscribeViewer, type OwnedRuns, type Viewer } from '../../lib/deviceRuns'
import { hashString } from '../../lib/seededRandom'
import { findbugBoardScore, findbugMsFromBoardScore } from './score'
import { wantedFor, type WantedBug } from './wanted'

/*
 * Today's Wanted: Find the Bug as a daily. Every day at midnight on the boards' clock there are five new
 * scenes with a new bug wanted in each, the same for everyone (each laid out for the screen it's played
 * on). The day's first run is the result, and the board takes only that one (the API's firstRun.ts);
 * after it, the day's scenes can be played again as practice, and so can any past day's, from the
 * archive.
 *
 * This device keeps each day's run: when it began, the id the API opened it under, how far it had got
 * and how it came out. A first run left halfway, the tab closed or the phone rung, carries on from the
 * scene it was on, with the clock where it stopped. Each run is its player's (lib/deviceRuns.ts): a day
 * keeps one run for each account that played it here, and one played signed out, and each is only ever
 * shown and saved as its own player's.
 */

const TZ = 'America/New_York'
/** Today's Wanted #1: the first day Find the Bug was a daily. */
export const FIRST_DAY = '2026-09-27'
/** Scenes a day (the game's ROUNDS, kept here so the cards needn't load the scenes). */
export const DAY_SCENES = 5

/** Each day's runs, by whose they are. */
const STORE_KEY = 'skermix-findbug-daily-2'
/**
 * Each day's one run, kept before runs had players: read, never written. A tab still on an older bundle
 * (served for a load or two after a release) keeps writing its runs here, where this one's don't reach.
 */
const LEGACY_KEY = 'skermix-findbug-daily'
/** Said when a day's run changes (lib/today.ts listens for it too). */
const EVENT = 'skermix-findbug-daily'
/** Days kept on the device: long enough for any archive card to say how yours went. */
const KEEP_DAYS = 120

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const clockFormat = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** The day on the boards' clock, as YYYY-MM-DD. */
export function bugDay(now = Date.now()): string {
  return dayFormat.format(new Date(now))
}

/** Until midnight on the boards' clock, when the next day's scenes come. */
export function msUntilNextDay(now = Date.now()): number {
  const [h, m, s] = clockFormat.format(new Date(now)).split(':').map(Number)
  return Math.max(0, (24 * 3600 - (h! * 3600 + m! * 60 + s!)) * 1000)
}

/** When the next day comes, to the second: the same all day, for a countdown to hold on to. */
export function nextDayAt(now = Date.now()): number {
  return Math.round((now + msUntilNextDay(now)) / 1000) * 1000
}

const utcNoon = (day: string) => Date.parse(`${day}T12:00:00Z`)

/** A real day, as YYYY-MM-DD. */
export function isDay(day: string | null | undefined): day is string {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  // A month 13 or a day 32 parses to NaN, which toISOString would throw on.
  const t = utcNoon(day)
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === day
}

/** The day's number: #1 on the first day. */
export function dayNumber(day: string): number {
  return Math.round((utcNoon(day) - utcNoon(FIRST_DAY)) / 86_400_000) + 1
}

/** The seed a day's five scenes and wanted bugs grow from. */
export function daySeed(day: string): number {
  return hashString(`findbug:${day}`)
}

/** The day's five wanted bugs, scene by scene. */
export function dayWanted(day: string): WantedBug[] {
  const seed = daySeed(day)
  return Array.from({ length: DAY_SCENES }, (_, i) => wantedFor(seed, i))
}

/** "Skip, Rosie, Pip, the Bug and Hopper": who's wanted, as the day's name. */
export function wantedNames(wanted: readonly WantedBug[]): string {
  const names = wanted.map((w) => w.name)
  const first = names[0] ?? ''
  const lead = first.charAt(0).toUpperCase() + first.slice(1)
  if (names.length < 2) return lead
  return `${[lead, ...names.slice(1, -1)].join(', ')} and ${names[names.length - 1]}`
}

/* ---------- what this device keeps ---------- */

/** How far a run had got: the scene it was on, what the clock had before it, and into it. */
export type DayProgress = {
  index: number
  bankedMs: number
  sceneMs: number
  found: number
  misses: number
  times: number[]
}

/** How a day's first run came out. One the board had from another device knows only its time. */
export type DayResult = {
  ms: number
  found?: number
  misses?: number
  /** Each scene's time; the minute for one run out of. */
  times?: number[]
}

export type DayRun = {
  /** When the day's first run began here. */
  startedAt: number
  /** The id the API opened it under, so its save carries it even after a reload. */
  runId?: string
  /** How far it had got, to carry on from. */
  at?: DayProgress
  result?: DayResult
}

/** Each day's runs, by the stamp of whose they are (lib/deviceRuns.ts). */
type Store = Record<string, OwnedRuns<DayRun>>

/** Each day's one unstamped run, from before runs had players. */
type LegacyStore = Record<string, DayRun>

function readKey<T>(key: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(key)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, T>) : {}
  } catch {
    return {}
  }
}

const readStore = (): Store => readKey<OwnedRuns<DayRun>>(STORE_KEY)
const readLegacy = (): LegacyStore => readKey<DayRun>(LEGACY_KEY)

function writeStore(store: Store, quiet: boolean) {
  const days = Object.keys(store).sort()
  for (const day of days.slice(0, Math.max(0, days.length - KEEP_DAYS))) delete store[day]
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store))
  } catch {
    /* storage off: the day lasts as long as the page */
  }
  if (!quiet && typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}

/**
 * What the viewer did on a day on this device: their own run (lib/deviceRuns.ts). Never another
 * account's, nor one played signed out while they're signed in (only the game offers that one, to take
 * up); nothing while who's signed in isn't known.
 */
export function dayRun(day: string, viewer: Viewer): DayRun | null {
  return ownRun(readStore()[day], viewer)
}

/**
 * Whose a day's run the game offers is: the viewer's own, or one played signed out on this device, which
 * the signed-in viewer may take up.
 */
export type RunHold = 'own' | 'claimable'

/** A day's run as the game offers it to the viewer, and whose it is. */
export type OfferedRun = { run: DayRun; hold: RunHold }

/**
 * The day's run the game offers the viewer: their own, else (signed in) one played signed out here that
 * they may take up. Nothing while who's signed in isn't known.
 */
export function offeredRun(day: string, viewer: Viewer): OfferedRun | null {
  const key = ownKey(viewer)
  if (key === undefined) return null
  const runs = readStore()[day]
  const own = runs?.[key]
  if (own) return { run: own, hold: 'own' }
  const spare = claimableRun(runs, viewer)
  return spare ? { run: spare, hold: 'claimable' } : null
}

/**
 * Change the run a day keeps for one owner (a stamp: an account's id, or SIGNED_OUT), and no one else's.
 * `quiet` for a run's progress, kept every second as it's played, which nothing on the page needs to hear
 * about.
 */
export function updateDayRun(day: string, owner: string, change: (run: DayRun | null) => DayRun | null, quiet = false) {
  const store = readStore()
  const runs = { ...store[day] }
  const next = change(runs[owner] ?? null)
  if (next) runs[owner] = next
  else delete runs[owner]
  if (Object.keys(runs).length) store[day] = runs
  else delete store[day]
  writeStore(store, quiet)
}

/**
 * The run the viewer carries on is theirs from now on, kept under their own stamp: one played signed out
 * goes to the account that takes it up. The run, as it's kept now; null when there's none to carry on.
 */
export function takeUpRun(day: string, viewer: Viewer): DayRun | null {
  const key = ownKey(viewer)
  if (key === undefined) return null
  const store = readStore()
  const runs = { ...store[day] }
  const own = runs[key]
  if (own) return own
  const from = key === SIGNED_OUT ? undefined : runs[SIGNED_OUT]
  if (!from) return null
  runs[key] = from
  delete runs[SIGNED_OUT]
  store[day] = runs
  writeStore(store, false)
  return from
}

/**
 * A run played signed out, saved under an account: it's that account's now. `startedAt` says which run,
 * so one that's moved on since isn't taken. The board holds this one for the account, so it stands in for
 * any of theirs left here unfinished.
 */
export function restampRun(day: string, startedAt: number, account: Viewer) {
  if (typeof account !== 'string') return
  const store = readStore()
  const runs = { ...store[day] }
  const run = runs[SIGNED_OUT]
  if (!run || run.startedAt !== startedAt) return
  runs[account] = run
  delete runs[SIGNED_OUT]
  store[day] = runs
  writeStore(store, false)
}

/**
 * The board already has a result today for this account (`score`, on the board's scale): it's the day's
 * here too, for the account alone. A run on this device that came out exactly as the board has it is
 * theirs, whole, with what it found and each scene's time: one played signed out and saved under the
 * account, or one kept before runs had players. Otherwise it's the board's time alone (played on another
 * device). A result of the account's own already here stands.
 */
export function adoptBoardResult(day: string, account: string, score: number, at: number) {
  const store = readStore()
  const runs = { ...store[day] }
  const own = runs[account]
  if (own?.result) return
  const same = (run: DayRun | undefined) => run?.result != null && findbugBoardScore(run.result.ms) === score
  const signedOut = runs[SIGNED_OUT]
  const legacy = readLegacy()[day]
  if (same(signedOut)) {
    runs[account] = signedOut
    delete runs[SIGNED_OUT]
  } else if (same(legacy)) {
    runs[account] = legacy
  } else {
    runs[account] = { startedAt: own?.startedAt ?? at, result: { ms: findbugMsFromBoardScore(score) } }
  }
  store[day] = runs
  writeStore(store, false)
}

/** Called when a day's run changes, here or in another tab, and when whose runs are the viewer's does. */
export function subscribeBugDay(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    // The old key too: a tab still on an older bundle keeps its runs there.
    if (e.key === STORE_KEY || e.key === LEGACY_KEY) onChange()
  }
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onStorage)
  const stopViewer = subscribeViewer(onChange)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('storage', onStorage)
    stopViewer()
  }
}

/* ---------- passing it on ---------- */

/** The game's hint times: a wide circle at 25 s, a tight one at 42 s, the scene over at a minute. */
const WIDE_HINT_MS = 25_000
const NARROW_HINT_MS = 42_000
const LIMIT_MS = 60_000

/** A scene as a square: found before any hint, with the wide one, with the tight one, or not found. */
export function sceneMark(ms: number): '🟩' | '🟨' | '🟧' | '🟥' {
  if (ms >= LIMIT_MS) return '🟥'
  if (ms >= NARROW_HINT_MS) return '🟧'
  if (ms >= WIDE_HINT_MS) return '🟨'
  return '🟩'
}

function clock(ms: number): string {
  const total = Math.max(0, ms) / 1000
  const m = Math.floor(total / 60)
  const s = total - m * 60
  return m > 0 ? `${m}:${s.toFixed(1).padStart(4, '0')}` : `${s.toFixed(1)}s`
}

/** The day's result to send on: its number, a square a scene, and the time. */
export function shareText(day: string, result: DayResult): string {
  const marks = result.times?.length ? `${result.times.map(sceneMark).join('')} ` : ''
  return `Find the Bug · Today’s Wanted #${dayNumber(day)}\n${marks}${clock(result.ms)}`
}
