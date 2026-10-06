import { useEffect, useReducer, useState } from 'react'
import { getGame } from '../data/games'
import {
  bugDay,
  DAY_SCENES,
  dayNumber as wantedNumber,
  dayRun,
  sceneMark,
  subscribeBugDay,
  wantedNames,
  dayWanted,
} from '../games/findbug/daily'
import { findbugBoardScore, formatFindbugMs } from '../games/findbug/score'
import { dayDone as pourDone, dayRun as pourRun, dayTag as pourTag, pourDay, subscribePourDay } from '../games/halffull/daily'
import { dayPlan, ROUNDS } from '../games/halffull/plan'
import { glassNames } from '../games/halffull/planSvg'
import { formatBoard, judgeLevels, markFor, tierFor } from '../games/halffull/score'
import { dailyTrack, trackDay } from '../games/hotlap/daily'
import { keptLap } from '../games/hotlap/lap'
import { formatLap } from '../games/hotlap/score'
import { caveDay, dailyCave } from '../games/lander/daily'
import { keptRun as keptCaveRun } from '../games/lander/runStore'
import { formatRun as formatCaveRun } from '../games/lander/score'
import { courseDay, dailyCourse } from '../games/marblerun/daily'
import { keptRun } from '../games/marblerun/runStore'
import { formatRun } from '../games/marblerun/score'
import { dailyHills, hillsDay } from '../games/swoop/daily'
import { keptRun as keptHillsRun } from '../games/swoop/runStore'
import { formatRun as formatHillsRun } from '../games/swoop/score'
import { todayShareHref } from '../hooks/useHashRoute'
import { medalFor, paceMsOf, type Medal } from '../lib/raceMedals'
import { dailyDay, dayProgress, subscribeDaily, syncDaily, todaysHole } from '../lib/dailyHole'
import type { Viewer } from '../lib/deviceRuns'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { numberWord } from '../lib/numberWord'
import {
  dayMarks,
  liveDailies,
  subscribeToday,
  TODAY_KEEP,
  todayRule,
  todayServer,
  todayShareText,
  type TodayDaily,
  type TodayKey,
  type TodayServer,
} from '../lib/today'

/*
 * Today's ticket as the viewer has it (lib/today.ts): the day's live dailies as punches, and where the day
 * stands (how many are punched, whether it's kept or a Full ticket, the streak with it, the day's share).
 * The Today page's ticket (TodayCard) and the home page's Today row (HomeToday) both draw from it, so the
 * two always agree. It comes in the chunk of whichever shows it, with the dailies' plans.
 */

export type Punch = {
  key: TodayKey
  slug: TodayDaily['slug']
  /** The short name a phone's punch shows: Hole, Track, Bugs, Pour, Marble, Cave. */
  label: string
  kicker: string
  game: string
  /** The day's own: the hole's name, the track's, the bugs wanted, the glasses, the course's name, the cave's. */
  title: string
  done: boolean
  /** Your result, in words, once there is one. */
  mine: string | null
  /** The result on the punch itself, short: "3 tries", "58.41s", "91.2%". */
  short: string | null
  /** Left halfway, and where to carry on from ("Carry on, glass 3 of 5"); null if not started. */
  carry: string | null
  /** The day's line for the share. */
  share: string | null
  /** In its first week on the ticket. */
  fresh: boolean
  /** A racing daily's medal for the day's best against its blue (lib/raceMedals.ts), once it has one. */
  medal?: Medal | null
}

/** A board score's time in ms: the racing dailies keep a million less the ms (their score.ts). */
const msOfScore = (score: number) => 1_000_000 - score

/** A daily's punch, apart from what every punch has from TODAY_DAILIES (its key, game and label, and whether it's new). */
type PunchDay = Omit<Punch, 'key' | 'slug' | 'label' | 'game' | 'fresh'>

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
/** How long a daily is new on the ticket, in days. */
const FRESH_DAYS = 7

export function dayParts(day: string): { weekday: number; date: Date } {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1))
  return { weekday: date.getUTCDay(), date }
}

/** "Monday, Sep 28". */
export function longDate(day: string): string {
  return dayParts(day).date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** "Monday, September 28": the Today page's own, and a day of its calendar said aloud. */
export function fullDate(day: string): string {
  return dayParts(day).date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

/** "Mon, Sep 28". */
export function shortDate(day: string): string {
  return dayParts(day).date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function daysBetween(from: string, to: string): number {
  return Math.round((dayParts(to).date.getTime() - dayParts(from).date.getTime()) / 86_400_000)
}

/** The day `n` days after `day` (before, for a negative `n`), YYYY-MM-DD. */
export function addDays(day: string, n: number): string {
  return new Date(dayParts(day).date.getTime() + n * 86_400_000).toISOString().slice(0, 10)
}

/** The link a day's share carries: the day's own page, which opens the Today page and unfurls into the day's card. */
export function todayShareUrl(day: string): string {
  return `${window.location.origin}${todayShareHref(day)}`
}

const triesWords = (n: number) => `${n} ${n === 1 ? 'try' : 'tries'}`

export const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** What the streak needs next, from the streak before today: the day kept, then (with more than three live) a Full ticket. */
export function streakLine({ before, done, rule }: Pick<Ticket, 'before' | 'done' | 'rule'>): string {
  const n = before + 1
  if (done < rule.need) {
    const left = rule.need - done
    const goal = before === 0 ? 'to start your streak' : `to make it ${n}`
    return left === 1 ? `One more ${goal}` : `${capital(numberWord(left))} to go ${goal}`
  }
  if (rule.count > TODAY_KEEP && done < rule.count) return `Kept. ${capital(numberWord(rule.count - done))} more for a Full ticket`
  return `Back tomorrow for Day ${n + 1}`
}

/*
 * Each daily's punch, for the viewer (lib/deviceRuns.ts). The account's own results (the API's) come
 * first. What this device did counts only when it's the viewer's own run: the device may hold another
 * player's, or a run played signed out that only its game can take up, and neither is ever shown as the
 * viewer's. Their own run adds to their result (each square, or a punch before the API has it), and only
 * their own half-played run says Carry on.
 */

function holePunch(day: string, server: TodayServer | null, viewer: Viewer): PunchDay {
  const hole = todaysHole(day)
  // The viewer's own run on this device only (lib/dailyHole.ts): never another account's, nor, signed in, one played signed out.
  const progress = dayProgress(day, viewer)
  const tries = server?.results.hole?.tries ?? progress?.solved?.tries ?? null
  const done = tries != null || Boolean(server?.done.hole)
  const tried = done ? 0 : (progress?.tries ?? 0)
  return {
    kicker: `Today’s Hole #${hole.n}`,
    title: hole.def.name,
    done,
    mine: tries != null ? (tries === 1 ? 'Bullseye, first try' : `Bullseye in ${tries}`) : done ? 'Done' : null,
    short: tries != null ? triesWords(tries) : null,
    carry: tried > 0 ? `Carry on, ${triesWords(tried)} in` : null,
    share: tries != null ? `${hole.def.name} in ${tries}` : null,
  }
}

function trackPunch(server: TodayServer | null, viewer: Viewer): PunchDay {
  const tday = trackDay()
  const track = dailyTrack(tday)
  const serverLap = server?.results.track?.score ?? null
  // The viewer's own best lap on this device (never another player's, nor one driven signed out while they're signed in).
  const lapTime = keptLap(tday, viewer)?.time ?? null
  const lapWords = serverLap != null ? formatLeaderboardScore('hotlap', serverLap) : lapTime != null ? formatLap(lapTime) : null
  const done = lapWords != null || Boolean(server?.done.track)
  return {
    kicker: `Today’s Track #${track.n}`,
    title: track.name,
    done,
    mine: lapWords ? `${lapWords} lap` : done ? 'Done' : null,
    short: lapWords,
    carry: null,
    share: lapWords ? `${track.name} ${lapWords}` : null,
    medal: medalFor('hotlap', paceMsOf(track.pace), serverLap != null ? msOfScore(serverLap) : lapTime != null ? Math.round(lapTime * 1000) : null),
  }
}

function wantedPunch(server: TodayServer | null, viewer: Viewer): PunchDay {
  const bday = bugDay()
  const serverRun = server?.results.wanted?.score ?? null
  const device = dayRun(bday, viewer)
  const deviceRun = device?.result ?? null
  // The device's run tells more (what was found, each scene's square), when it's the same run as the API's.
  const run = deviceRun && (serverRun == null || findbugBoardScore(deviceRun.ms) === serverRun) ? deviceRun : null
  const runTime = serverRun != null ? formatLeaderboardScore('findbug', serverRun) : run ? formatFindbugMs(run.ms) : null
  const found = run?.found
  const wanted = dayWanted(bday)
  const marks = run?.times?.length ? `${run.times.map(sceneMark).join('')} ` : ''
  const done = runTime != null || Boolean(server?.done.wanted)
  // A run begun here and left before its end.
  const started = !done && device != null && deviceRun == null
  const at = started ? device?.at : undefined
  return {
    kicker: `Today’s Wanted #${wantedNumber(bday)}`,
    title: wantedNames(wanted),
    done,
    mine: runTime ? `${runTime}${found != null ? ` · found ${found} of ${wanted.length}` : ''}` : done ? 'Done' : null,
    short: runTime,
    carry: started ? (at ? `Carry on, scene ${Math.min(DAY_SCENES, at.index + 1)} of ${DAY_SCENES}` : 'Carry on') : null,
    share: runTime ? `${marks}${runTime}` : null,
  }
}

function pourPunch(server: TodayServer | null, viewer: Viewer): PunchDay {
  const pday = pourDay()
  // Its title names the day's glasses, so the day's plan is built (once a page) whenever the pour is on the ticket.
  const plan = dayPlan(pday)
  const serverPour = server?.results.pour?.score ?? null
  // The viewer's own pour here, if any: never another account's, nor one poured signed out (only the game takes that up).
  const run = pourRun(pday, viewer)
  const levels = run?.levels ?? []
  const judged = levels.length >= ROUNDS ? judgeLevels(plan, levels.slice(0, ROUNDS)) : null
  // The device's pours tell more (each glass's square, the tier), when they're the same pour as the API's.
  const same = judged && (serverPour == null || judged.board === serverPour) ? judged : null
  const score = serverPour ?? same?.board ?? run?.board ?? null
  const done = score != null || Boolean(server?.done.pour) || pourDone(run)
  return {
    kicker: `Today’s Pour ${pourTag(pday)}`,
    title: glassNames(plan),
    done,
    mine: score != null ? `${formatBoard(score)}${same ? `, ${tierFor(same.day)}` : ''}` : done ? 'Done' : null,
    short: score != null ? formatBoard(score) : null,
    carry: !done && levels.length > 0 ? `Carry on, glass ${Math.min(ROUNDS, levels.length + 1)} of ${ROUNDS}` : null,
    share: score != null ? `${same ? `${same.scores.map(markFor).join('')} ` : ''}${formatBoard(score)}` : null,
  }
}

function coursePunch(server: TodayServer | null, viewer: Viewer): PunchDay {
  const cday = courseDay()
  const course = dailyCourse(cday)
  const serverRun = server?.results.course?.score ?? null
  // The viewer's own best run on this device (never another player's, nor one rolled signed out while they're signed in).
  const runTime = keptRun(cday, viewer)?.time ?? null
  const runWords = serverRun != null ? formatLeaderboardScore('marblerun', serverRun) : runTime != null ? formatRun(runTime) : null
  const done = runWords != null || Boolean(server?.done.course)
  return {
    kicker: `Today’s Course #${course.n}`,
    title: course.name,
    done,
    mine: runWords ? `${runWords} run` : done ? 'Done' : null,
    short: runWords,
    carry: null,
    share: runWords ? `${course.name} ${runWords}` : null,
    medal: medalFor('marblerun', paceMsOf(course.pace), serverRun != null ? msOfScore(serverRun) : runTime != null ? Math.round(runTime * 1000) : null),
  }
}

function cavePunch(server: TodayServer | null, viewer: Viewer): PunchDay {
  const vday = caveDay()
  const cave = dailyCave(vday)
  const serverRun = server?.results.cave?.score ?? null
  // The viewer's own best run on this device (never another player's, nor one flown signed out while they're signed in).
  const runTime = keptCaveRun(vday, viewer)?.time ?? null
  const runWords = serverRun != null ? formatLeaderboardScore('lander', serverRun) : runTime != null ? formatCaveRun(runTime) : null
  const done = runWords != null || Boolean(server?.done.cave)
  return {
    kicker: `Today’s Cave #${cave.n}`,
    title: cave.name,
    done,
    mine: runWords ? `${runWords} run` : done ? 'Done' : null,
    short: runWords,
    carry: null,
    share: runWords ? `${cave.name} ${runWords}` : null,
    medal: medalFor('lander', paceMsOf(cave.pace), serverRun != null ? msOfScore(serverRun) : runTime != null ? Math.round(runTime * 1000) : null),
  }
}

function hillsPunch(server: TodayServer | null, viewer: Viewer): PunchDay {
  const vday = hillsDay()
  const hills = dailyHills(vday)
  const serverRun = server?.results.hills?.score ?? null
  // The viewer's own best run on this device (never another player's, nor one flown signed out while they're signed in).
  const runTime = keptHillsRun(vday, viewer)?.time ?? null
  const runWords = serverRun != null ? formatLeaderboardScore('swoop', serverRun) : runTime != null ? formatHillsRun(runTime) : null
  const done = runWords != null || Boolean(server?.done.hills)
  return {
    kicker: `Today’s Hills #${hills.n}`,
    title: hills.name,
    done,
    mine: runWords ? `${runWords} run` : done ? 'Done' : null,
    short: runWords,
    carry: null,
    share: runWords ? `${hills.name} ${runWords}` : null,
    medal: medalFor('swoop', paceMsOf(hills.pace), serverRun != null ? msOfScore(serverRun) : runTime != null ? Math.round(runTime * 1000) : null),
  }
}

function punchDay(key: TodayKey, day: string, server: TodayServer | null, viewer: Viewer): PunchDay {
  if (key === 'hole') return holePunch(day, server, viewer)
  if (key === 'track') return trackPunch(server, viewer)
  if (key === 'wanted') return wantedPunch(server, viewer)
  if (key === 'course') return coursePunch(server, viewer)
  if (key === 'cave') return cavePunch(server, viewer)
  if (key === 'hills') return hillsPunch(server, viewer)
  return pourPunch(server, viewer)
}

/** Today's ticket for the viewer: the punches, and where the day and the streak stand with them. */
export type Ticket = {
  /** The boards' day, YYYY-MM-DD. */
  day: string
  punches: Punch[]
  /** The API's word on the viewer's day, while it's today's; null signed out. */
  server: TodayServer | null
  live: TodayDaily[]
  /** How many are punched, of how many are live. */
  done: number
  total: number
  /** Every one punched. */
  all: boolean
  rule: { need: number; count: number }
  /** Whether what's punched keeps the day, and whether it's a Full ticket. */
  marks: { kept: boolean; full: boolean }
  /** The streak before today; with today, once it's kept; and the best, today's included. */
  before: number
  current: number
  best: number
  /** How many more keep the day. */
  left: number
  /** The day's share, as its Share sends it (without the link). */
  shareText: string
}

/**
 * The day's live dailies, as this device and the API have them for the viewer, kept fresh and rolled over
 * at midnight.
 */
export function useTicket(viewer: Viewer): Ticket {
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  const [day, setDay] = useState(dailyDay)
  useEffect(() => subscribeDaily(refresh), [])
  useEffect(() => subscribeBugDay(refresh), [])
  useEffect(() => subscribePourDay(refresh), [])
  useEffect(() => subscribeToday(refresh), [])
  useEffect(() => {
    void syncDaily()
  }, [day])
  useEffect(() => {
    const t = window.setInterval(() => {
      setDay(dailyDay())
      refresh()
    }, 30_000)
    return () => window.clearInterval(t)
  }, [])

  const raw = todayServer()
  const server = raw?.day === day ? raw : null
  const live = liveDailies(day, server)
  const punches = live.map((d): Punch => {
    const own = punchDay(d.key, day, server, viewer)
    return {
      key: d.key,
      slug: d.slug,
      label: d.label,
      game: getGame(d.slug)?.name ?? d.label,
      fresh: d.from ? daysBetween(d.from, day) < FRESH_DAYS : false,
      ...own,
    }
  })
  const done = punches.filter((p) => p.done).length
  const total = punches.length
  const rule = todayRule(total)
  const marks = dayMarks(done, rule)
  // The API counts today once it's in; until then this device's punches say where today stands.
  const streak = server?.streak ?? { current: 0, best: 0 }
  const before = server?.week.at(-1)?.kept ? streak.current - 1 : streak.current
  const current = before + (marks.kept ? 1 : 0)
  return {
    day,
    punches,
    server,
    live,
    done,
    total,
    all: total > 0 && done === total,
    rule,
    marks,
    before,
    current,
    best: Math.max(streak.best, current),
    left: Math.max(0, rule.need - done),
    shareText: todayShareText({
      day,
      lines: punches.map((p) => ({ key: p.key, text: p.share })),
      streak: current,
      full: marks.full,
    }),
  }
}
