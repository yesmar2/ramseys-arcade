import { normalizePlayerName } from './leaderboard'
import { numberWord } from './numberWord'
import {
  formatDayKey,
  siteRecordUnitWord,
  type SiteRecordBoard,
  type SiteRecordId,
  type SiteRecordStanding,
} from './siteRecords'

/*
 * The house book's arithmetic and words, as recordBook.ts is for a game's:
 * whose name is in the most of it, how its records group, what each leads
 * by, and which a player is closest to taking. The page only lays it out.
 */

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** A house record's number with its unit: 37 days, 1 board. */
export function houseValue(board: Pick<SiteRecordBoard, 'unit'>, value: number): string {
  return `${value.toLocaleString()} ${siteRecordUnitWord(value, board.unit)}`
}

/** A day a record was set, the way the books write one: Sep 3. */
export function houseDay(at: number | null): string {
  return (formatDayKey(at) ?? '').replace(/, \d{4}$/, '')
}

/** The line under a record's name: the day it was set, where it's about one day, or what kind of record it is. */
export function houseWhen(board: Pick<SiteRecordBoard, 'id'>, at: number | null): string {
  if (at) return `set ${houseDay(at)}`
  if (board.id === 'day-streak') return 'longest ever'
  if (board.id === 'boards-topped') return 'right now'
  return 'all time'
}

/** How many house records each player holds, most first. */
function holderCounts(boards: SiteRecordBoard[]): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const board of boards) {
    const top = board.entries[0]
    if (!top) continue
    const name = normalizePlayerName(top.name)
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/** The book's headline: whose name is in the most of it. */
export function houseHeadline(boards: SiteRecordBoard[]): { name: string; rest: string } {
  const total = boards.length
  const holders = holderCounts(boards)
  const [first, second] = holders
  if (!first) return { name: '', rest: 'Nobody’s name is in the house book yet.' }
  if (first.count === total) return { name: first.name, rest: ` holds every one of the ${total} house records.` }
  if (first.count === 1 && holders.length > 1) {
    return { name: '', rest: `${capital(numberWord(holders.length))} players share the ${total} house records.` }
  }
  if (second && second.count === first.count) {
    return { name: '', rest: `${first.name} and ${second.name} hold ${numberWord(first.count)} house records each.` }
  }
  return { name: first.name, rest: ` holds ${first.count} of the ${total} house records.` }
}

export const HOUSE_LEDE =
  'Not one game: all of them. Who keeps turning up, who plays the widest, and whose streak is still alive. Nobody sets out to break these; they’re read off the boards.'

export type HouseGroup = { key: string; title: string; sub: string; boards: SiteRecordBoard[] }

const GROUPS: { key: string; title: string; sub: string; ids: SiteRecordId[] }[] = [
  { key: 'turning-up', title: 'Turning up', sub: 'Coming back, day after day.', ids: ['day-streak', 'days-played'] },
  { key: 'big-days', title: 'Big days', sub: 'The most anyone has packed into one day.', ids: ['games-in-a-day', 'runs-in-a-day'] },
  {
    key: 'whole-arcade',
    title: 'Across the arcade',
    sub: 'How much of the arcade has your name on it.',
    ids: ['games-played', 'boards-topped'],
  },
]

/** The records in their groups, in the book's order; any the API adds later go at the end. */
export function houseGroups(boards: SiteRecordBoard[]): HouseGroup[] {
  const placed = new Set<string>()
  const out: HouseGroup[] = []
  for (const group of GROUPS) {
    const list = group.ids.map((id) => boards.find((b) => b.id === id)).filter((b): b is SiteRecordBoard => Boolean(b))
    list.forEach((b) => placed.add(b.id))
    if (list.length) out.push({ key: group.key, title: group.title, sub: group.sub, boards: list })
  }
  const rest = boards.filter((b) => !placed.has(b.id))
  if (rest.length) out.push({ key: 'more', title: 'More', sub: 'The rest of the house book.', boards: rest })
  return out
}

/** What the holder leads by: "by 13 days over LOOPER", "Tied with LOOPER", or nobody else on it yet. */
export function houseRunnerUp(board: SiteRecordBoard): string {
  const [top, second] = board.entries
  if (!top) return 'Be the first to set it'
  if (!second) return 'Nobody else yet'
  const name = normalizePlayerName(second.name)
  if (second.value === top.value) return `Tied with ${name}`
  return `by ${houseValue(board, top.value - second.value)} over ${name}`
}

/** Where you stand on a record, in the table's last column. */
export function houseYouLine(board: SiteRecordBoard, standing: SiteRecordStanding[SiteRecordId]): string {
  const top = board.entries[0]
  if (!top || !standing || standing.value <= 0) return ''
  if (standing.rank === 1) return 'Yours'
  if (standing.value === top.value) return standing.rank ? `You #${standing.rank} · tied` : 'Tied'
  const off = houseValue(board, top.value - standing.value)
  return standing.rank ? `You #${standing.rank} · ${off} off` : `You · ${off} off`
}

/** The records a player holds. */
export function houseHeld(boards: SiteRecordBoard[], you: string): SiteRecordBoard[] {
  if (!you) return []
  return boards.filter((b) => b.entries[0] && normalizePlayerName(b.entries[0].name) === you)
}

/** The records a player is nearest to taking, nearest first: on them, but not on top. */
export function houseClosest(
  boards: SiteRecordBoard[],
  standing: SiteRecordStanding | null,
  you: string,
): { board: SiteRecordBoard; value: number; rank: number | null; off: string }[] {
  if (!standing || !you) return []
  return boards
    .map((board) => {
      const top = board.entries[0]
      const mine = standing[board.id]
      if (!top || !mine || mine.value <= 0 || mine.rank === 1 || normalizePlayerName(top.name) === you) return null
      return { board, value: mine.value, rank: mine.rank, off: houseValue(board, top.value - mine.value), share: (top.value - mine.value) / top.value }
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => a.share - b.share)
    .slice(0, 3)
    .map(({ board, value, rank, off }) => ({ board, value, rank, off }))
}
