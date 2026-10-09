/*
 * Wobble Run's gauntlet of the day: the same for everyone, a new one at midnight on the boards' clock (New York),
 * as Swoop's hills and Lander's cave are. Each day's is in the plan (dailyPlan.ts, written and checked by
 * scripts/wobblerun-daily.mjs): its rounds, the try the course is laid from and the blue bean's time, so every
 * device lays the same gauntlet. Past the end of the plan, which runs months ahead, the days go round again
 * rather than make some nobody checked.
 */
import { DAILY_GAUNTLETS } from './dailyPlan.ts'

/** Day 1, Wobble Run's first gauntlet (the API's wobblerunPace.ts WOBBLERUN_FIRST_DAY). */
export const FIRST_DAY = '2026-10-09'

/**
 * The first day Today's Gauntlet is on the Dailies card (lib/today.ts), as the API's today.ts
 * WOBBLERUN_TODAY_FROM has it: the day the game comes, as Swoop's was, since a daily isn't on the games wall and
 * the card is the way to it. It joins as the fifth race, after Swoop's hills.
 */
export const TODAY_FROM: string | null = '2026-10-09'
const TZ = 'America/New_York'

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const clockFormat = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** The day on the boards' clock, as YYYY-MM-DD. */
export function gauntletDay(now = Date.now()): string {
  return dayFormat.format(new Date(now))
}

/** Until midnight on the boards' clock, when the next gauntlet comes. */
export function msUntilNextGauntlet(now = Date.now()): number {
  const [h, m, s] = clockFormat.format(new Date(now)).split(':').map(Number)
  return Math.max(0, (24 * 3600 - (h! * 3600 + m! * 60 + s!)) * 1000)
}

/** When the next gauntlet comes, to the second: the same all day, for a countdown to hold on to. */
export function nextGauntletAt(now = Date.now()): number {
  return Math.round((now + msUntilNextGauntlet(now)) / 1000) * 1000
}

/** A day's number: 1 on the first day. */
export function gauntletNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  const [y0, m0, d0] = FIRST_DAY.split('-').map(Number)
  return Math.round((Date.UTC(y!, m! - 1, d!) - Date.UTC(y0!, m0! - 1, d0!)) / 86_400_000) + 1
}

/** How many days the plan has laid, from the first. */
export const PLANNED_GAUNTLETS = DAILY_GAUNTLETS.length

/** Gauntlet `n`'s day, YYYY-MM-DD. */
export function dayOfGauntlet(n: number): string {
  const [y0, m0, d0] = FIRST_DAY.split('-').map(Number)
  return new Date(Date.UTC(y0!, m0! - 1, d0! + n - 1)).toISOString().slice(0, 10)
}

/**
 * The day a play page's ?track= names: a gauntlet's number (the Gauntlet Book's links) or a day, YYYY-MM-DD.
 * Undefined for anything else, or a number the plan hasn't laid.
 */
export function trackDay(track: string | undefined): string | undefined {
  if (!track) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(track)) return track
  if (!/^\d{1,4}$/.test(track)) return undefined
  const n = Number(track)
  return n >= 1 && n <= PLANNED_GAUNTLETS ? dayOfGauntlet(n) : undefined
}

/**
 * A day whose gauntlet an admin may test run (the play page's ?day= or ?track=, from the Gauntlet Book): today's,
 * or one still to come that the plan has laid; null for anything else. A past day is practice, and anyone's.
 */
export function testRunDay(asked: string | undefined, today = gauntletDay()): string | null {
  if (!asked || !/^\d{4}-\d{2}-\d{2}$/.test(asked)) return null
  const n = gauntletNumber(asked)
  return asked >= today && n >= 1 && n <= PLANNED_GAUNTLETS && dayOfGauntlet(n) === asked ? asked : null
}

export type DailyGauntlet = {
  day: string
  /** The gauntlet's number: the day's, 1 on the first day. */
  n: number
  name: string
  /** The try at the gauntlet's number the plan kept (engine/course.ts plannedCourse). */
  attempt: number
  /** The blue bean's time when the day was planned, in seconds. */
  pace: number
  /** Its rounds in course order, finale last, as the plan's code: a letter and a tier each ("g1w2h2l2C2"). */
  k: string
}

/** A day's gauntlet from the plan. Before the first day, the first day's. */
export function dailyGauntlet(day = gauntletDay()): DailyGauntlet {
  const n = Math.max(1, gauntletNumber(day))
  const entry = DAILY_GAUNTLETS[(n - 1) % DAILY_GAUNTLETS.length]!
  return { day, n, name: entry.name, attempt: entry.a, pace: entry.pace / 1000, k: entry.k }
}

/** The number a day's gauntlet is laid from: its own, or the planned day it stands in for. */
export function laidNumber(daily: DailyGauntlet): number {
  return ((daily.n - 1) % DAILY_GAUNTLETS.length) + 1
}

/** "3h 12m", "12m", "under a minute": how long until the next gauntlet. */
export function untilWords(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'under a minute'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
