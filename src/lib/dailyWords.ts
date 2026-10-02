import { isRankedGame } from '../data/games'

/**
 * The words each daily game uses for its days, in one place, so every page says them the same way:
 * the game's page and its tabs, the past days, the start and result cards, and the labels that say what
 * a run counts toward (components/RunLabel.tsx).
 *
 * Only today's course counts toward your rank, on a daily that's ranked (Hot Lap, Marble Run, Lander); on one just
 * for fun (Ace Chase, Find the Bug, Half Full: data/games.ts Game.ranked) it's only yours. A past course is
 * one of two things: a board of its own that isn't ranked (the ranked dailies' tracks, courses and caves),
 * or practice that saves nothing (the just-for-fun dailies').
 */

/** What a run on a past course does. `board`: it goes on that course's own board, never your rank. */
export type PastKind = 'board' | 'practice'

export type DailyWords = {
  /** track, hole, day, course: what each day's puzzle is called. */
  course: string
  /** Today's track, Today's hole… */
  today: string
  /** The game page's tab of past courses: Past tracks, Past holes, Past days… */
  pastTab: string
  /** Race, Play, Pour: the verb on a button that starts a run. */
  verb: string
  /** The game page's Play, which starts today's run: "Race today’s track". */
  playToday: string
  /** What a run on a past course does. */
  past: PastKind
  /** The chip on the screen while a past course is played. */
  hudPast: string
}

export const DAILY_WORDS: Record<string, DailyWords> = {
  hotlap: {
    course: 'track',
    today: 'Today’s track',
    pastTab: 'Past tracks',
    verb: 'Race',
    playToday: 'Race today’s track',
    past: 'board',
    hudPast: 'Past track · not ranked',
  },
  // A past hole is practice: Ace Chase is just for fun, so its holes keep no boards (data/games.ts Game.ranked).
  acechase: {
    course: 'hole',
    today: 'Today’s hole',
    pastTab: 'Past holes',
    verb: 'Play',
    playToday: 'Play today’s hole',
    past: 'practice',
    hudPast: 'Past hole · practice',
  },
  findbug: {
    course: 'day',
    today: 'Today’s Wanted',
    pastTab: 'Past days',
    verb: 'Play',
    playToday: 'Find today’s bugs',
    past: 'practice',
    hudPast: 'Past day · practice',
  },
  halffull: {
    course: 'day',
    today: 'Today’s Pour',
    pastTab: 'Past days',
    verb: 'Pour',
    playToday: 'Pour today’s glasses',
    past: 'practice',
    hudPast: 'Past day · practice',
  },
  marblerun: {
    course: 'course',
    today: 'Today’s course',
    pastTab: 'Past courses',
    verb: 'Roll',
    playToday: 'Roll today’s course',
    past: 'board',
    hudPast: 'Past course · not ranked',
  },
  lander: {
    course: 'cave',
    today: 'Today’s cave',
    pastTab: 'Past caves',
    verb: 'Fly',
    playToday: 'Fly today’s cave',
    past: 'board',
    hudPast: 'Past cave · not ranked',
  },
}

const FALLBACK: DailyWords = {
  course: 'day',
  today: 'Today’s game',
  pastTab: 'Past days',
  verb: 'Play',
  playToday: 'Play today’s game',
  past: 'practice',
  hudPast: 'Past day · practice',
}

export function dailyWords(slug: string): DailyWords {
  return DAILY_WORDS[slug] ?? FALLBACK
}

/** What today's run is on a daily (components/RunLabel.tsx): it counts toward your rank, or, on one just for fun, it's yours. */
export function todayKind(slug: string): 'counts' | 'fun' {
  return isRankedGame(slug) ? 'counts' : 'fun'
}

/** The tabs of a daily game's page. `today` is the page itself, /games/<slug>. */
export type DailyTab = 'today' | 'past' | 'records'

/**
 * A past course's two boards, named the same on every page (Ramsey picked the names, 2026-09-30):
 * Ranked, the board the day it was the daily, which counted toward rank; and All time, every result on
 * the course since, which doesn't. Only the ranked dailies (Hot Lap, Marble Run, Lander) have either.
 */
export type PastBoard = 'ranked' | 'allTime'

export const BOARD_NAMES: Record<PastBoard, string> = {
  ranked: 'Ranked',
  allTime: 'All time',
}

/** What each board is, in a tooltip's few words: "Each driver’s best lap on this track, any day…". */
export function boardTip(board: PastBoard, slug: string): string {
  if (board === 'ranked') return 'The board the day it was the daily. It counted toward rank.'
  const words = dailyWords(slug)
  const what =
    slug === 'hotlap'
      ? 'Each driver’s best lap'
      : slug === 'acechase'
        ? 'Each player’s first bullseye'
        : `Each player’s best ${bestWord(slug)}`
  return `${what} on this ${words.course}, any day. Just for fun: it doesn’t count toward your rank.`
}

/** What a past course's board keeps each player's best of: Hot Lap's laps, Lander's flights, everyone else's runs. */
export function bestWord(slug: string): string {
  return slug === 'hotlap' ? 'lap' : slug === 'lander' ? 'flight' : slug === 'acechase' ? 'bullseye' : 'run'
}
