import { getGame, isGameListed } from '../data/games'
import { formatBoard } from '../games/halffull/boardFigure'
import { gamePlayHref } from '../hooks/useHashRoute'
import { normalizePlayerName } from './leaderboard'
import { formatPercentGap } from './leaderboardFormat'
import { numberWord } from './numberWord'
import { GAMES_WITH_RECORDS, type RecordGame, type RecordSummary } from './records'
import { boardToday } from './scoreboard'

/*
 * The record books' arithmetic and words: what a record's number means (a
 * time, a count of days, a combo), how the records in a book group, whose
 * name is in the most of them, what was set lately, and which ones a player
 * is closest to taking. The pages only fetch and lay out; this says it.
 */

type RecordLike = { id: string; unit: 'ms' | 'count' }

/* ---------- a track's or a hole's record ---------- */

/**
 * The dailies' courses: each Hot Lap track keeps its fastest lap, each Ace Chase hole its fewest tries,
 * each Find the Bug day its fastest sweep and each Half Full day its closest pour, a record a track, hole
 * or day (track-3, hole-12, day-2, pour-1), named after it and kept for good from its day on. Half Full's
 * are pour-N, not day-N, because these words go by the record's id and a pour's number is a percent.
 */
const COURSE_FIRST_DAY: Partial<Record<string, string>> = {
  hotlap: '2026-09-26',
  acechase: '2026-09-25',
  findbug: '2026-09-27',
  // Half Full #1: the same day as the game's daily.ts FIRST_DAY and the API's halffull/launch.ts.
  halffull: '2026-09-28',
}

/** Which track, hole or day a record is, or null for any other. */
export function courseNumber(record: { id: string }): number | null {
  const match = /^(?:track|hole|day|pour)-(\d+)$/.exec(record.id)
  return match ? Number(match[1]) : null
}

/** A track's or a hole's own record, rather than one of a run's. */
export function isCourseRecord(record: { id: string }): boolean {
  return courseNumber(record) != null
}

/** Whether less is better: a time, or a hole's tries. */
export function lowerIsBetter(record: RecordLike): boolean {
  return record.unit === 'ms' || record.id.startsWith('hole-')
}

/** A course's name alone, from its record's label: Seneca Glen, from #3 Seneca Glen; Mon, Sep 28, from #2 Mon, Sep 28. */
export function courseName(record: { label: string }): string {
  return record.label.replace(/^#\d+\s+/, '')
}

/** A lap to the hundredth, as Hot Lap's own boards print one: 45.18s, 1:29.78. */
function lapTime(ms: number): string {
  const hundredths = Math.round(Math.max(0, ms) / 10)
  if (hundredths < 6000) return `${(hundredths / 100).toFixed(2)}s`
  const minutes = Math.floor(hundredths / 6000)
  return `${minutes}:${((hundredths - minutes * 6000) / 100).toFixed(2).padStart(5, '0')}`
}

const tries = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'try' : 'tries'}`

/** The number of today's track, hole or day on the boards' clock, or null for a game without courses. */
export function courseToday(game: string, now = Date.now()): number | null {
  const first = COURSE_FIRST_DAY[game]
  if (!first) return null
  const [y, m, d] = first.split('-').map(Number)
  return Math.round((boardToday(now) - Date.UTC(y!, m! - 1, d!)) / 86_400_000) + 1
}

/**
 * Where a course's record is played: today's track or hole is the day's game; one whose day has gone is
 * played on its own (?track=, ?hole=), where a lap or result goes on its board and so into its record; a
 * past day (?day=) is practice.
 */
export function coursePlayHref(game: string, record: { id: string }, now = Date.now()): string | null {
  const n = courseNumber(record)
  const first = COURSE_FIRST_DAY[game]
  const today = courseToday(game, now)
  if (n == null || !first || today == null) return null
  const [y, m, d] = first.split('-').map(Number)
  if (n === today) return gamePlayHref(game)
  if (game === 'hotlap') return `${gamePlayHref(game)}?track=${n}`
  const day = new Date(Date.UTC(y!, m! - 1, d! + n - 1)).toISOString().slice(0, 10)
  // A past Find the Bug or Half Full day plays again as practice; its record was set on its day.
  if (game === 'findbug' || game === 'halffull') return `${gamePlayHref(game)}?day=${day}`
  return `${gamePlayHref(game)}?hole=day:${day}`
}

/** The books on show: every game with records, less the hidden and on-deck ones. */
export const VISIBLE_RECORD_GAMES: readonly RecordGame[] = GAMES_WITH_RECORDS.filter((g) => isGameListed(g))

function gameName(slug: string): string {
  return getGame(slug)?.name ?? slug
}

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/* ---------- a record's number ---------- */

/** A time as a person reads one: 19.3s under a minute, 2:51.1 past it. */
export function recordTime(ms: number): string {
  const tenths = Math.round(Math.max(0, ms) / 100)
  if (tenths < 600) return `${(tenths / 10).toFixed(1)}s`
  const minutes = Math.floor(tenths / 600)
  const rest = (tenths - minutes * 600) / 10
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`
}

/** What each count record counts, where the label alone doesn't say. */
const COUNT_WORDS: Record<string, [string, string]> = {
  'play-days-streak': ['day', 'days'],
  'most-coins': ['ticket', 'tickets'],
  'near-misses': ['close call', 'close calls'],
  'most-rows': ['row', 'rows'],
  'chasers-eaten': ['chaser', 'chasers'],
}

/** A record's number in its own terms: 2:51.1, ×36, 19 days, 13 in a row, 33 tickets, a lap's 45.18s, 2 tries, a pour's 91.2%. */
export function recordValue(record: RecordLike, score: number): string {
  if (record.id.startsWith('track-')) return lapTime(score)
  if (record.id.startsWith('hole-')) return tries(score)
  if (record.id.startsWith('pour-')) return formatBoard(score)
  if (record.unit === 'ms') return recordTime(score)
  if (record.id === 'highest-combo') return `×${score}`
  if (record.id === 'longest') return `length ${score}`
  const words = COUNT_WORDS[record.id]
  if (words) return `${score.toLocaleString()} ${score === 1 ? words[0] : words[1]}`
  if (record.id.endsWith('streak')) return `${score.toLocaleString()} in a row`
  return score.toLocaleString()
}

/** The number beside its own label, which already says what it counts: 46, not 46 in a row. A track or hole's label is its name, so its number says what it is. */
export function recordBrief(record: RecordLike, score: number): string {
  if (record.unit === 'ms' || record.id === 'highest-combo' || isCourseRecord(record)) return recordValue(record, score)
  return score.toLocaleString()
}

/**
 * The difference between two results, in the record's terms: 2.5s, 1 day, 3.
 * Times are taken from the tenths on show, so 3:58.9 against 3:51.2 reads
 * 7.7s, whatever the milliseconds underneath make it; a pour's the same way,
 * 91.2% against 90.8% is 0.4%.
 */
export function recordGap(record: RecordLike, a: number, b: number): string {
  if (record.id.startsWith('track-')) return lapTime(Math.abs(Math.round(a / 10) - Math.round(b / 10)) * 10)
  if (record.id.startsWith('hole-')) return tries(Math.abs(a - b))
  if (record.id.startsWith('pour-')) return formatPercentGap(a, b)
  if (record.unit === 'ms') return recordTime(Math.abs(Math.round(a / 100) - Math.round(b / 100)) * 100)
  const gap = Math.abs(a - b)
  const words = COUNT_WORDS[record.id]
  if (words) return `${gap.toLocaleString()} ${gap === 1 ? words[0] : words[1]}`
  return gap.toLocaleString()
}

/** How far a result is from the record, as a share of it, for putting the nearest first. */
function shareOff(record: RecordLike, you: number, top: number): number {
  const off = lowerIsBetter(record) ? you - top : top - you
  return off / Math.max(1, Math.abs(top))
}

/* ---------- a book ---------- */

export type RecordKind = 'course' | 'streaks' | 'run' | 'clock'

/**
 * A track's or hole's own record is a course's; streaks carry on across runs or within one; the clock is
 * time to a milestone; the rest are the most in a run.
 */
export function recordKind(record: RecordLike): RecordKind {
  if (isCourseRecord(record)) return 'course'
  if (record.id.endsWith('streak')) return 'streaks'
  if (record.unit === 'ms') return 'clock'
  return 'run'
}

type ClockBook = { title: string; sub: string; short: (label: string) => string }

const CLOCKS: Partial<Record<string, ClockBook>> = {
  asteroids: {
    title: 'Wave clears',
    sub: 'How fast each wave has been cleared, timed from the wave’s start.',
    short: (label) => label.replace(/ clear$/, ''),
  },
  snake: {
    title: 'Fastest to length',
    sub: 'From the start of a run to each length.',
    short: (label) => label.replace(/^Fastest to length/, 'Length'),
  },
  crosswalk: {
    title: 'Fastest to rows',
    sub: 'From the start of a run to each row milestone.',
    short: (label) => `${label.replace(/^Fastest to /, '')} rows`,
  },
}

const GROUPS: Record<RecordKind, { title: string; sub: string }> = {
  course: { title: 'Course records', sub: 'The best on each one, from its day on.' },
  streaks: { title: 'Streaks', sub: 'Days played in a row, and strong runs in a row.' },
  run: { title: 'Best in a run', sub: 'The most anyone has managed in a single run.' },
  clock: { title: 'Against the clock', sub: 'The fastest times.' },
}

/** A daily's own courses: each track's fastest lap, or each hole's fewest tries. */
const COURSES: Partial<Record<string, { title: string; sub: string }>> = {
  hotlap: {
    title: 'Track records',
    sub: 'Each track’s fastest lap. You can still take one on a past track.',
  },
  acechase: {
    title: 'Hole records',
    sub: 'Each hole’s fewest tries.',
  },
  findbug: {
    title: 'Day records',
    sub: 'Each day’s fastest sweep of its five scenes.',
  },
  halffull: {
    title: 'Day records',
    sub: 'Each day’s closest pour.',
  },
}

export type RecordGroup = {
  kind: RecordKind
  title: string
  sub: string
  records: RecordSummary[]
  /** A shorter label for a record inside its group: Wave 9, not Wave 9 clear. */
  short: (label: string) => string
}

/** A record's label among its neighbours, where they say the rest: Wave 9, not Wave 9 clear. */
export function recordShortLabel(game: string, record: RecordLike & { label: string }): string {
  const clock = recordKind(record) === 'clock' ? CLOCKS[game] : undefined
  return clock ? clock.short(record.label) : record.label
}

/**
 * A book's records in its groups: a daily's tracks or holes (the newest first), then streaks, best in a
 * run, and the clock.
 */
export function recordGroups(game: string, records: RecordSummary[]): RecordGroup[] {
  const order: RecordKind[] = ['course', 'streaks', 'run', 'clock']
  return order
    .map((kind) => {
      const named = kind === 'clock' ? CLOCKS[game] : kind === 'course' ? COURSES[game] : undefined
      const mine = records.filter((r) => recordKind(r) === kind)
      return {
        kind,
        title: named?.title ?? GROUPS[kind].title,
        sub: named?.sub ?? GROUPS[kind].sub,
        records: kind === 'course' ? mine.sort((a, b) => (courseNumber(b) ?? 0) - (courseNumber(a) ?? 0)) : mine,
        short: kind === 'clock' ? (CLOCKS[game]?.short ?? ((label: string) => label)) : (label: string) => label,
      }
    })
    .filter((group) => group.records.length > 0)
}

/**
 * The record on a book's cover: the game's own before the streaks every book
 * has, and among times the hardest milestone. A daily's is its newest track
 * or hole with a name on it.
 */
export function coverRecord(records: RecordSummary[]): RecordSummary | null {
  const held = records.filter((r) => r.top)
  const courses = held
    .filter((r) => recordKind(r) === 'course')
    .sort((a, b) => (courseNumber(b) ?? 0) - (courseNumber(a) ?? 0))
  const runs = held.filter((r) => recordKind(r) === 'run')
  const own = held.filter(
    (r) => recordKind(r) === 'streaks' && r.id !== 'play-days-streak' && r.id !== 'threshold-streak',
  )
  const clocks = held.filter((r) => recordKind(r) === 'clock').reverse()
  const threshold = held.filter((r) => r.id === 'threshold-streak')
  for (const pool of [courses, runs, own, clocks, threshold, held]) {
    if (pool[0]) return pool[0]
  }
  return null
}

/** How many records each player holds, most first. */
export function holderCounts(records: RecordSummary[]): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const r of records) {
    if (!r.top) continue
    const name = normalizePlayerName(r.top.name)
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/** How many books each player's name is in, for the line under it in the standings. */
export function booksHeld(books: { records: RecordSummary[] }[]): Map<string, number> {
  const held = new Map<string, number>()
  for (const { records } of books) {
    const names = new Set(records.filter((r) => r.top).map((r) => normalizePlayerName(r.top!.name)))
    for (const name of names) held.set(name, (held.get(name) ?? 0) + 1)
  }
  return held
}

/** Who holds a book: its main holder, or how many share it when nobody holds more than one. */
export function bookHolders(records: RecordSummary[]): string {
  const holders = holderCounts(records)
  if (!holders.length) return 'Nobody yet'
  const [first] = holders
  if (first.count === 1 && holders.length > 1) return `${holders.length} different holders`
  return `${first.name} holds ${first.count}`
}

/* ---------- headlines ---------- */

/** The headline over every book, with the name apart so it can wear the gold. */
export function booksHeadline(records: RecordSummary[]): { name: string; rest: string } {
  const holders = holderCounts(records)
  const total = records.length
  const [first, second] = holders
  if (!first) return { name: '', rest: 'The books are waiting for their first names.' }
  if (second && second.count === first.count) {
    return { name: '', rest: `${first.name} and ${second.name} hold ${first.count} records each, of the ${total}.` }
  }
  return { name: first.name, rest: ` holds ${first.count} of the ${total} records.` }
}

/** The headline over one game's book. */
export function bookHeadline(game: string, records: RecordSummary[]): { name: string; rest: string } {
  const name = gameName(game)
  const total = records.length
  const holders = holderCounts(records)
  const [first] = holders
  if (!first) return { name: '', rest: `Nobody’s name is in the ${name} book yet.` }
  if (first.count === total) return { name: first.name, rest: ` holds every one of the ${total} ${name} records.` }
  if (first.count === 1 && holders.length > 1) {
    return {
      name: '',
      rest: `${capital(numberWord(holders.length))} players share the ${total} ${name} records.`,
    }
  }
  return { name: first.name, rest: ` holds ${first.count} of the ${total} ${name} records.` }
}

/** The line under a book's headline: how much of it is written, and what it keeps. */
export function bookLede(game: string, records: RecordSummary[]): string {
  const held = records.filter((r) => r.top).length
  const kinds = recordGroups(game, records).map((g) => g.kind)
  const parts: Record<RecordKind, string> = {
    course:
      game === 'hotlap'
        ? 'fastest lap of every track'
        : game === 'acechase'
          ? 'fewest tries at every hole'
          : game === 'findbug'
            ? 'fastest sweep of every day'
            : game === 'halffull'
              ? 'closest pour of every day'
              : 'best on every course',
    clock: (CLOCKS[game]?.title ?? 'fastest times').toLowerCase(),
    run: 'best single runs',
    streaks: 'longest streaks',
  }
  const order: RecordKind[] = ['course', 'clock', 'run', 'streaks']
  const named = order.filter((k) => kinds.includes(k)).map((k) => parts[k])
  const list = named.length > 1 ? `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}` : named[0]
  const written =
    held === records.length ? 'Every one has a name in ink.' : `${held} of ${records.length} have a name in ink.`
  return `${written} The ${list}, with a name beside each until someone beats it.`
}

/* ---------- you, and what's new ---------- */

export type ClosestRecord = {
  game: string
  record: RecordSummary
  /** 2.5s off REESE, 1 short of TJ’s 11 in a row, or Tied with SAUL. */
  off: string
}

/** The records a player is nearest to taking, nearest first. */
export function closestToInk(books: { game: string; records: RecordSummary[] }[], limit = 3): ClosestRecord[] {
  const near: (ClosestRecord & { share: number })[] = []
  for (const { game, records } of books) {
    for (const record of records) {
      const you = record.you
      const top = record.top
      if (!you || !top || you.rank <= 1) continue
      const gap = recordGap(record, you.score, top.score)
      near.push({
        game,
        record,
        share: shareOff(record, you.score, top.score),
        off:
          you.score === top.score
            ? `Tied with ${top.name}`
            : lowerIsBetter(record)
              ? `${gap} off ${top.name}`
              : `${gap} short of ${top.name}’s ${recordValue(record, top.score)}`,
      })
    }
  }
  return near.sort((a, b) => a.share - b.share).slice(0, limit)
}

export type InkEntry = {
  name: string
  game: string
  at: number
  /** Crumbs in a row, 46 — or, for a player's day of several: 7 records, highest combo among them. */
  text: string
}

function dayOf(at: number): string {
  const d = new Date(at)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/** The newest names in the books: one line per player's day on a game, newest first. */
export function latestInk(books: { game: string; records: RecordSummary[] }[], limit = 6): InkEntry[] {
  const days = new Map<string, { name: string; game: string; records: RecordSummary[]; at: number }>()
  for (const { game, records } of books) {
    for (const record of records) {
      if (!record.top) continue
      const name = normalizePlayerName(record.top.name)
      const key = `${name}|${game}|${dayOf(record.top.at)}`
      const day = days.get(key) ?? { name, game, records: [], at: 0 }
      day.records.push(record)
      day.at = Math.max(day.at, record.top.at)
      days.set(key, day)
    }
  }
  return [...days.values()]
    .sort((a, b) => b.at - a.at)
    .slice(0, limit)
    .map(({ name, game, records, at }) => {
      if (records.length === 1) {
        const [only] = records
        return { name, game, at, text: `${only.label}, ${recordBrief(only, only.top!.score)}` }
      }
      const pick = records.find((r) => recordKind(r) !== 'clock') ?? records[0]
      return { name, game, at, text: `${records.length} records, ${pick.label.toLowerCase()} among them` }
    })
}
