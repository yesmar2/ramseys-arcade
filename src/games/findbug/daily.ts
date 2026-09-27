import { hashString } from '../../lib/seededRandom'
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
 * scene it was on, with the clock where it stopped.
 */

const TZ = 'America/New_York'
/** Today's Wanted #1: the first day Find the Bug was a daily. */
export const FIRST_DAY = '2026-09-27'
/** Scenes a day (the game's ROUNDS, kept here so the cards needn't load the scenes). */
export const DAY_SCENES = 5

const STORE_KEY = 'skermix-findbug-daily'
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
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && new Date(utcNoon(day)).toISOString().slice(0, 10) === day
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

type Store = Record<string, DayRun>

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? (parsed as Store) : {}
  } catch {
    return {}
  }
}

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

/** What this device did on a day. */
export function dayRun(day: string): DayRun | null {
  return readStore()[day] ?? null
}

/**
 * Change what this device keeps for a day. `quiet` for a run's progress, kept every second as it's
 * played, which nothing on the page needs to hear about.
 */
export function updateDayRun(day: string, change: (run: DayRun | null) => DayRun | null, quiet = false) {
  const store = readStore()
  const next = change(store[day] ?? null)
  if (next) store[day] = next
  else delete store[day]
  writeStore(store, quiet)
}

/** The board already has a result today from this account, played on another device: it's the day's. */
export function adoptBoardResult(day: string, ms: number, at: number) {
  updateDayRun(day, (run) => (run?.result ? run : { startedAt: run?.startedAt ?? at, result: { ms } }))
}

/** Called when a day's run changes, here or in another tab. */
export function subscribeBugDay(onChange: () => void): () => void {
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
