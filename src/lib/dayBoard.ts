import { gamePlayHref } from '../hooks/useHashRoute'
import type { Viewer } from './deviceRuns'

/*
 * A daily's board on one past day (/leaderboards/<game>/day/<YYYY-MM-DD>, components/DayBoard.tsx): how the
 * day finished, in full, the board its places counted from, with the day before and after a tap away. For
 * Hot Lap and Ace Chase the course's own board is beside it: every lap or first bullseye on it since, which
 * isn't anyone's rank. What each game's course is called, where it's played again and its first day come
 * with the game's plan, so only the game on show loads its own.
 */

/** A player on a course's own board, at their best there (a hole's first bullseye as the days score it). */
export type CourseBoardRow = { name: string; score: number; place: number; at?: number; avatarId?: string }

/** A page of a course's own board: how many are on it, the rows asked for, and you. */
export type CourseBoardPage = {
  total: number
  entries: CourseBoardRow[]
  you: { score: number; place: number } | null
}

/** A daily's past course, as its day's board page needs it. */
export type DayCourse = {
  /** The game's first day, YYYY-MM-DD: there's no board before it. */
  first: string
  /** Today on the game's clock (New York). */
  today: () => string
  /** Its name, as its row on the past tab has it: "#3 Seneca Glen", "Wanted #2", "Pour #1". */
  title: (day: string) => string
  /** What its row on the past tab is known by, after "course-" (dailyTabHref's `course`). */
  anchor: (day: string) => string
  /** Where it's played again. */
  playHref: (day: string) => string
  /** A page of the course's own board, for a game whose courses keep one (Hot Lap's tracks, Ace Chase's holes). */
  board?: (day: string, name: string, page: { offset: number; limit: number }) => Promise<CourseBoardPage>
  /** Ace Chase: this device holds the viewer's result on the hole, which the API may not have yet. */
  resultHere?: (day: string, viewer: Viewer) => boolean
}

const LOADERS: Record<string, () => Promise<DayCourse>> = {
  async hotlap() {
    const [{ FIRST_DAY, dailyTrack, trackDay, trackNumber }, { fetchTrackBoard }] = await Promise.all([
      import('../games/hotlap/daily'),
      import('./trackBoards'),
    ])
    return {
      first: FIRST_DAY,
      today: () => trackDay(),
      title: (day) => `#${trackNumber(day)} ${dailyTrack(day).name}`,
      anchor: (day) => String(trackNumber(day)),
      playHref: (day) => `${gamePlayHref('hotlap')}?track=${trackNumber(day)}`,
      async board(day, name, page) {
        const b = await fetchTrackBoard(trackNumber(day), name, page)
        const from = b.offset ?? page.offset
        return {
          // An API from before boards were paged sends its top ten whatever's asked: that's all there is to page.
          total: b.total ?? b.entries.length,
          entries: b.entries.map((e, i) => ({ ...e, place: e.place ?? from + i + 1 })),
          you: b.you,
        }
      },
    }
  },
  async acechase() {
    const [{ DAILY_EPOCH, dailyNumber }, { dailyDay, todaysHole }, { fetchHoleBoard, solvedHere }, { ACECHASE_SCORE_BASE }] = await Promise.all([
      import('../games/acechase/daily'),
      import('./dailyHole'),
      import('./pastHoles'),
      import('../games/acechase/score'),
    ])
    return {
      first: DAILY_EPOCH,
      today: () => dailyDay(),
      title: (day) => {
        const hole = todaysHole(day)
        return `#${hole.n} ${hole.def.name}`
      },
      anchor: (day) => String(dailyNumber(day)),
      playHref: (day) => `${gamePlayHref('acechase')}?hole=day:${day}`,
      // A result in tries, scored as the days' boards score it: a million less the tries.
      async board(day, name, page) {
        const b = await fetchHoleBoard(day, name, page)
        const from = b.offset ?? page.offset
        return {
          total: b.total ?? b.entries.length,
          entries: b.entries.map((e, i) => ({
            name: e.name,
            score: ACECHASE_SCORE_BASE - e.tries,
            place: e.place ?? from + i + 1,
            ...(e.at != null ? { at: e.at } : {}),
            ...(e.avatarId ? { avatarId: e.avatarId } : {}),
          })),
          you: b.you ? { score: ACECHASE_SCORE_BASE - b.you.tries, place: b.you.place } : null,
        }
      },
      resultHere: (day, viewer) => viewer !== undefined && solvedHere(day, viewer) != null,
    }
  },
  async findbug() {
    const { FIRST_DAY, bugDay, dayNumber } = await import('../games/findbug/daily')
    return {
      first: FIRST_DAY,
      today: () => bugDay(),
      title: (day) => `Wanted #${dayNumber(day)}`,
      anchor: (day) => day,
      playHref: (day) => `${gamePlayHref('findbug')}?day=${day}`,
    }
  },
  async halffull() {
    const { FIRST_DAY, pourDay, dayNumber } = await import('../games/halffull/daily')
    return {
      first: FIRST_DAY,
      today: () => pourDay(),
      title: (day) => `Pour #${dayNumber(day)}`,
      anchor: (day) => day,
      playHref: (day) => `${gamePlayHref('halffull')}?day=${day}`,
    }
  },
  async marblerun() {
    const { FIRST_DAY, courseDay, courseNumber, dailyCourse } = await import('../games/marblerun/daily')
    return {
      first: FIRST_DAY,
      today: () => courseDay(),
      title: (day) => `#${courseNumber(day)} ${dailyCourse(day).name}`,
      anchor: (day) => day,
      playHref: (day) => `${gamePlayHref('marblerun')}?day=${day}`,
    }
  },
  async lander() {
    const { FIRST_DAY, caveDay, caveNumber, dailyCave } = await import('../games/lander/daily')
    return {
      first: FIRST_DAY,
      today: () => caveDay(),
      title: (day) => `#${caveNumber(day)} ${dailyCave(day).name}`,
      anchor: (day) => day,
      playHref: (day) => `${gamePlayHref('lander')}?day=${day}`,
    }
  },
}

const loaded = new Map<string, Promise<DayCourse>>()

/** A daily's courses, loaded once with its plan. Rejects for a game that isn't a daily. */
export function loadDayCourse(slug: string): Promise<DayCourse> {
  const load = LOADERS[slug]
  if (!load) return Promise.reject(new Error(`${slug} isn’t a daily`))
  let hit = loaded.get(slug)
  if (!hit) {
    // A chunk that didn't come (offline, a release renamed it) is asked for again next time.
    hit = load().catch((err: unknown) => {
      loaded.delete(slug)
      throw err
    })
    loaded.set(slug, hit)
  }
  return hit
}

/** The day after a day, both as YYYY-MM-DD. */
export function dayAfter(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().slice(0, 10)
}

const timeFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })

/** "8:43 pm": when in its day a run was set, on the boards' clock. */
export function timeOfDay(at: number): string {
  try {
    return timeFormat.format(new Date(at)).replace(/\s?([AP])M$/, (_, m: string) => ` ${m.toLowerCase()}m`)
  } catch {
    return ''
  }
}

const dateFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' })

/** "Sep 29": the day a result on a course's board was set, on the boards' clock. */
export function dateOf(at: number): string {
  try {
    return dateFormat.format(new Date(at))
  } catch {
    return ''
  }
}
