/*
 * Lander's cave of the day: the same for everyone, a new one at midnight on the boards' clock (New York), as
 * Hot Lap's track and Marble Run's course are. Each day's is in the plan (dailyPlan.ts, written and checked by
 * scripts/lander-daily.mjs), so every device digs the same cave from the same try. Past the end of the plan,
 * which runs months ahead, the days go round again rather than make one nobody checked.
 */
import { DAILY_CAVES } from './dailyPlan.ts'

/** Day 1, Lander's first cave (the API's landerPace.ts LANDER_FIRST_DAY). */
export const FIRST_DAY = '2026-09-30'

/**
 * The first day Today's Cave is on the Dailies card (lib/today.ts), as the API's today.ts LANDER_TODAY_FROM
 * has it: the day after the game came, since a day's card is judged as it began and its first day's began
 * with five.
 */
export const TODAY_FROM: string | null = '2026-10-01'
const TZ = 'America/New_York'

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const clockFormat = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** The day on the boards' clock, as YYYY-MM-DD. */
export function caveDay(now = Date.now()): string {
  return dayFormat.format(new Date(now))
}

/** Until midnight on the boards' clock, when the next cave comes. */
export function msUntilNextCave(now = Date.now()): number {
  const [h, m, s] = clockFormat.format(new Date(now)).split(':').map(Number)
  return Math.max(0, (24 * 3600 - (h! * 3600 + m! * 60 + s!)) * 1000)
}

/** When the next cave comes, to the second: the same all day, for a countdown to hold on to. */
export function nextCaveAt(now = Date.now()): number {
  return Math.round((now + msUntilNextCave(now)) / 1000) * 1000
}

/** A day's number: 1 on the first day. */
export function caveNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  const [y0, m0, d0] = FIRST_DAY.split('-').map(Number)
  return Math.round((Date.UTC(y!, m! - 1, d!) - Date.UTC(y0!, m0! - 1, d0!)) / 86_400_000) + 1
}

/** How many days the plan has dug, from the first. */
export const PLANNED_CAVES = DAILY_CAVES.length

/** Cave `n`'s day, YYYY-MM-DD. */
export function dayOfCave(n: number): string {
  const [y0, m0, d0] = FIRST_DAY.split('-').map(Number)
  return new Date(Date.UTC(y0!, m0! - 1, d0! + n - 1)).toISOString().slice(0, 10)
}

/**
 * A day whose cave an admin may test fly (the play page's ?day=, from the Cave Book): today's, or one still
 * to come that the plan has dug; null for anything else. A past day is practice, and anyone's.
 */
export function testRunDay(asked: string | undefined, today = caveDay()): string | null {
  if (!asked || !/^\d{4}-\d{2}-\d{2}$/.test(asked)) return null
  const n = caveNumber(asked)
  return asked >= today && n >= 1 && n <= PLANNED_CAVES && dayOfCave(n) === asked ? asked : null
}

export type DailyCave = {
  day: string
  /** The cave's number: the day's, 1 on the first day. */
  n: number
  name: string
  /** The try at the cave's number the plan kept (sim.ts plannedCave). */
  attempt: number
  /** The blue ship's time when the day was planned, in seconds. */
  pace: number
  /** The moments its crushers, vents and lift are set to (sim.ts timeThings), from sim.ts THINGS_FROM on. */
  timing?: readonly number[]
}

/** A day's cave from the plan. Before the first day, the first day's. */
export function dailyCave(day = caveDay()): DailyCave {
  const n = Math.max(1, caveNumber(day))
  const entry = DAILY_CAVES[(n - 1) % DAILY_CAVES.length]!
  return { day, n, name: entry.name, attempt: entry.a, pace: entry.pace / 1000, ...(entry.t ? { timing: entry.t } : {}) }
}

/** The cave number a day's cave is dug from: its own, or the planned day it stands in for. */
export function laidNumber(daily: DailyCave): number {
  return ((daily.n - 1) % DAILY_CAVES.length) + 1
}

/** "3h 12m", "12m", "under a minute": how long until the next cave. */
export function untilWords(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'under a minute'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
