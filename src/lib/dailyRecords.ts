import { useEffect, useState } from 'react'
import { getGame } from '../data/games'
import { DAILY_EPOCH } from '../games/acechase/daily'
import { formatTries } from '../games/acechase/score'
import { DAILY_TRACKS } from '../games/hotlap/dailyPlan'
import { formatLapMs, hotlapMsFromBoardScore } from '../games/hotlap/score'
import { todaysHole } from './dailyHole'
import { BOARD_NAMES, dailyWords } from './dailyWords'
import { FIRST_RUN_DAILIES } from './gameBoard'
import { api, normalizePlayerName, type LeaderboardEntry } from './leaderboard'
import type { HoleRecordRow } from './pastHoles'
import { fetchBookGlance, PLAY_DAYS_STREAK_ID, type BookGlance } from './records'
import { headOver } from './recordBook'
import { boardToday, ordinal } from './scoreboard'
import type { TrackRecordRow } from './trackBoards'

/*
 * A daily's Records tab (components/DailyRecordsTab.tsx): only the records its boards don't already show,
 * the ones made over many days. Days played in a row (its record book's), the most days won, and for Hot
 * Lap and Ace Chase the most track or hole records held, then each track's or hole's record, which is just
 * the #1 on that course's All time board. The tab only fetches and lays out; this says it.
 *
 * Every list here shares a place between equal numbers: four players with a day each are all 1st, and the
 * line over the list says so in words.
 */

const DAY_MS = 86_400_000

/* ---------- what the API says ---------- */

/** One player on one of these records: their number, days won or records held. */
export type TallyRow = { name: string; value: number; avatarId?: string }

/** A player's own number on one, with their place and how many others have as many (when the API says). */
export type TallyYou = { value: number; place: number; tied: number | null }

export type Tally = {
  /** The first ten, most first. */
  top: TallyRow[]
  you: TallyYou | null
  /** How many are on it at all, when the API says. */
  players: number | null
  /** How many share the top number, when the API says (the top ten can't show more). */
  leaders: number | null
}

export type DailyRecordsResult = {
  daysWon: Tally & { closedDays: number | null }
  /** Hot Lap and Ace Chase: the past courses whose board each player tops, by number. */
  courseRecords: (Tally & { courses: Map<string, number[]> }) | null
}

type RawYou = { place: number; tied?: number } & Record<string, unknown>
type RawRecords = {
  daysWon: {
    top: { name: string; days: number; avatarId?: string }[]
    you: (RawYou & { days: number }) | null
    closedDays?: number
    players?: number
    leaders?: number
  }
  courseRecords?: {
    top: { name: string; count: number; courses?: number[]; avatarId?: string }[]
    you: (RawYou & { count: number; courses?: number[] }) | null
    players?: number
    leaders?: number
  }
}

function tallyYou(you: RawYou | null, value: number | undefined): TallyYou | null {
  if (!you || value == null) return null
  return { value, place: you.place, tied: typeof you.tied === 'number' ? you.tied : null }
}

/** A daily's records of its own, with where `name` stands on each (GET /leaderboards/:game/daily-records). */
export async function fetchDailyRecords(slug: string, name: string): Promise<DailyRecordsResult> {
  const who = normalizePlayerName(name)
  const raw = await api<RawRecords>(
    `/leaderboards/${encodeURIComponent(slug)}/daily-records${who ? `?name=${encodeURIComponent(who)}` : ''}`,
  )
  const won = raw.daysWon
  const held = raw.courseRecords
  const courses = new Map<string, number[]>()
  for (const t of held?.top ?? []) if (t.courses) courses.set(normalizePlayerName(t.name), t.courses)
  if (who && held?.you?.courses) courses.set(who, held.you.courses)
  return {
    daysWon: {
      top: won.top.map((t) => ({ name: normalizePlayerName(t.name), value: t.days, avatarId: t.avatarId })),
      you: tallyYou(won.you, won.you?.days),
      players: won.players ?? null,
      leaders: won.leaders ?? null,
      closedDays: won.closedDays ?? null,
    },
    courseRecords: held
      ? {
          top: held.top.map((t) => ({ name: normalizePlayerName(t.name), value: t.count, avatarId: t.avatarId })),
          you: tallyYou(held.you, held.you?.count),
          players: held.players ?? null,
          leaders: held.leaders ?? null,
          courses,
        }
      : null,
  }
}

const HOLD_MS = 30_000
const held = new Map<string, { at: number; result: DailyRecordsResult }>()

export type Asked<T> = { data: T | null; failed: boolean }

/** A daily's records of its own, kept half a minute (the API keeps them as long). */
export function useDailyRecords(slug: string, name: string): Asked<DailyRecordsResult> {
  const key = `${slug}|${normalizePlayerName(name)}`
  const [answer, setAnswer] = useState<{ key: string } & Asked<DailyRecordsResult>>(() => ({
    key,
    data: held.get(key)?.result ?? null,
    failed: false,
  }))
  useEffect(() => {
    const hit = held.get(key)
    if (hit && Date.now() - hit.at < HOLD_MS) return
    let live = true
    fetchDailyRecords(slug, name)
      .then((result) => {
        held.set(key, { at: Date.now(), result })
        if (live) setAnswer({ key, data: result, failed: false })
      })
      .catch(() => {
        if (live) setAnswer({ key, data: held.get(key)?.result ?? null, failed: !held.has(key) })
      })
    return () => {
      live = false
    }
  }, [key, slug, name])
  if (answer.key === key) return answer
  return { data: held.get(key)?.result ?? null, failed: false }
}

/**
 * The game's Days played in a row, from its record book: over everyone, never a group's, since a record's
 * holder is the whole arcade's. Enough of it to see who's tied at the top.
 */
export function useStreakBook(slug: string, name: string): Asked<BookGlance> {
  const who = normalizePlayerName(name)
  const key = `${slug}|${who}`
  const [answer, setAnswer] = useState<{ key: string } & Asked<BookGlance>>({ key: '', data: null, failed: false })
  useEffect(() => {
    let live = true
    fetchBookGlance(slug, PLAY_DAYS_STREAK_ID, who, 50)
      .then((glance) => {
        if (live) setAnswer({ key, data: glance, failed: false })
      })
      .catch(() => {
        if (live) setAnswer({ key, data: null, failed: true })
      })
    return () => {
      live = false
    }
  }, [key, slug, who])
  return answer.key === key ? answer : { data: null, failed: false }
}

/* ---------- a daily's courses ---------- */

/** One track's or hole's record: the #1 on its board, how many are on it, and your best and place there. */
export type CourseRecordRow = {
  n: number
  /** Its day, YYYY-MM-DD. */
  day: string
  /** Today's course, whose #1 is only 1st today. */
  today: boolean
  name: string
  players: number
  /**
   * The #1, `value` the way less is better: a lap's milliseconds or a hole's tries. `set` says when, in
   * words, if it wasn't on the course's own day: a track's record can be taken any day after.
   */
  holder: { name: string; avatarId?: string; value: number; set?: string } | null
  you: { value: number; place: number } | null
}

/** When a course's record was set, as its board's #1 carries it (`at`), if not on its day. */
function setWords(record: { at?: number }, day: string, now: number): string | undefined {
  const at = record.at
  if (typeof at !== 'number' || !Number.isFinite(at)) return undefined
  const set = boardToday(at)
  if (new Date(set).toISOString().slice(0, 10) === day) return undefined
  return `set ${dayName(set, boardToday(now))}`
}

const holeNames = new Map<number, string>()

/** A track's or hole's name by its number: Seneca Glen, Blizzard Bumps. */
export function courseTitle(slug: string, n: number): string {
  if (slug === 'hotlap') return DAILY_TRACKS[(n - 1) % DAILY_TRACKS.length]?.name ?? `Track ${n}`
  if (slug === 'acechase') {
    let name = holeNames.get(n)
    if (!name) {
      const [y, m, d] = DAILY_EPOCH.split('-').map(Number)
      name = todaysHole(new Date(Date.UTC(y!, m! - 1, d! + n - 1)).toISOString().slice(0, 10)).def.name
      holeNames.set(n, name)
    }
    return name
  }
  return `#${n}`
}

/** Hot Lap's tracks, newest first, from GET /tracks/hotlap/records. */
export function trackRecordRows(rows: TrackRecordRow[], today: string, now = Date.now()): CourseRecordRow[] {
  return rows
    .filter((r) => r.day <= today)
    .map((r) => ({
      n: r.track,
      day: r.day,
      today: r.day === today,
      name: courseTitle('hotlap', r.track),
      players: r.drivers,
      holder: r.record
        ? {
            name: normalizePlayerName(r.record.name),
            avatarId: r.record.avatarId,
            value: hotlapMsFromBoardScore(r.record.score),
            set: setWords(r.record, r.day, now),
          }
        : null,
      you: r.you ? { value: hotlapMsFromBoardScore(r.you.score), place: r.you.place } : null,
    }))
    .sort((a, b) => b.day.localeCompare(a.day))
}

/** Ace Chase's holes, newest first, from GET /holes/acechase/records. */
export function holeRecordRows(rows: HoleRecordRow[], today: string, now = Date.now()): CourseRecordRow[] {
  return rows
    .filter((r) => r.day <= today)
    .map((r) => ({
      n: r.n,
      day: r.day,
      today: r.day === today,
      name: courseTitle('acechase', r.n),
      players: r.players,
      holder: r.record
        ? {
            name: normalizePlayerName(r.record.name),
            avatarId: r.record.avatarId,
            value: r.record.tries,
            set: setWords(r.record, r.day, now),
          }
        : null,
      you: r.you ? { value: r.you.tries, place: r.you.place } : null,
    }))
    .sort((a, b) => b.day.localeCompare(a.day))
}

/** A course result as its board prints it: a lap, 1:14.412; a hole, 2 tries. */
export function courseResult(slug: string, value: number): string {
  return slug === 'hotlap' ? formatLapMs(value, 3) : formatTries(value)
}

/* ---------- words ---------- */

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * "Today’s track" mid-sentence: today’s track, today’s hills, but Today’s Wanted and Today’s Pour, which are
 * names (their own word has a capital).
 */
export function todayWords(slug: string): string {
  const { today } = dailyWords(slug)
  const own = today.slice(today.indexOf(' ') + 1)
  return own.charAt(0) !== own.charAt(0).toLowerCase() ? today : today.charAt(0).toLowerCase() + today.slice(1)
}

/**
 * Names in a line: ETTA, GUS, LATTE and DAD; past `max` of them, ETTA, GUS, LATTE and 4 more. `total` counts
 * them when there are more than `names` holds.
 */
export function namesLine(names: string[], max = 4, total = names.length): string {
  if (total <= 1) return names[0] ?? ''
  if (total > max) return `${names.slice(0, max - 1).join(', ')} and ${total - (max - 1)} more`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** Places shared between equal numbers, most first: 3, 3, 3, 1 are 1st, 1st, 1st and 4th. */
export function sharedPlaces(values: number[]): number[] {
  return values.map((v) => 1 + values.filter((o) => o > v).length)
}

/** A count with its word: 1 day, 3 tracks. */
function counted(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`
}

const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' })
const monthDay = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })

/** A board day in words, near today by its name: today, Mon; further back its date, Sep 20. */
function dayName(day: number, today: number): string {
  if (day === today) return 'today'
  return today - day < 7 * DAY_MS ? weekday.format(new Date(day)) : monthDay.format(new Date(day))
}

/** The days a run of days took, ending on the day of `at`: Sat, Sun and Mon; Sep 20 to Sep 29. */
export function streakSpan(at: number, days: number, now = Date.now()): string {
  const end = boardToday(at)
  const today = boardToday(now)
  const start = end - (days - 1) * DAY_MS
  if (days <= 1) return dayName(end, today)
  // One way of naming the days in a span: all by name within the week (Sat, Sun and Mon), else by date, never
  // a mix (Oct 5, Tue and Wed).
  if (days <= 3 && today - start < 7 * DAY_MS) {
    return namesLine(Array.from({ length: days }, (_, i) => dayName(start + i * DAY_MS, today)))
  }
  const last = end === today ? 'today' : monthDay.format(new Date(end))
  return `${monthDay.format(new Date(start))} ${days === 2 ? 'and' : 'to'} ${last}`
}

/* ---------- the list ---------- */

export type RecordCardRow = TallyRow & { place: number; you: boolean }

/** Where you stand on one of the records made over many days. */
export type DayRecordYou =
  /** You hold it, alone; `note` is how your run stands, for a streak. */
  | { kind: 'mine'; note: string }
  /**
   * On it: your number (in words, and `n` for its bar), your place in words ('' when you're tied for it) and as
   * a number, how far off ('' tied), and for a streak how your run stands (`live`).
   */
  | { kind: 'on'; value: string; n: number; place: string; rank: number; gap: string; live: string }
  /** Not on it yet. */
  | { kind: 'none'; text: string }

/**
 * One of a daily's records made over many days (Days played in a row, Most days won, Most track records held),
 * as a row of its Records tab's list (the "Records, more ideas" canvas's A, as a game's Records tab is).
 */
export type DayRecord = {
  key: 'streak' | 'days-won' | 'courses-held'
  title: string
  /** The record in words, 5 days or 6 tracks; null with nobody on it. */
  value: string | null
  /** Who holds it, or everyone tied for it (three marks at most), and the line under their names. */
  holders: { marks: TallyRow[]; names: string; sub: string } | null
  /** Who holds it for the head's count: the one player, or null for a tie or nobody. */
  heldBy: string | null
  /** What its row says with nobody on it. */
  empty: string
  /** Null signed out. */
  you: DayRecordYou | null
  /** The first five, places shared between equal numbers: the row opens them. */
  top: RecordCardRow[]
  unit: [string, string]
}

type Viewer = { name: string; signedIn: boolean }

function cardRows(top: TallyRow[], me: string): RecordCardRow[] {
  const first = top.slice(0, 5)
  const places = sharedPlaces(first.map((r) => r.value))
  return first.map((r, i) => ({ ...r, place: places[i]!, you: Boolean(me) && r.name === me }))
}

/**
 * Your place in words, a place shared between equal numbers: 14th, tied 2nd, 19th of 20 players, or tied with
 * 3 others past the first ten. `shared` is your shared place when it's known.
 */
function placeWords(you: TallyYou, rows: RecordCardRow[], players: number | null, shared: number | null): string {
  const listed = rows.find((r) => r.you)
  if (listed) {
    const tied = rows.filter((r) => r.value === listed.value).length > 1
    return tied ? `tied ${ordinal(listed.place)}` : ordinal(listed.place)
  }
  if (you.tied) return shared != null ? `tied ${ordinal(shared)}` : `tied with ${counted(you.tied, 'other')}`
  const place = shared ?? you.place
  return players ? `${ordinal(place)} of ${counted(players, 'player')}` : ordinal(place)
}

/** Everyone tied for a record by name, you as "you": GLITCH, STACKR and you. `total` counts past the first ten. */
function holderNames(leaders: TallyRow[], me: string, total = leaders.length): string {
  const names = leaders.map((r) => (me && r.name === me ? 'you' : r.name))
  return capital(namesLine(names, 4, total))
}

/**
 * Days played in a row, from the game's record book: whoever got there first holds it, and a tie says so.
 * Your note says whether your run is still going: one played today goes on tomorrow, one played yesterday
 * goes on only with today's course. Tied for it, your cell says no more than your number and your run: the
 * holders' names already say you're among them.
 */
export function streakRecord(slug: string, glance: BookGlance | null, viewer: Viewer, now = Date.now()): DayRecord {
  const words = dailyWords(slug)
  const entries: LeaderboardEntry[] = glance?.entries ?? []
  const top: TallyRow[] = entries.map((e) => ({ name: normalizePlayerName(e.name), value: e.score, avatarId: e.avatarId }))
  const rows = cardRows(top, viewer.name)
  const first = entries[0]
  const best = first?.score ?? 0
  const holderName = first ? normalizePlayerName(first.name) : ''
  const leaders = top.filter((r) => r.value === best)
  let you: DayRecordYou | null = null
  if (viewer.signedIn && viewer.name) {
    const mine = glance?.you ?? null
    if (!mine) you = { kind: 'none', text: 'Not on it yet' }
    else {
      const n = mine.score
      const ago = Math.round((boardToday(now) - boardToday(mine.at)) / DAY_MS)
      const ended = ago > 1
      const live =
        ago <= 0
          ? 'still going'
          : ago === 1
            ? `${words.verb.toLowerCase()} today to keep it going`
            : `ended ${dayName(boardToday(mine.at), boardToday(now))}`
      // Your record's own days are under your name, so its note says only how it stands, never its last day again.
      if (holderName === viewer.name) you = { kind: 'mine', note: ended ? '' : live }
      else {
        // A shared place, as the row's words have it: from everyone on the first page who's ahead, when you're on it.
        const listed = entries.some((e) => normalizePlayerName(e.name) === viewer.name)
        const rank = n >= best ? 1 : listed ? 1 + entries.filter((e) => e.score > n).length : mine.rank
        const all = glance && glance.total <= entries.length
        const tied = all ? entries.filter((e) => e.score === n).length - 1 : null
        you =
          n >= best
            ? { kind: 'on', value: counted(n, 'day'), n, place: '', rank, gap: '', live }
            : {
                kind: 'on',
                value: counted(n, 'day'),
                n,
                place: placeWords({ value: n, place: mine.rank, tied }, rows, glance?.total ?? null, listed ? rank : null),
                rank,
                gap: `${counted(best - n, 'day')} short`,
                live,
              }
      }
    }
  }
  return {
    key: 'streak',
    title: 'Days played in a row',
    value: first ? counted(best, 'day') : null,
    holders: first
      ? {
          marks: leaders.slice(0, 3),
          names: holderNames(leaders, viewer.name),
          sub:
            leaders.length > 1
              ? `tied; ${holderName === viewer.name ? 'you' : holderName} got there first`
              : streakSpan(first.at, best, now),
        }
      : null,
    heldBy: first ? holderName : null,
    empty: `Nobody yet: ${todayWordsVerb(slug)} two days running and it’s yours.`,
    you,
    top: rows,
    unit: ['day', 'days'],
  }
}

/** "race today’s track": the verb and the course, for a sentence that already started. */
function todayWordsVerb(slug: string): string {
  return `${dailyWords(slug).verb.toLowerCase()} ${todayWords(slug)}`
}

/**
 * A count-kept record (most days won, most course records held) as a row: whoever has the most holds it, and
 * among players tied for the most, the first to get there (the API lists them that way), as Days played in a
 * row does; and where you stand, at a place shared between equal numbers.
 */
function tallyRecord(
  key: DayRecord['key'],
  title: string,
  tally: Tally | null,
  unit: [string, string],
  viewer: Viewer,
  sub: (value: number) => string,
  empty: string,
  none: string,
): DayRecord {
  const top = tally?.top ?? []
  const rows = cardRows(top, viewer.name)
  const most = top[0]?.value ?? 0
  const leaders = most > 0 ? top.filter((r) => r.value === most) : []
  const count = Math.max(leaders.length, tally?.leaders ?? 0)
  const holder = leaders[0]?.name ?? null
  let you: DayRecordYou | null = null
  if (viewer.signedIn && viewer.name) {
    const mine = tally?.you ?? null
    const n = mine?.value ?? 0
    if (!mine || n <= 0) you = { kind: 'none', text: none }
    else if (holder === viewer.name) you = { kind: 'mine', note: '' }
    else if (n >= most) you = { kind: 'on', value: counted(n, unit[0], unit[1]), n, place: '', rank: 1, gap: '', live: '' }
    else {
      const listed = top.some((r) => r.name === viewer.name)
      const rank = listed ? 1 + top.filter((r) => r.value > n).length : mine.place
      you = {
        kind: 'on',
        value: counted(n, unit[0], unit[1]),
        n,
        place: placeWords(mine, rows, tally?.players ?? null, listed ? rank : null),
        rank,
        gap: `${counted(most - n, unit[0], unit[1])} short`,
        live: '',
      }
    }
  }
  return {
    key,
    title,
    value: leaders.length ? counted(most, unit[0], unit[1]) : null,
    holders: leaders.length
      ? {
          marks: leaders.slice(0, 3),
          names: holderNames(leaders, viewer.name, count),
          sub: count > 1 ? `tied; ${holder === viewer.name ? 'you' : holder} got there first` : sub(most),
        }
      : null,
    heldBy: holder,
    empty,
    you,
    top: rows,
    unit,
  }
}

/**
 * Most days won: 1st on a day's board when it ended. Only days that are over count, so never today. What
 * they're out of is every day that's over, a day nobody played too, as the past tab lists them.
 */
export function daysWonRecord(tally: DailyRecordsResult['daysWon'] | null, viewer: Viewer): DayRecord {
  const closed = tally?.closedDays ?? null
  return tallyRecord(
    'days-won',
    'Most days won',
    tally,
    ['day', 'days'],
    viewer,
    // The number is in the row already: this is what it's out of.
    (value) =>
      !closed
        ? ''
        : value === closed
          ? closed === 1
            ? 'the only day so far'
            : closed === 2
              ? 'both days so far'
              : `every day so far`
          : `of the ${counted(closed, 'day')} so far`,
    closed ? 'Nobody has won a day yet.' : 'No day has ended yet: the first does at midnight, New York time.',
    'No days won yet',
  )
}

/** Most track or hole records held: past courses whose All time board a player tops (today's #1 is only 1st today). */
export function coursesHeldRecord(slug: string, tally: DailyRecordsResult['courseRecords'], viewer: Viewer): DayRecord {
  const course = dailyWords(slug).course
  return tallyRecord(
    'courses-held',
    `Most ${course} records held`,
    tally,
    [course, `${course}s`],
    viewer,
    (value) => {
      const held = tally?.courses.get(tally.top[0]!.name)
      return held?.length === value ? namesLine(held.map((n) => courseTitle(slug, n)), 3) : ''
    },
    `Nobody holds a past ${course}’s record yet.`,
    `No ${course} records yet`,
  )
}

/**
 * The past course you're nearest to taking the record of, by its number: a Hot Lap track takes any lap, so
 * the one where your best is closest to its #1. Null where a course takes only your first result (Ace Chase),
 * or there's none to chase.
 */
export function nearestCourse(slug: string, courses: CourseRecordRow[] | null, me: string): number | null {
  if (!me || FIRST_RUN_DAILIES.has(slug)) return null
  const chase = (courses ?? [])
    .filter((c) => !c.today && c.you && c.holder && c.holder.name !== me)
    .map((c) => ({ n: c.n, off: (c.you!.value - c.holder!.value) / Math.max(1, c.holder!.value) }))
    .sort((a, b) => a.off - b.off)[0]
  return chase ? chase.n : null
}

/**
 * The head of a daily's Records tab (recordBook headOver): its records made over many days and each past
 * course's record, who holds the most of them, and how you stand. Today's course isn't a record yet: its #1
 * is only 1st today.
 */
export function dayRecordsHead(slug: string, records: DayRecord[], courses: CourseRecordRow[] | null, viewer: Viewer) {
  const name = getGame(slug)?.name ?? slug
  const past = (courses ?? []).filter((c) => !c.today)
  const places = [
    ...records.map((r) => (r.you?.kind === 'on' ? r.you.rank : r.you?.kind === 'mine' ? 1 : null)),
    ...past.map((c) => (c.you ? c.you.place : null)),
  ].filter((p): p is number => p != null)
  return headOver(
    name,
    [...records.map((r) => r.heldBy), ...past.map((c) => c.holder?.name ?? null)],
    viewer.signedIn ? viewer.name : '',
    { knows: viewer.signedIn && Boolean(viewer.name), on: places.length, best: places.length ? Math.min(...places) : 0 },
  )
}

/** The line over the tab: what its records are, and where each course's own best lives instead. */
export function recordsIntro(slug: string): { lede: string; link: string } {
  const words = dailyWords(slug)
  const name = getGame(slug)?.name ?? slug
  if (words.past === 'board') {
    return {
      lede: `${name}’s own records, made over many days. A ${words.course}’s best is just the #1 on its ${BOARD_NAMES.allTime} board, so it stays with the ${words.course}.`,
      link: `${BOARD_NAMES.allTime} boards are on ${words.pastTab}`,
    }
  }
  return {
    lede: `${name}’s own records, made over many days. Each day’s ${BOARD_NAMES.ranked} board is on ${words.pastTab}.`,
    link: words.pastTab,
  }
}
