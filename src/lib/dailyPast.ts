import type { ReactNode } from 'react'
import { isRankedGame } from '../data/games'
import { useAccountId } from '../hooks/useAccountId'
import { usePlayerName } from '../hooks/usePlayerName'
import { dayBefore } from './archive'
import { bestWord, dailyWords, type PastKind } from './dailyWords'
import { api, normalizePlayerName } from './leaderboard'

/*
 * The past tab of a daily's page (components/DailyPastTab.tsx): every course before today's, newest
 * first, each a card with how it went on its day (its Ranked board, the day's final one) and, for a game
 * whose past courses keep boards of their own (the ranked dailies'), its All time board.
 * A card's boards open in a panel, the top five and you; the way of it all is in "How past tracks work".
 * Each game says what its courses are in a source (components/archive/*Archive.tsx); what's the same for
 * every game is here.
 */

/** A result on a course's own board, as the board scores it (Ace Chase's is a million less the tries). */
export type CourseFigure = { name: string; score: number; avatarId?: string }

/** A past course's All time board, as its card shows it: its record, how many are on it, and your best and place. */
export type CourseBoard = {
  record: CourseFigure | null
  players: number
  you: { score: number; place: number } | null
}

/** One of a course's boards opened in its panel: the top few and where you stand. */
export type CourseTop = {
  /** `place` when the API says it; else the list's order is the place. */
  top: (CourseFigure & { place?: number })[]
  players: number
  you: { score: number; place: number } | null
}

/** A past day's Ranked board opened in its panel: its top few, you, and whether it counted toward rank. */
export type DayTop = CourseTop & { counted: boolean }

/** How many of a board its panel shows, over you. */
export const BOARD_TOP = 5

/**
 * The anchor that opens a past day's board page (components/DayBoard.tsx) at the course's All time board,
 * Hot Lap's track or Ace Chase's hole, rather than its day's. A hash, as the page's address keeps no query.
 */
export const COURSE_BOARD_ANCHOR = 'course-board'

type RawDayBoard = {
  day?: string
  counted?: boolean
  total: number
  entries: { name: string; score: number; place?: number; avatarId?: string }[]
  you: { score: number; place: number } | null
}

/**
 * A past day's Ranked board, its top five and `name`'s place (GET /leaderboards/:game?period=daily&day=):
 * one row a player, in the order the day's board had them when it ended. Over everyone, as a card's
 * Ranked line is (the API's days), never the group the boards are looking at.
 */
export async function fetchDayTop(slug: string, day: string, name: string): Promise<DayTop> {
  const params = new URLSearchParams({ period: 'daily', day, limit: String(BOARD_TOP) })
  const who = normalizePlayerName(name)
  if (who) params.set('name', who)
  const board = await api<RawDayBoard>(`/leaderboards/${encodeURIComponent(slug)}?${params.toString()}`)
  // An API from before day boards answers with today's board: that's not this day's.
  if (board.day !== day) throw new Error('No board for that day')
  return {
    top: board.entries.map((e) => ({
      name: normalizePlayerName(e.name),
      score: e.score,
      ...(e.place != null ? { place: e.place } : {}),
      ...(e.avatarId ? { avatarId: e.avatarId } : {}),
    })),
    players: board.total,
    you: board.you,
    counted: board.counted !== false,
  }
}

/** Who's looking: signed in, signed out, or not known yet (a session that hasn't said whose it is). */
export type PastViewer = { name: string; state: 'in' | 'out' | 'pending' }

/** One daily's past courses: what each is, how to play it, and its All time board if it keeps one. */
export type PastSource = {
  slug: string
  /** Today's course's day, YYYY-MM-DD, on the game's own clock. */
  today: string
  /** The game's first day. */
  first: string
  /** What a card's id is made of, after "course-": a track's or hole's number, or the day. */
  anchor: (day: string) => string
  /** The play page for a past course. */
  playHref: (day: string) => string
  /** A card's title, "#3 Seneca Glen": cheap, so every card has its name from the start. */
  title: (day: string) => string
  /** A course's picture, filling its box (2:1 on a card), drawn as the card comes near. */
  art: (day: string) => ReactNode
  /** For a game whose past courses keep boards of their own: their All time boards. */
  boards?: {
    /** Each past course's board by its day; null while they're asked, or when they couldn't be had. */
    rows: ReadonlyMap<string, CourseBoard> | null
    /** The boards couldn't be had (rows stays null), and asking again. */
    failed?: boolean
    retry?: () => void
    /** One course's board, its top five and `name`'s place, for its panel. */
    fetchTop: (day: string, name: string) => Promise<CourseTop>
  }
  /** A course takes only a player's first result (Ace Chase): with one there already, playing it is practice. */
  firstResultOnly?: boolean
  /** Whether this device knows of a result of the viewer's on a course that the API may not have yet. */
  resultHere?: (day: string) => boolean
}

/** Cards are paged in this many at a time: three rows of four. */
export const PAST_PAGE = 12

/** Every past course's day, newest first. */
export function pastDays(today: string, first: string): string[] {
  const out: string[] = []
  for (let day = dayBefore(today); day >= first; day = dayBefore(day)) out.push(day)
  return out
}

const stripFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', day: 'numeric' })

/** "Sat 26": a day in a strip of days. */
export function stripDayWords(day: string): string {
  const parts = stripFormat.formatToParts(new Date(`${day}T12:00:00Z`))
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const date = parts.find((p) => p.type === 'day')?.value ?? ''
  return `${weekday} ${date}`
}

/** "raced", "played", "poured", "rolled", "flew": the game's verb, done. */
export function verbDone(slug: string): string {
  const verb = dailyWords(slug).verb.toLowerCase()
  if (verb === 'fly') return 'flew'
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

function lowerWord(word: string): string {
  return word.charAt(0).toLowerCase() + word.slice(1)
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

/** Who's looking at the past tab, and the tag their results are asked by: none signed out. */
export function usePastViewer(): PastViewer {
  const account = useAccountId()
  const name = normalizePlayerName(usePlayerName())
  if (account === null) return { name: '', state: 'out' }
  return { name, state: account === undefined ? 'pending' : 'in' }
}

/** A card's practice mark's tip: what a run does on a course that keeps no board for it. */
export const PRACTICE_TIP = 'Practice: nothing is saved.'

/** A line of "How past tracks work", with its mark: start one, where it goes, what counts. */
export type PastHowLine = { mark: 'play' | 'allTime' | 'practice' | 'ranked' | 'fun'; text: string }

/**
 * "How past tracks work", in three short lines: any past course can be played; where a run on one goes
 * (a board game's All time board, or nowhere, as practice); and that only today's counts toward rank, or,
 * on a daily just for fun (data/games.ts Game.ranked), that today's is your result and ranks nobody.
 */
export function pastHowLines(slug: string): PastHowLine[] {
  const words = dailyWords(slug)
  let goes: PastHowLine
  if (words.past === 'practice') goes = { mark: 'practice', text: `${words.pastTab} are practice: nothing is saved.` }
  else if (slug === 'acechase') goes = { mark: 'allTime', text: 'Your first bullseye goes on its All time board, then it’s practice.' }
  else goes = { mark: 'allTime', text: `Your best ${bestWord(slug)} goes on its All time board.` }
  return [
    { mark: 'play', text: `${words.verb} any past ${words.course}.` },
    goes,
    isRankedGame(slug)
      ? { mark: 'ranked', text: `Only ${lowerWord(words.today)} counts toward your rank.` }
      : { mark: 'fun', text: `${words.today} is your result. It’s just for fun: nobody is ranked.` },
  ]
}

/** "How past tracks work": its panel's title, and its ⓘ's name. */
export function pastHowTitle(slug: string): string {
  return `How ${dailyWords(slug).pastTab.toLowerCase()} work`
}

/**
 * The one line in a course's boards panel on what playing it now does: where the run goes, or that it's
 * practice (signed out, a board game's is, as is a hole you have a result on already).
 */
export function pastPlayNote(slug: string, kind: PastKind, signedIn: boolean): { mark: 'allTime' | 'practice'; text: string } {
  const words = dailyWords(slug)
  // The board's name keeps to one line.
  const allTime = 'All time'
  if (kind === 'board') {
    const result = slug === 'acechase' ? 'first bullseye' : `best ${bestWord(slug)}`
    return { mark: 'allTime', text: `${words.verb} it now: your ${result} goes on ${allTime}, not your rank.` }
  }
  if (words.past === 'board') {
    return {
      mark: 'practice',
      text:
        signedIn && slug === 'acechase'
          ? `${words.verb} it again as practice: your first bullseye stands.`
          : `${words.verb} it now as practice: sign in to go on ${allTime}.`,
    }
  }
  return { mark: 'practice', text: `${words.verb} it now as practice: nothing is saved.` }
}
