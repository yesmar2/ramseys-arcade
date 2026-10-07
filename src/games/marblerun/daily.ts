/*
 * Marble Run's course of the day: the same for everyone, a new one at midnight on the boards' clock (New
 * York), as Hot Lap's track and Ace Chase's hole are. Each day's is in the plan (dailyPlan.ts, written and
 * checked by scripts/marblerun-daily.mjs), so every device lays the same course from the same try. Past the
 * end of the plan, which runs months ahead, the days go round again rather than make one nobody checked.
 */
import { DAILY_COURSES } from './dailyPlan.ts'

/** Day 1, Marble Run's first course (the API's marblerunPace.ts MARBLERUN_FIRST_DAY). */
export const FIRST_DAY = '2026-09-29'

/**
 * The first day Today's Course is on the Today ticket (lib/today.ts), as the API's today.ts
 * MARBLERUN_TODAY_FROM has it: the day the game came, so its first course is on the ticket too.
 */
export const TODAY_FROM: string | null = '2026-09-29'
const TZ = 'America/New_York'

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const clockFormat = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** The day on the boards' clock, as YYYY-MM-DD. */
export function courseDay(now = Date.now()): string {
  return dayFormat.format(new Date(now))
}

/** Until midnight on the boards' clock, when the next course comes. */
export function msUntilNextCourse(now = Date.now()): number {
  const [h, m, s] = clockFormat.format(new Date(now)).split(':').map(Number)
  return Math.max(0, (24 * 3600 - (h! * 3600 + m! * 60 + s!)) * 1000)
}

/** When the next course comes, to the second: the same all day, for a countdown to hold on to. */
export function nextCourseAt(now = Date.now()): number {
  return Math.round((now + msUntilNextCourse(now)) / 1000) * 1000
}

/** A day's number: 1 on the first day. */
export function courseNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  const [y0, m0, d0] = FIRST_DAY.split('-').map(Number)
  return Math.round((Date.UTC(y!, m! - 1, d!) - Date.UTC(y0!, m0! - 1, d0!)) / 86_400_000) + 1
}

/** How many days the plan has laid out, from the first. */
export const PLANNED_COURSES = DAILY_COURSES.length

/** Course `n`'s day, YYYY-MM-DD. */
export function dayOfCourse(n: number): string {
  const [y0, m0, d0] = FIRST_DAY.split('-').map(Number)
  return new Date(Date.UTC(y0!, m0! - 1, d0! + n - 1)).toISOString().slice(0, 10)
}

/**
 * A day whose course an admin may test run (the play page's ?day=, from the Course Book): today's, or one
 * still to come that the plan has laid out; null for anything else. A past day is practice, and anyone's.
 */
export function testRunDay(asked: string | undefined, today = courseDay()): string | null {
  if (!asked || !/^\d{4}-\d{2}-\d{2}$/.test(asked)) return null
  const n = courseNumber(asked)
  return asked >= today && n >= 1 && n <= PLANNED_COURSES && dayOfCourse(n) === asked ? asked : null
}

export type DailyCourse = {
  day: string
  /** The course's number: the day's, 1 on the first day. */
  n: number
  name: string
  /** The try at the course's number the plan kept (sim.ts plannedCourse). */
  attempt: number
  /** The pace ball's time when the day was planned, in seconds. */
  pace: number
  /** The moments its hammers, arms and slabs are set to (sim.ts timeThings), from sim.ts PIECES_FROM on. */
  timing?: readonly number[]
}

/** A day's course from the plan. */
export function dailyCourse(day = courseDay()): DailyCourse {
  const n = Math.max(1, courseNumber(day))
  const entry = DAILY_COURSES[(n - 1) % DAILY_COURSES.length]!
  return { day, n, name: entry.name, attempt: entry.a, pace: entry.pace / 1000, ...(entry.t ? { timing: entry.t } : {}) }
}

/** The course number a day's course is laid from: its own, or the planned day it stands in for. */
export function laidNumber(daily: DailyCourse): number {
  return ((daily.n - 1) % DAILY_COURSES.length) + 1
}

/** "3h 12m", "12m", "under a minute": how long until the next course. */
export function untilWords(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'under a minute'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
