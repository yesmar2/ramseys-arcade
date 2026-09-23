import { getGame } from '../data/games'
import { normalizePlayerName } from './leaderboard'
import { numberWord } from './numberWord'
import { GAMES_WITH_RECORDS, type RecordGame, type RecordSummary } from './records'

/*
 * The record books' arithmetic and words: what a record's number means (a
 * time, a count of days, a combo), how the records in a book group, whose
 * name is in the most of them, what was set lately, and which ones a player
 * is closest to taking. The pages only fetch and lay out; this says it.
 */

type RecordLike = { id: string; unit: 'ms' | 'count' }

/** The books on show: every game with records, less the hidden ones. */
export const VISIBLE_RECORD_GAMES: readonly RecordGame[] = GAMES_WITH_RECORDS.filter(
  (g) => !getGame(g)?.hidden,
)

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
  'most-coins': ['coin', 'coins'],
  'near-misses': ['close call', 'close calls'],
  'most-rows': ['row', 'rows'],
  'chasers-eaten': ['chaser', 'chasers'],
}

/** A record's number in its own terms: 2:51.1, ×36, 19 days, 13 in a row, 33 coins. */
export function recordValue(record: RecordLike, score: number): string {
  if (record.unit === 'ms') return recordTime(score)
  if (record.id === 'highest-combo') return `×${score}`
  if (record.id === 'longest') return `length ${score}`
  const words = COUNT_WORDS[record.id]
  if (words) return `${score.toLocaleString()} ${score === 1 ? words[0] : words[1]}`
  if (record.id.endsWith('streak')) return `${score.toLocaleString()} in a row`
  return score.toLocaleString()
}

/** The number beside its own label, which already says what it counts: 46, not 46 in a row. */
export function recordBrief(record: RecordLike, score: number): string {
  if (record.unit === 'ms' || record.id === 'highest-combo') return recordValue(record, score)
  return score.toLocaleString()
}

/** The difference between two results, in the record's terms: 2.5s, 1 day, 3. */
export function recordGap(record: RecordLike, a: number, b: number): string {
  const gap = Math.abs(a - b)
  if (record.unit === 'ms') return recordTime(gap)
  const words = COUNT_WORDS[record.id]
  if (words) return `${gap.toLocaleString()} ${gap === 1 ? words[0] : words[1]}`
  return gap.toLocaleString()
}

/** How far a result is from the record, as a share of it, for putting the nearest first. */
function shareOff(record: RecordLike, you: number, top: number): number {
  const off = record.unit === 'ms' ? you - top : top - you
  return off / Math.max(1, Math.abs(top))
}

/* ---------- a book ---------- */

export type RecordKind = 'streaks' | 'run' | 'clock'

/** Streaks carry on across runs or within one; the clock is time to a milestone; the rest are the most in a run. */
export function recordKind(record: RecordLike): RecordKind {
  if (record.id.endsWith('streak')) return 'streaks'
  if (record.unit === 'ms') return 'clock'
  return 'run'
}

type ClockBook = { title: string; sub: string; short: (label: string) => string }

const CLOCKS: Partial<Record<string, ClockBook>> = {
  asteroids: {
    title: 'Wave clears',
    sub: 'From the start of a run to each wave cleared.',
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
  streaks: { title: 'Streaks', sub: 'Days played in a row, and strong runs in a row.' },
  run: { title: 'Best in a run', sub: 'The most anyone has managed in a single run.' },
  clock: { title: 'Against the clock', sub: 'The fastest times.' },
}

export type RecordGroup = {
  kind: RecordKind
  title: string
  sub: string
  records: RecordSummary[]
  /** A shorter label for a record inside its group: Wave 9, not Wave 9 clear. */
  short: (label: string) => string
}

/** A book's records in its three groups: streaks, best in a run, then the clock. */
export function recordGroups(game: string, records: RecordSummary[]): RecordGroup[] {
  const order: RecordKind[] = ['streaks', 'run', 'clock']
  return order
    .map((kind) => {
      const clock = kind === 'clock' ? CLOCKS[game] : undefined
      return {
        kind,
        title: clock?.title ?? GROUPS[kind].title,
        sub: clock?.sub ?? GROUPS[kind].sub,
        records: records.filter((r) => recordKind(r) === kind),
        short: clock?.short ?? ((label: string) => label),
      }
    })
    .filter((group) => group.records.length > 0)
}

/**
 * The record on a book's cover: the game's own before the streaks every book
 * has, and among times the hardest milestone.
 */
export function coverRecord(records: RecordSummary[]): RecordSummary | null {
  const held = records.filter((r) => r.top)
  const runs = held.filter((r) => recordKind(r) === 'run')
  const own = held.filter(
    (r) => recordKind(r) === 'streaks' && r.id !== 'play-days-streak' && r.id !== 'threshold-streak',
  )
  const clocks = held.filter((r) => recordKind(r) === 'clock').reverse()
  const threshold = held.filter((r) => r.id === 'threshold-streak')
  for (const pool of [runs, own, clocks, threshold, held]) {
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
    clock: (CLOCKS[game]?.title ?? 'fastest times').toLowerCase(),
    run: 'best single runs',
    streaks: 'longest streaks',
  }
  const order: RecordKind[] = ['clock', 'run', 'streaks']
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
            : record.unit === 'ms'
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
