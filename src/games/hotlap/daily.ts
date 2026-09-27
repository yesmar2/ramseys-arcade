/*
 * Hot Lap's track of the day: the same for everyone, a new one at midnight on the boards' clock (New
 * York), as Ace Chase's Today's Hole is. Each day's is in the plan (dailyPlan.ts, written and checked by
 * scripts/hotlap-daily.mjs), so every device builds the same track from the same line. Past the end of
 * the plan, which runs months ahead, the days go round again rather than make one nobody checked.
 */
import { decodeCourse } from './courses.ts'
import { DAILY_TRACKS } from './dailyPlan.ts'
import type { Piece } from './sim.ts'

/** Day 1, the classic track. */
export const FIRST_DAY = '2026-09-26'
const TZ = 'America/New_York'

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const clockFormat = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** The day on the boards' clock, as YYYY-MM-DD. */
export function trackDay(now = Date.now()): string {
  return dayFormat.format(new Date(now))
}

/** Until midnight on the boards' clock, when the next track comes. */
export function msUntilNextTrack(now = Date.now()): number {
  const [h, m, s] = clockFormat.format(new Date(now)).split(':').map(Number)
  return Math.max(0, (24 * 3600 - (h! * 3600 + m! * 60 + s!)) * 1000)
}

/** When the next track comes, to the second: the same all day, for a countdown to hold on to. */
export function nextTrackAt(now = Date.now()): number {
  return Math.round((now + msUntilNextTrack(now)) / 1000) * 1000
}

/** A day's number: 1 on the first day. */
export function trackNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  const [y0, m0, d0] = FIRST_DAY.split('-').map(Number)
  return Math.round((Date.UTC(y!, m! - 1, d!) - Date.UTC(y0!, m0! - 1, d0!)) / 86_400_000) + 1
}

/** The day of a track's number: the first day's is 1. */
export function dayOfTrack(n: number): string {
  const [y0, m0, d0] = FIRST_DAY.split('-').map(Number)
  return new Date(Date.UTC(y0!, m0! - 1, d0! + n - 1)).toISOString().slice(0, 10)
}

/** How many days are planned, from the first. */
export const PLANNED_TRACKS = DAILY_TRACKS.length

/** "Sat, Oct 10": a track's day, in words. */
export function dayWords(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
}

/**
 * The day a test drive asks for, `?track=` a track's number (1 to the plan's end) or its day
 * (YYYY-MM-DD); null for anything else.
 */
export function testDriveDay(asked: string | undefined): string | null {
  if (!asked) return null
  const day = /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : /^\d{1,4}$/.test(asked) ? dayOfTrack(Number(asked)) : null
  if (!day) return null
  const n = trackNumber(day)
  return n >= 1 && n <= PLANNED_TRACKS && dayOfTrack(n) === day ? day : null
}

export type DailyTrack = {
  day: string
  n: number
  name: string
  pieces: Piece[]
  /** The pace car's lap when the day was planned. */
  pace: number
}

export function dailyTrack(day = trackDay()): DailyTrack {
  const n = Math.max(1, trackNumber(day))
  const entry = DAILY_TRACKS[(n - 1) % DAILY_TRACKS.length]!
  return { day, n, name: entry.name, pieces: decodeCourse(entry.course), pace: entry.pace }
}

/** "3h 12m", "12m", "under a minute": how long until the next track. */
export function untilWords(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'under a minute'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
