import { getGame } from '../data/games'
import { PRIZE_KINDS, prizeById } from '../data/prizes'
import { bugForDay } from './bugHuntPick'
import { scoreText } from './gameBoard'
import { api } from './leaderboard'
import { ordinal } from './scoreboard'

/*
 * Your tickets, every one in and out (/prizes/tickets), from the API's
 * GET /tickets/history: whole days on the boards' clock, newest first, a
 * week of days with something in them at a time. Ramsey asked for "a page
 * that shows how you earned tickets … lists out how you earned each of the
 * tickets" (2026-10-05) and picked the ledger of three mocks.
 *
 * The API sends the ledger's rows as they are; this says each in words. A
 * saved run pays in several rows (its step, a new best, pickups, a first go,
 * a day on a streak), which carry the run, so they show as one line with a
 * part for each. Rows from before the API kept that are a line apiece.
 */

/** What a row was for beyond its reason and ref (the API's schema.ts TicketDetail). */
export type TicketDetail = {
  run?: string
  score?: number
  stepAt?: number | null
  label?: string
  before?: number
}

export type LedgerLine = {
  id: string
  amount: number
  reason: string
  ref: string
  game: string | null
  at: number
  detail: TicketDetail | null
}

export type HistoryDay = { day: number; lines: LedgerLine[] }

export type TicketHistory = { days: HistoryDay[]; next: number | null }

/** All of it, a run's own pay (its step, a best, pickups), everything else earned, or trades. */
export type HistoryKind = 'all' | 'runs' | 'bonuses' | 'trades'

export function fetchTicketHistory(options: { before?: number | null; kind: HistoryKind; game: string | null }): Promise<TicketHistory> {
  const query = new URLSearchParams()
  if (options.before) query.set('before', String(options.before))
  if (options.kind !== 'all') query.set('kind', options.kind)
  if (options.game) query.set('game', options.game)
  const qs = query.toString()
  return api<TicketHistory>(`/tickets/history${qs ? `?${qs}` : ''}`)
}

/** A page's days after the ones on show: a day longer than a page comes in two, and is put back together. */
export function joinDays(had: HistoryDay[], more: HistoryDay[]): HistoryDay[] {
  const last = had[had.length - 1]
  if (!last || more[0]?.day !== last.day) return [...had, ...more]
  return [...had.slice(0, -1), { day: last.day, lines: [...last.lines, ...more[0].lines] }, ...more.slice(1)]
}

/* ------------------------------------------------------------ days --- */

const dayKeyFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
const dayFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
const shortDayFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
const timeFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })

/** The day on the boards' clock, as the API keys it: YYYYMMDD. */
export function boardDayKey(at = Date.now()): number {
  return Number(dayKeyFormat.format(new Date(at)).replace(/-/g, ''))
}

function keyDate(key: number): Date {
  return new Date(Date.UTC(Math.floor(key / 10_000), Math.floor((key % 10_000) / 100) - 1, key % 100))
}

function dayBefore(key: number): number {
  const d = keyDate(key)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.getUTCFullYear() * 10_000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

/** "Today", "Yesterday", or "Sat, Oct 3", and the date beside the first two. */
export function dayHeading(key: number, today = boardDayKey()): { name: string; date: string | null } {
  if (key === today) return { name: 'Today', date: dayFormat.format(keyDate(key)) }
  if (key === dayBefore(today)) return { name: 'Yesterday', date: dayFormat.format(keyDate(key)) }
  return { name: dayFormat.format(keyDate(key)), date: null }
}

/** "9:41 pm": when in its day a line came, on the boards' clock, as the day boards say a run's. */
export function lineTime(at: number): string {
  return timeFormat.format(new Date(at)).replace(/\s?([AP])M$/, (_, m: string) => ` ${m.toLowerCase()}m`)
}

/* ------------------------------------------------------------ lines --- */

/** What stands beside a line: its game's picture, or one of these. */
export type LineIcon = 'bug' | 'calendar' | 'season' | 'ticket' | 'prize'

export type HistoryPart = { amount: number; words: string }

export type HistoryRow = {
  key: string
  at: number
  game: string | null
  icon: LineIcon | null
  /** The prize a trade was for, to draw. */
  prize: string | null
  title: string
  sub: string | null
  /** What it paid for, when that's one thing; else `parts`, each with its tickets. */
  words: string | null
  parts: HistoryPart[]
  total: number
}

/** A run's parts in the order its report says them. */
const RUN_ORDER = ['run', 'best', 'pickup', 'first', 'streak']

/** What a past course of a daily is called, by its number. */
const COURSE_NOUN: Record<string, string> = { hotlap: 'track', marblerun: 'course', lander: 'cave', acechase: 'hole', wobblerun: 'gauntlet' }

function capital(words: string): string {
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function gameName(slug: string | null): string {
  return (slug && getGame(slug)?.name) || 'A game'
}

/** The step a run reached, as its ladder said it then: "beating the blue car", "2,000 points or better". */
function stepWords(line: LedgerLine, game: string): string {
  const detail = line.detail
  if (detail?.label) return detail.label
  if (detail && typeof detail.stepAt === 'number') return `${scoreText(game, detail.stepAt)} or better`
  return 'a run'
}

/** A part of a run's pay, as the run report says it. */
function partWords(line: LedgerLine, game: string): string {
  switch (line.reason) {
    case 'run':
      return stepWords(line, game)
    case 'best':
      return 'a new best'
    case 'pickup':
      return 'picked up'
    case 'first':
      return 'a first go'
    case 'streak':
      return 'a day on a streak'
    default:
      return 'more'
  }
}

/** A run's rows, as one line. */
function runRow(lines: LedgerLine[]): HistoryRow {
  const sorted = [...lines].sort((a, b) => RUN_ORDER.indexOf(a.reason) - RUN_ORDER.indexOf(b.reason))
  const first = sorted[0]!
  const game = first.game ?? ''
  const score = sorted.find((l) => typeof l.detail?.score === 'number')?.detail?.score
  const total = sorted.reduce((sum, l) => sum + l.amount, 0)
  let words: string | null = null
  if (sorted.length === 1) {
    words = capital(partWords(first, game))
    // A daily pays its step once a day: a run that climbed one is paid the difference.
    if (first.reason === 'run' && first.detail?.before) words += `, up a step from ${first.detail.before}`
  }
  return {
    key: `run:${first.detail?.run ?? first.id}`,
    at: first.at,
    game: game || null,
    icon: null,
    prize: null,
    title: gameName(game),
    sub: typeof score === 'number' && game ? scoreText(game, score) : null,
    words,
    parts: sorted.length > 1 ? sorted.map((l) => ({ amount: l.amount, words: partWords(l, game) })) : [],
    total,
  }
}

/** Any other row: a bug caught, a top-three day, a record, a milestone, a level, a gift, a trade. */
function otherRow(line: LedgerLine): HistoryRow {
  const row: HistoryRow = {
    key: line.id,
    at: line.at,
    game: line.game,
    icon: null,
    prize: null,
    title: gameName(line.game),
    sub: null,
    words: null,
    parts: [],
    total: line.amount,
  }
  switch (line.reason) {
    case 'hunt': {
      const day = /^\d{4}-\d{2}-\d{2}$/.test(line.ref) ? line.ref : null
      return { ...row, game: null, icon: 'bug', title: 'Bug hunt', sub: 'the day’s bug', words: day ? `Caught ${bugForDay(day).name}` : 'Caught the day’s bug' }
    }
    case 'top': {
      const [, day, place] = line.ref.split(':')
      const key = Number(day)
      const when = Number.isFinite(key) && key > 0 ? ` on ${dayFormat.format(keyDate(key))}` : ''
      return { ...row, sub: 'the day’s top three', words: `${ordinal(Number(place) || 1)}${when}` }
    }
    case 'record': {
      const [, kind, n] = line.ref.split(':')
      const noun = COURSE_NOUN[line.game ?? ''] ?? 'course'
      if (kind === 'hole' && n) {
        const key = Number(n.replace(/-/g, ''))
        return { ...row, sub: 'a past hole', words: `Took the record on ${Number.isFinite(key) ? shortDayFormat.format(keyDate(key)) : 'a past day'}’s hole` }
      }
      return { ...row, sub: `a past ${noun}`, words: `Took the record on ${noun} #${n ?? '?'}` }
    }
    case 'today': {
      const days = Number(line.ref.replace(/^streak-/, ''))
      return { ...row, game: null, icon: 'calendar', title: 'Dailies streak', sub: Number.isFinite(days) ? `${days} days kept` : null, words: 'A milestone' }
    }
    case 'season': {
      const level = /^s(\d+):lv(\d+)$/.exec(line.ref)
      const goal = /^s(\d+):goal:/.exec(line.ref)
      return {
        ...row,
        game: null,
        icon: 'season',
        title: 'Season pass',
        sub: level ? `Season ${level[1]}` : goal ? `Season ${goal[1]}` : null,
        words: level ? `Level ${level[2]}` : 'A season goal',
      }
    }
    case 'daily':
      return { ...row, sub: 'the day’s event', words: 'Played the event' }
    case 'grant':
      return { ...row, game: null, icon: 'ticket', title: 'From the arcade', words: 'Tickets given by hand' }
    case 'trade': {
      const prize = prizeById(line.ref)
      return {
        ...row,
        game: null,
        icon: 'prize',
        prize: prize?.id ?? null,
        title: prize ? `Traded for ${prize.name}` : 'Traded for a prize',
        sub: prize ? PRIZE_KINDS[prize.kind].one.toLowerCase() : null,
        words: 'At the prize counter',
      }
    }
    default:
      // A run's row from before rows carried their run: a line of its own.
      if (RUN_ORDER.includes(line.reason)) return runRow([line])
      return { ...row, words: 'Tickets' }
  }
}

/** A day's rows as lines, newest first: a run's rows together, as one. */
export function historyRows(lines: LedgerLine[]): HistoryRow[] {
  const runs = new Map<string, LedgerLine[]>()
  const order: (string | LedgerLine)[] = []
  for (const line of lines) {
    const run = line.detail?.run
    if (!run) {
      order.push(line)
      continue
    }
    const had = runs.get(run)
    if (had) had.push(line)
    else {
      runs.set(run, [line])
      order.push(run)
    }
  }
  return order.map((item) => (typeof item === 'string' ? runRow(runs.get(item)!) : otherRow(item)))
}

/** What a day's lines came to: tickets in, tickets traded, and what its runs paid against the day's cap. */
export function dayTotals(lines: LedgerLine[]): { earned: number; traded: number; runs: number } {
  let earned = 0
  let traded = 0
  let runs = 0
  for (const line of lines) {
    if (line.amount > 0) earned += line.amount
    else traded -= line.amount
    if (line.reason === 'run' || line.reason === 'best' || line.reason === 'pickup') runs += line.amount
  }
  return { earned, traded, runs }
}
