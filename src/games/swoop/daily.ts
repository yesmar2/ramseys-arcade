/*
 * Swoop's hills of the day: the same for everyone, a new set at midnight on the boards' clock (New York), as
 * Hot Lap's track and Lander's cave are. Each day's are in the plan (dailyPlan.ts, written and checked by
 * scripts/swoop-daily.mjs), so every device lays the same hills from the same try. Past the end of the plan,
 * which runs months ahead, the days go round again rather than make some nobody checked.
 */
import { DAILY_HILLS } from './dailyPlan.ts'

/** Day 1, Swoop's first hills (the API's swoopPace.ts SWOOP_FIRST_DAY). */
export const FIRST_DAY = '2026-10-06'

/**
 * The first day Today's Hills are on the Dailies card (lib/today.ts), as the API's today.ts SWOOP_TODAY_FROM
 * has it: the day after the game came, since a day's card is judged as it began and its first day's began
 * without it.
 */
export const TODAY_FROM: string | null = '2026-10-07'
const TZ = 'America/New_York'

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const clockFormat = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** The day on the boards' clock, as YYYY-MM-DD. */
export function hillsDay(now = Date.now()): string {
  return dayFormat.format(new Date(now))
}

/** Until midnight on the boards' clock, when the next hills come. */
export function msUntilNextHills(now = Date.now()): number {
  const [h, m, s] = clockFormat.format(new Date(now)).split(':').map(Number)
  return Math.max(0, (24 * 3600 - (h! * 3600 + m! * 60 + s!)) * 1000)
}

/** When the next hills come, to the second: the same all day, for a countdown to hold on to. */
export function nextHillsAt(now = Date.now()): number {
  return Math.round((now + msUntilNextHills(now)) / 1000) * 1000
}

/** A day's number: 1 on the first day. */
export function hillsNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  const [y0, m0, d0] = FIRST_DAY.split('-').map(Number)
  return Math.round((Date.UTC(y!, m! - 1, d!) - Date.UTC(y0!, m0! - 1, d0!)) / 86_400_000) + 1
}

/** How many days the plan has laid, from the first. */
export const PLANNED_HILLS = DAILY_HILLS.length

/** Hills `n`'s day, YYYY-MM-DD. */
export function dayOfHills(n: number): string {
  const [y0, m0, d0] = FIRST_DAY.split('-').map(Number)
  return new Date(Date.UTC(y0!, m0! - 1, d0! + n - 1)).toISOString().slice(0, 10)
}

/**
 * A day whose hills an admin may test fly (the play page's ?day=, from the Hills Book): today's, or some still
 * to come that the plan has laid; null for anything else. A past day is practice, and anyone's.
 */
export function testRunDay(asked: string | undefined, today = hillsDay()): string | null {
  if (!asked || !/^\d{4}-\d{2}-\d{2}$/.test(asked)) return null
  const n = hillsNumber(asked)
  return asked >= today && n >= 1 && n <= PLANNED_HILLS && dayOfHills(n) === asked ? asked : null
}

export type DailyHills = {
  day: string
  /** The hills' number: the day's, 1 on the first day. */
  n: number
  name: string
  /** The try at the hills' number the plan kept (sim.ts plannedHills). */
  attempt: number
  /** The blue bird's time when the day was planned, in seconds. */
  pace: number
}

/** A day's hills from the plan. Before the first day, the first day's. */
export function dailyHills(day = hillsDay()): DailyHills {
  const n = Math.max(1, hillsNumber(day))
  const entry = DAILY_HILLS[(n - 1) % DAILY_HILLS.length]!
  return { day, n, name: entry.name, attempt: entry.a, pace: entry.pace / 1000 }
}

/** The number a day's hills are laid from: its own, or the planned day it stands in for. */
export function laidNumber(daily: DailyHills): number {
  return ((daily.n - 1) % DAILY_HILLS.length) + 1
}

/** "3h 12m", "12m", "under a minute": how long until the next hills. */
export function untilWords(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'under a minute'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
