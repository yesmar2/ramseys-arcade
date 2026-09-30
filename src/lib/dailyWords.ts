/**
 * The words each daily game uses for its days, in one place, so every page says them the same way:
 * the game's page and its tabs, the past days, the start and result cards, and the labels that say what
 * a run counts toward (components/RunLabel.tsx).
 *
 * Only today's course counts toward your rank. A past course is one of two things: a board of its own
 * that isn't ranked (Hot Lap's tracks; Ace Chase's holes, for a hole you didn't play on its day), or
 * practice that saves nothing (Find the Bug, Half Full, Marble Run).
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
  // A past hole's first bullseye goes on its board only if you didn't play the hole on its day; after
  // that, playing it again is practice. RunLabel takes that from its `kind`, not from here.
  acechase: {
    course: 'hole',
    today: 'Today’s hole',
    pastTab: 'Past holes',
    verb: 'Play',
    playToday: 'Play today’s hole',
    past: 'board',
    hudPast: 'Past hole · not ranked',
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
    past: 'practice',
    hudPast: 'Past course · practice',
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

/** The tabs of a daily game's page. `today` is the page itself, /games/<slug>. */
export type DailyTab = 'today' | 'past' | 'records'
