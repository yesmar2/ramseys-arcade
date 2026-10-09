import type { ReactNode } from 'react'
import { art as caveArt, title as caveTitle } from '../components/archive/CaveArchive'
import { art as courseArt, title as courseTitle } from '../components/archive/CourseArchive'
import { art as gauntletArt, title as gauntletTitle } from '../components/archive/GauntletArchive'
import { art as hillsArt, title as hillsTitle } from '../components/archive/HillsArchive'
import { art as trackArt, title as trackTitle } from '../components/archive/TrackArchive'
import { dayOfTrack, FIRST_DAY as HOTLAP_FIRST, trackDay, trackNumber } from '../games/hotlap/daily'
import { caveDay, caveNumber, dayOfCave, FIRST_DAY as LANDER_FIRST } from '../games/lander/daily'
import { courseDay, courseNumber, dayOfCourse, FIRST_DAY as MARBLERUN_FIRST } from '../games/marblerun/daily'
import { dayOfHills, FIRST_DAY as SWOOP_FIRST, hillsDay, hillsNumber } from '../games/swoop/daily'
import { dayOfGauntlet, FIRST_DAY as WOBBLERUN_FIRST, gauntletDay, gauntletNumber } from '../games/wobblerun/daily'
import type { RaceEventGame } from './tournaments'

/*
 * The courses a racing daily's event can be raced on, game by game: today's, and every one before it back to the
 * game's first, each with its name and picture as the game's past courses show them (components/archive). The
 * event maker's track strip and the event pages read them here (Ramsey picked A, a strip of track cards, from
 * the "Events on past courses" canvas, 2026-10-09).
 */

export type EventCourseSource = {
  /** Today's course's day, YYYY-MM-DD, on the game's own clock. */
  today: () => string
  /** The game's first day. */
  first: string
  /** A course's number from its day, and its day from its number. */
  numberOf: (day: string) => number
  dayOf: (n: number) => string
  /** "#12 Bramble Speedway". */
  title: (day: string) => string
  /** The course's picture, filling its box. */
  art: (day: string) => ReactNode
}

export const EVENT_COURSES: Record<RaceEventGame, EventCourseSource> = {
  hotlap: { today: () => trackDay(), first: HOTLAP_FIRST, numberOf: trackNumber, dayOf: dayOfTrack, title: trackTitle, art: trackArt },
  marblerun: { today: () => courseDay(), first: MARBLERUN_FIRST, numberOf: courseNumber, dayOf: dayOfCourse, title: courseTitle, art: courseArt },
  lander: { today: () => caveDay(), first: LANDER_FIRST, numberOf: caveNumber, dayOf: dayOfCave, title: caveTitle, art: caveArt },
  swoop: { today: () => hillsDay(), first: SWOOP_FIRST, numberOf: hillsNumber, dayOf: dayOfHills, title: hillsTitle, art: hillsArt },
  wobblerun: { today: () => gauntletDay(), first: WOBBLERUN_FIRST, numberOf: gauntletNumber, dayOf: dayOfGauntlet, title: gauntletTitle, art: gauntletArt },
}

/** A day, YYYY-MM-DD, `n` days before another. */
export function daysBefore(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const at = new Date(Date.UTC(y!, m! - 1, d! - n))
  return at.toISOString().slice(0, 10)
}

/** Every course of a game an event could be raced on, newest first: today's, then each before it to the first. */
export function eventCourseDays(game: RaceEventGame): string[] {
  const src = EVENT_COURSES[game]
  const out: string[] = []
  for (let day = src.today(); day >= src.first && out.length < 400; day = daysBefore(day, 1)) out.push(day)
  return out
}

/**
 * Whether a course's day is free to host on: today's alone. Every past one, the last week's included, is a Plus
 * host's (Ramsey, 2026-10-09: "ok let's do it"); the last week's stay everyone's to play.
 */
export function courseOpenToAll(game: RaceEventGame, day: string): boolean {
  return day === EVENT_COURSES[game].today()
}

/** An event's course as words: "Hot Lap #12 Bramble Speedway"'s "#12 Bramble Speedway", or "#12" when it can't be named. */
export function eventCourseTitle(game: string, n: number): string {
  const src = (EVENT_COURSES as Record<string, EventCourseSource | undefined>)[game]
  if (!src) return `#${n}`
  try {
    return src.title(src.dayOf(n))
  } catch {
    return `#${n}`
  }
}
