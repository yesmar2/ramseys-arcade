import type { ReactNode } from 'react'
import { useAccountId } from '../hooks/useAccountId'
import { usePlayerName } from '../hooks/usePlayerName'
import { archiveDayWords, dayBefore } from './archive'
import { dailyWords, type PastKind } from './dailyWords'
import { normalizePlayerName } from './leaderboard'

/*
 * The past tab of a daily's page (components/DailyPastTab.tsx): every course before today's, newest
 * first, each with how it went on its day and, for a game whose past courses keep boards of their own
 * (Hot Lap's tracks, Ace Chase's holes), that board. Each game says what its courses are in a source
 * (components/archive/*Archive.tsx); what's the same for every game is here.
 */

/** A result on a course's own board, as the board scores it (Ace Chase's is a million less the tries). */
export type CourseFigure = { name: string; score: number; avatarId?: string }

/** A past course's own board, as its row shows it: its record, how many are on it, and your best and place. */
export type CourseBoard = {
  record: CourseFigure | null
  /** The day, on the game's clock, its record was set, when the API says. */
  setOn?: string
  players: number
  you: { score: number; place: number } | null
}

/** One course's board opened on its row: the top ten and where you stand. */
export type CourseTop = {
  top: CourseFigure[]
  players: number
  you: { score: number; place: number } | null
}

/** Who's looking: signed in, signed out, or not known yet (a session that hasn't said whose it is). */
export type PastViewer = { name: string; state: 'in' | 'out' | 'pending' }

/** What a row's line under its button is worked out from. */
export type HintFacts = {
  kind: PastKind
  signedIn: boolean
  board: CourseBoard | undefined
}

/** One daily's past courses: what each is, how to play it, and its board if it keeps one. */
export type PastSource = {
  slug: string
  /** Today's course's day, YYYY-MM-DD, on the game's own clock. */
  today: string
  /** The game's first day. */
  first: string
  number: (day: string) => number
  /** What a row's id is made of, after "course-": a track's or hole's number, or the day. */
  anchor: (day: string) => string
  /** The play page for a past course. */
  playHref: (day: string) => string
  /** A row's title, "#3 Seneca Glen": cheap, so every row has its name from the start. */
  title: (day: string) => string
  /** The line under a row's date, worked out as the row comes near. */
  sub: (day: string) => string
  /** A course's picture, filling a 16:10 box. */
  art: (day: string) => ReactNode
  /** For a game whose past courses keep boards of their own. */
  boards?: {
    /** Each past course's board by its day; null while they're asked, or when they couldn't be had. */
    rows: ReadonlyMap<string, CourseBoard> | null
    /** The boards couldn't be had (rows stays null), and asking again. */
    failed?: boolean
    retry?: () => void
    fetchTop: (day: string, name: string) => Promise<CourseTop>
    /** What the rule box says goes on a course's board, after "Each keeps a board of its own: ". */
    rule: string
    /** What a board is, for the list's key: after "Track board". */
    legend: string
    /** Who is on a board: "driver", "player". */
    player: string
    /** How far a result is off a record, "6.63s", for a board you can climb (Hot Lap's): none for Ace Chase's. */
    gap?: (you: number, record: number) => string
  }
  /** A course takes only a player's first result (Ace Chase): with one there already, playing it is practice. */
  firstResultOnly?: boolean
  /** Whether this device knows of a result of the viewer's on a course that the API may not have yet. */
  resultHere?: (day: string) => boolean
  /** The line under a row's button, if any. */
  hint?: (facts: HintFacts) => string | null
}

/** A row is paged in this many at a time. */
export const PAST_PAGE = 14

/** The days of the week strip: the last seven, today's included, none before the game's first; oldest first. */
export function weekDays(today: string, first: string): string[] {
  const out: string[] = []
  for (let day = today; day >= first && out.length < 7; day = dayBefore(day)) out.unshift(day)
  return out
}

/** Every past course's day, newest first. */
export function pastDays(today: string, first: string): string[] {
  const out: string[] = []
  for (let day = dayBefore(today); day >= first; day = dayBefore(day)) out.push(day)
  return out
}

const stripFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', day: 'numeric' })

/** "Sat 26": a day on the week strip. */
export function stripDayWords(day: string): string {
  const parts = stripFormat.formatToParts(new Date(`${day}T12:00:00Z`))
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const date = parts.find((p) => p.type === 'day')?.value ?? ''
  return `${weekday} ${date}`
}

/** "raced", "played", "poured", "rolled": the game's verb, done. */
export function verbDone(slug: string): string {
  const verb = dailyWords(slug).verb.toLowerCase()
  return verb.endsWith('e') ? `${verb}d` : `${verb}ed`
}

/** "tracks", "holes", "days", "courses". */
export function coursesWord(slug: string, count = 2): string {
  const course = dailyWords(slug).course
  return count === 1 ? course : `${course}s`
}

export function capitalWord(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

/**
 * What a run on a past course does for this player. Signed out, nothing is saved anywhere. Signed in, a
 * board game's run goes on the course's board, but where only a first result counts (Ace Chase), a
 * course they have a result on already is practice.
 */
export function pastKindFor(slug: string, signedIn: boolean, firstResultOnly: boolean, hadResult: boolean): PastKind {
  if (!signedIn || dailyWords(slug).past === 'practice') return 'practice'
  return firstResultOnly && hadResult ? 'practice' : 'board'
}

/** The day a course's record was set, from when the API says it was (its `at`), on the game's clock. */
export function recordSetOn(record: { at?: number } | null, dayOf: (ms: number) => string): string | undefined {
  const at = record?.at
  return typeof at === 'number' && Number.isFinite(at) ? dayOf(at) : undefined
}

/** "today", "Tue" in the last week, "Sep 22" before it: when a record was set, from today's day. */
export function setOnWords(day: string, today: string): string {
  if (day === today) return 'today'
  if (weekDays(today, day)[0] === day) return stripDayWords(day).split(' ')[0]!
  return archiveDayWords(day).split(', ')[1]!
}

/** Who's looking at the past tab, and the tag their results are asked by: none signed out. */
export function usePastViewer(): PastViewer {
  const account = useAccountId()
  const name = normalizePlayerName(usePlayerName())
  if (account === null) return { name: '', state: 'out' }
  return { name, state: account === undefined ? 'pending' : 'in' }
}
