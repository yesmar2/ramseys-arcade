import type { LeaderboardPeriod } from './leaderboard'
import { recordBrief, recordGap, recordValue } from './recordBook'
import type { GameStat, NearRecord } from './stats'

/*
 * The Stats view's arithmetic: days as the boards count them (a calendar day in
 * New York, the week from Monday), the calendar's weeks, the best streak and
 * when it ran, the days you play most, each game's days on a common axis, and
 * the words for how close a record is. The page only lays these out.
 */

const BOARD_TZ = 'America/New_York'
const DAY_MS = 86_400_000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays']

const inBoardTz = new Intl.DateTimeFormat('en-CA', { timeZone: BOARD_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })

/** The board's day (YYYYMMDD) a moment falls on. */
export function boardDayKey(ms: number): number {
  const parts = Object.fromEntries(inBoardTz.formatToParts(new Date(ms)).map((p) => [p.type, p.value]))
  return Number(parts.year) * 10_000 + Number(parts.month) * 100 + Number(parts.day)
}

function keyToUtc(key: number): Date {
  return new Date(Date.UTC(Math.floor(key / 10_000), Math.floor((key % 10_000) / 100) - 1, key % 100))
}

function utcToKey(d: Date): number {
  return d.getUTCFullYear() * 10_000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

export function addDays(key: number, n: number): number {
  const d = keyToUtc(key)
  d.setUTCDate(d.getUTCDate() + n)
  return utcToKey(d)
}

/** Days from one key to another. */
export function daysBetween(from: number, to: number): number {
  return Math.round((keyToUtc(to).getTime() - keyToUtc(from).getTime()) / DAY_MS)
}

/** Monday 0 … Sunday 6. */
function weekday(key: number): number {
  return (keyToUtc(key).getUTCDay() + 6) % 7
}

/** "Sep 4". */
export function dayLabel(key: number): string {
  return `${MONTHS[Math.floor((key % 10_000) / 100) - 1]} ${key % 100}`
}

/** "today", "yesterday", "5 days ago", then the date. */
export function playedWhen(key: number, today: number): string {
  const ago = daysBetween(key, today)
  if (ago <= 0) return 'today'
  if (ago === 1) return 'yesterday'
  if (ago < 14) return `${ago} days ago`
  return dayLabel(key)
}

/* ---------- the calendar ---------- */

export type CalDay = { key: number; played: boolean; future: boolean; today: boolean }
export type CalWeek = { first: number; month: string | null; days: CalDay[] }

/** The last `weeks` weeks, Monday first, this one last; a month is named on the week it starts in. */
export function calendarWeeks(days: number[], today: number, weeks: number): CalWeek[] {
  const played = new Set(days)
  const start = addDays(addDays(today, -weekday(today)), -(weeks - 1) * 7)
  const out: CalWeek[] = []
  for (let w = 0; w < weeks; w++) {
    const first = addDays(start, w * 7)
    const cells: CalDay[] = []
    for (let d = 0; d < 7; d++) {
      const key = addDays(first, d)
      cells.push({ key, played: played.has(key), future: key > today, today: key === today })
    }
    out.push({ first, month: w > 0 && first % 100 <= 7 ? MONTHS[Math.floor((first % 10_000) / 100) - 1] : null, days: cells })
  }
  return out
}

/** The longest run of days in a row, and when it ran: the latest, where two are as long. */
export function bestStreak(days: number[]): { length: number; start: number; end: number } | null {
  const sorted = [...new Set(days)].sort((a, b) => a - b)
  let best: { length: number; start: number; end: number } | null = null
  let start = sorted[0]
  let length = 0
  let prev: number | null = null
  for (const day of sorted) {
    if (prev != null && addDays(prev, 1) === day) length++
    else {
      start = day
      length = 1
    }
    if (!best || length >= best.length) best = { length, start, end: day }
    prev = day
  }
  return best
}

/** "Sep 4–8", or "Aug 30 – Sep 2" across a month. */
export function spanLabel(start: number, end: number): string {
  if (start === end) return dayLabel(start)
  const sameMonth = Math.floor(start / 100) === Math.floor(end / 100)
  return sameMonth ? `${dayLabel(start)}–${end % 100}` : `${dayLabel(start)} – ${dayLabel(end)}`
}

/** The day or two of the week you play most, once there are enough days to say: short ("Wed & Sun") and in full. */
export function favouriteDays(days: number[]): { short: string; long: string } | null {
  if (days.length < 5) return null
  const counts = new Array(7).fill(0)
  for (const day of days) counts[weekday(day)]++
  const top = Math.max(...counts)
  const most = counts.map((n, i) => (n === top ? i : -1)).filter((i) => i >= 0)
  if (most.length > 2) return null
  return {
    short: most.map((i) => WEEKDAYS[i].slice(0, 3)).join(' & '),
    long: most.map((i) => WEEKDAYS[i]).join(' and '),
  }
}

/* ---------- each game's days ---------- */

export type ChartWindow = { start: number; slots: number; from: string; to: string }

/** The days a game's chart runs across for a period: this week, this month, or the last sixty days. */
export function chartWindow(period: LeaderboardPeriod, today: number): ChartWindow | null {
  if (period === 'daily') return null
  if (period === 'weekly') {
    return { start: addDays(today, -weekday(today)), slots: 7, from: 'Mon', to: 'Sun' }
  }
  if (period === 'monthly') {
    const first = Math.floor(today / 100) * 100 + 1
    const last = addDays(Math.floor(addDays(first, 32) / 100) * 100 + 1, -1)
    const month = MONTHS[Math.floor((today % 10_000) / 100) - 1]
    return { start: first, slots: last % 100, from: `${month} 1`, to: `${month} ${last % 100}` }
  }
  return { start: addDays(today, -59), slots: 60, from: '60 days ago', to: 'Today' }
}

export type DayBar = { slot: number; score: number; share: number; best: boolean }

/** A game's best on each day played within the window, as bars: the best of them marked. */
export function dayBars(trend: GameStat['trend'], window: ChartWindow): DayBar[] {
  const inWindow = trend
    .map((t) => ({ slot: daysBetween(window.start, boardDayKey(t.at)), score: t.score }))
    .filter((t) => t.slot >= 0 && t.slot < window.slots)
  const top = Math.max(1, ...inWindow.map((t) => t.score))
  let bestIndex = -1
  inWindow.forEach((t, i) => {
    if (bestIndex < 0 || t.score >= inWindow[bestIndex].score) bestIndex = i
  })
  return inWindow.map((t, i) => ({ ...t, share: t.score / top, best: i === bestIndex }))
}

/** The day a game's best in the period was set. */
export function bestDay(stat: GameStat): number | null {
  let best: { at: number; score: number } | null = null
  for (const t of stat.trend) if (!best || t.score >= best.score) best = t
  return best ? boardDayKey(best.at) : null
}

export type GameSort = 'recent' | 'most' | 'place'

export function sortGames(games: GameStat[], by: GameSort): GameStat[] {
  const list = [...games]
  if (by === 'most') return list.sort((a, b) => b.runs - a.runs || b.lastPlayedAt - a.lastPlayedAt)
  if (by === 'place') {
    const share = (g: GameStat) => ((g.rank ?? g.totalPlayers) - 1) / Math.max(1, g.totalPlayers)
    return list.sort((a, b) => share(a) - share(b) || (a.rank ?? 0) - (b.rank ?? 0))
  }
  return list.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
}

/* ---------- records within reach ---------- */

/** Your number on a record, and how far it is from the holder's, in the record's own terms. */
export function nearWords(r: NearRecord): { yours: string; off: string } {
  const rec = { id: r.recordId, unit: r.unit }
  const gap = recordGap(rec, r.yourBest, r.leader)
  return {
    yours: recordBrief(rec, r.yourBest),
    off: r.unit === 'ms' ? `${gap} off ${r.leaderName}` : `${gap} short of ${r.leaderName}’s ${recordValue(rec, r.leader)}`,
  }
}
