import { useEffect, useState } from 'react'
import { getGame } from '../data/games'
import { DAILY_EPOCH } from '../games/acechase/daily'
import { formatTries } from '../games/acechase/score'
import { DAILY_TRACKS } from '../games/hotlap/dailyPlan'
import { formatLapMs, hotlapMsFromBoardScore } from '../games/hotlap/score'
import { todaysHole } from './dailyHole'
import { dailyWords } from './dailyWords'
import { FIRST_RUN_DAILIES } from './gameBoard'
import { api, normalizePlayerName, type LeaderboardEntry } from './leaderboard'
import { numberWord } from './numberWord'
import type { HoleRecordRow } from './pastHoles'
import { fetchBookGlance, PLAY_DAYS_STREAK_ID, type BookGlance } from './records'
import { boardToday, ordinal } from './scoreboard'
import type { TrackRecordRow } from './trackBoards'

/*
 * A daily's Records tab (components/DailyRecordsTab.tsx): only the records its boards don't already show,
 * the ones made over many days. Days played in a row (its record book's), the most days won, and for Hot
 * Lap and Ace Chase the most track or hole records held, then each track's or hole's record, which is just
 * the #1 on that course's board. The tab only fetches and lays out; this says it.
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

/** A course result as its board prints it: a lap, 1:14.41; a hole, 2 tries. */
export function courseResult(slug: string, value: number): string {
  return slug === 'hotlap' ? formatLapMs(value) : formatTries(value)
}

/* ---------- words ---------- */

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** "Today’s track" mid-sentence: today’s track, but Today’s Wanted, which is a name. */
export function todayWords(slug: string): string {
  const words = dailyWords(slug)
  return words.today.endsWith(words.course) ? words.today.charAt(0).toLowerCase() + words.today.slice(1) : words.today
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

/** A count said in a sentence: a day, 3 days. */
function aCount(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? `a ${one}` : `${n.toLocaleString()} ${many}`
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
  if (days <= 1) return dayName(end, today)
  if (days <= 3) {
    const names = Array.from({ length: days }, (_, i) => dayName(end - (days - 1 - i) * DAY_MS, today))
    return namesLine(names)
  }
  return `${monthDay.format(new Date(end - (days - 1) * DAY_MS))} to ${end === today ? 'today' : monthDay.format(new Date(end))}`
}

/* ---------- the cards ---------- */

export type RecordCardRow = TallyRow & { place: number; you: boolean }

/** One of the tab's record cards, said: who holds it, the first five, and you. */
export type RecordCard = {
  key: 'streak' | 'days-won' | 'courses-held'
  title: string
  /** The holder, or everyone tied for it. */
  holder: { marks: TallyRow[]; line: string; sub: string; value: number; unit: string } | null
  /** What the card says with nobody on it. */
  empty: string
  /** The first five, places shared between equal numbers. */
  rows: RecordCardRow[]
  unit: [string, string]
  /** Null signed out, when `signIn` says why there's nothing. */
  you: { value: string; aside: string; line: string; have: number; of: number } | null
  signIn: string | null
  foot: { label: 'counts' | 'board'; text: string }
}

type Viewer = { name: string; signedIn: boolean }

function cardRows(top: TallyRow[], me: string): RecordCardRow[] {
  const first = top.slice(0, 5)
  const places = sharedPlaces(first.map((r) => r.value))
  return first.map((r, i) => ({ ...r, place: places[i]!, you: Boolean(me) && r.name === me }))
}

/** Your place in words: 19th of 20 players, tied 2nd, or tied with 3 others past the first ten. */
function placeWords(you: TallyYou, rows: RecordCardRow[], players: number | null): string {
  const listed = rows.find((r) => r.you)
  if (listed) {
    const tied = rows.filter((r) => r.value === listed.value).length > 1
    return tied ? `tied ${ordinal(listed.place)}` : ordinal(listed.place)
  }
  if (you.tied) return `tied with ${counted(you.tied, 'other')}`
  return players ? `${ordinal(you.place)} of ${counted(players, 'player')}` : ordinal(you.place)
}

/**
 * Who holds a record, or everyone tied for it, with the line under their names. `total` is how many share
 * it when the API says, since `top` is only the first ten.
 */
function holderOf(
  top: TallyRow[],
  sub: (value: number, tied: number) => string,
  unit: [string, string],
  total: number | null = null,
): RecordCard['holder'] {
  const first = top[0]
  if (!first) return null
  const leaders = top.filter((r) => r.value === first.value)
  const count = Math.max(leaders.length, total ?? 0)
  return {
    marks: leaders.slice(0, 4),
    line: namesLine(leaders.map((r) => r.name), 4, count),
    sub: sub(first.value, count),
    value: first.value,
    unit: first.value === 1 ? unit[0] : unit[1],
  }
}

/**
 * Days played in a row, from the game's record book: whoever got there first holds it, and a tie says so.
 * Your line knows whether your run is still going: a best set yesterday goes on with today's course, one
 * set today with tomorrow's.
 */
export function streakCard(slug: string, glance: BookGlance | null, viewer: Viewer, now = Date.now()): RecordCard {
  const words = dailyWords(slug)
  const today = todayWords(slug)
  const entries: LeaderboardEntry[] = glance?.entries ?? []
  const top: TallyRow[] = entries.map((e) => ({ name: normalizePlayerName(e.name), value: e.score, avatarId: e.avatarId }))
  const rows = cardRows(top, viewer.name)
  const first = entries[0]
  const holder = holderOf(
    top,
    (value, tied) =>
      tied > 1
        ? `tied at ${counted(value, 'day')}; ${normalizePlayerName(first!.name)} got there first`
        : streakSpan(first!.at, value, now),
    ['day', 'days'],
  )
  const best = first?.score ?? 0
  const holderName = first ? normalizePlayerName(first.name) : ''
  let you: RecordCard['you'] = null
  if (viewer.signedIn && viewer.name) {
    const mine = glance?.you ?? null
    if (!mine) {
      you = {
        value: 'none yet',
        aside: '',
        line: `${words.verb} ${today} two days running to get on it.`,
        have: 0,
        of: Math.max(best, 2),
      }
    } else {
      const n = mine.score
      const ago = Math.round((boardToday(now) - boardToday(mine.at)) / DAY_MS)
      const holds = holderName === viewer.name
      const then = (next: number) =>
        holds
          ? `your record goes to ${counted(next, 'day')}`
          : next > best
            ? `it’s yours at ${counted(next, 'day')}`
            : next === best
              ? `you’re tied with ${holderName} at ${next}`
              : `you’re on ${counted(next, 'day')}`
      const line =
        ago === 1
          ? `${words.verb} ${today} and ${then(n + 1)}.`
          : ago === 0
            ? `${holds ? 'It’s yours. ' : ''}Come back tomorrow and ${then(n + 1)}.`
            : `Your best run ended ${dayName(boardToday(mine.at), boardToday(now))}. ${words.verb} ${today} to start another.`
      // Everyone on it came back with it: then a shared place can be counted, not just the book's order.
      const all = glance && glance.total <= entries.length
      const tied = all ? entries.filter((e) => e.score === n).length - 1 : null
      const place = all ? 1 + entries.filter((e) => e.score > n).length : mine.rank
      you = {
        value: counted(n, 'day'),
        aside: placeWords({ value: n, place, tied }, rows, glance?.total ?? null),
        line,
        have: n,
        of: best,
      }
    }
  }
  return {
    key: 'streak',
    title: 'Days played in a row',
    holder,
    empty: `Nobody yet. ${words.verb} ${today} two days running and it’s yours.`,
    rows,
    unit: ['day', 'days'],
    you,
    signIn: viewer.signedIn ? null : `Sign in and ${todayWordsVerb(slug)} to get on it.`,
    foot: { label: 'counts', text: `Only ${today} keeps it going.` },
  }
}

/** "race today’s track": the verb and the course, for a sentence that already started. */
function todayWordsVerb(slug: string): string {
  return `${dailyWords(slug).verb.toLowerCase()} ${todayWords(slug)}`
}

/** Most days won: 1st on a day's board when it ended. Only days that are over count, so never today. */
export function daysWonCard(slug: string, tally: DailyRecordsResult['daysWon'] | null, viewer: Viewer): RecordCard {
  const words = dailyWords(slug)
  const top = tally?.top ?? []
  const rows = cardRows(top, viewer.name)
  const closed = tally?.closedDays ?? null
  const holder = holderOf(
    top,
    (value, tied) =>
      tied > 1
        ? `tied, ${aCount(value, 'day')} each`
        : !closed
          ? ''
          : value === closed
            ? closed === 1
              ? 'won the only day so far'
              : `won all ${numberWord(closed)} days so far`
            : `${value} of the ${counted(closed, 'day')} so far`,
    ['day', 'days'],
    tally?.leaders ?? null,
  )
  const most = holder?.value ?? 0
  const leaders = top.filter((r) => r.value === most && most > 0)
  const count = Math.max(leaders.length, tally?.leaders ?? 0)
  const them = count === 1 ? leaders[0]!.name : count === 2 ? 'both' : `all ${numberWord(count)}`
  let you: RecordCard['you'] = null
  if (viewer.signedIn && viewer.name) {
    const mine = tally?.you ?? null
    const n = mine?.value ?? 0
    const gap = most - n
    const leading = n > 0 && gap === 0
    const line = leading
      ? count > 1
        ? 'You’re tied for the most. One more day and it’s yours alone.'
        : 'It’s yours: nobody has won more days.'
      : n === 0
        ? `Be 1st when a day ends to win it.${most > 0 && gap === 1 ? ` One win ties ${them}.` : ''}`
        : `${capital(numberWord(gap))} more ${gap === 1 ? 'day ties' : 'days tie'} ${namesLine(leaders.map((r) => r.name), 4, count)}.`
    you = {
      value: n ? counted(n, 'day') : 'none yet',
      aside: mine && n ? placeWords(mine, rows, tally?.players ?? null) : '',
      line,
      have: n,
      of: Math.max(most, 1),
    }
  }
  return {
    key: 'days-won',
    title: 'Most days won',
    holder,
    empty: 'No day has ended yet. The first one does at midnight, New York time.',
    rows,
    unit: ['day', 'days'],
    you,
    signIn: viewer.signedIn ? null : `Sign in and ${todayWordsVerb(slug)} to win a day.`,
    foot: { label: 'counts', text: `Won on its day only, never on a past ${words.course}.` },
  }
}

/**
 * Most track or hole records held: past courses whose board a player tops (today's #1 is only 1st today).
 * Your line points at what's still open to you: a Hot Lap track takes any lap, so your nearest one; an Ace
 * Chase hole takes only your first result, so the past holes you haven't played.
 */
export function coursesHeldCard(
  slug: string,
  tally: DailyRecordsResult['courseRecords'],
  courses: CourseRecordRow[] | null,
  viewer: Viewer,
): RecordCard {
  const words = dailyWords(slug)
  const course = words.course
  const unit: [string, string] = [course, `${course}s`]
  const top = tally?.top ?? []
  const rows = cardRows(top, viewer.name)
  const holder = holderOf(
    top,
    (value, tied) => {
      if (tied > 1) return `tied, ${aCount(value, course)} each`
      const held = tally?.courses.get(top[0]!.name)
      return held?.length === value ? namesLine(held.map((n) => courseTitle(slug, n)), 3) : ''
    },
    unit,
    tally?.leaders ?? null,
  )
  const firstOnly = FIRST_RUN_DAILIES.has(slug)
  const past = (courses ?? []).filter((c) => !c.today)
  let you: RecordCard['you'] = null
  if (viewer.signedIn && viewer.name) {
    const mine = tally?.you ?? null
    const n = mine?.value ?? 0
    const most = holder?.value ?? 0
    let line: string
    let aside = mine && n ? placeWords(mine, rows, tally?.players ?? null) : ''
    if (firstOnly) {
      const open = past.filter((c) => !c.you).length
      line = open
        ? `${capital(numberWord(open))} past ${open === 1 ? `${course} you haven’t played is` : `${course}s you haven’t played are`} open to you: your first bullseye on one goes on its board.`
        : `You’ve played every past ${course}, and your first bullseye on each stands.`
      if (!aside && open) aside = `${counted(open, course)} open to you`
    } else {
      const chase = past
        .filter((c) => c.you && c.holder && c.holder.name !== viewer.name)
        .map((c) => ({ c, off: c.you!.value - c.holder!.value }))
        .sort((a, b) => a.off / Math.max(1, a.c.holder!.value) - b.off / Math.max(1, b.c.holder!.value))[0]
      if (chase) {
        const { c, off } = chase
        line =
          off === 0
            ? `You’re tied on ${c.name} with ${c.holder!.name}, who got there first.`
            : `Your closest is ${c.name}, ${courseResult(slug, off)} off ${c.holder!.name}’s ${courseResult(slug, c.holder!.value)}.`
        if (!aside) aside = off === 0 ? 'tied on one' : `closest ${courseResult(slug, off)} off`
      } else {
        line = `${words.verb} any past ${course}: your best goes on its board.`
      }
    }
    you = { value: n ? counted(n, course) : 'none yet', aside, line, have: n, of: Math.max(most, 1) }
  }
  return {
    key: 'courses-held',
    title: `Most ${course} records held`,
    holder,
    empty: `Nobody holds a past ${course}’s record yet.`,
    rows,
    unit,
    you,
    signIn: viewer.signedIn ? null : `Sign in and your results on past ${course}s go on their boards.`,
    foot: {
      label: 'board',
      text: firstOnly ? `Your first bullseye on a ${course}, on its day or after.` : `Any lap of any ${course}, any day.`,
    },
  }
}

/** The line over the tab: what its records are, and where each course's own best lives instead. */
export function recordsIntro(slug: string): { lede: string; link: string } {
  const words = dailyWords(slug)
  const name = getGame(slug)?.name ?? slug
  if (words.past === 'board') {
    return {
      lede: `${name}’s own records, made over many days. A ${words.course}’s best is just the #1 on its board, so it stays with the ${words.course}.`,
      link: `${capital(words.course)} boards are on ${words.pastTab}`,
    }
  }
  return {
    lede: `${name}’s own records, made over many days. Who was 1st on each day is on ${words.pastTab}.`,
    link: words.pastTab,
  }
}
