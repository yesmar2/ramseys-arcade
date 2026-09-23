import { PERIOD_LABELS, type GlobalGamePlace, type LeaderboardPeriod } from './leaderboard'
import { formatLeaderboardScore, isTimeBoard } from './leaderboardFormat'

/*
 * The arithmetic behind a player's card. Global points are shares: each game
 * pays 1 to 100 by the share of its field a player beats, so a player's points
 * mean the same with a hundred players or ten thousand, and only places grow.
 * The page leans on that: past the top ten it talks in gaps to share lines,
 * which read the same at any size, rather than in places, which don't.
 */

/** Placement points as the API awards them: 1st of the field about 100, last about 1. */
export function placePoints(place: number, field: number): number {
  if (place < 1 || field < 1 || place > field) return 0
  return Math.max(1, Math.round((100 * (field - place + 1)) / field))
}

/** "this week" / "this month" / "all time", mid-sentence. */
export function periodWord(period: LeaderboardPeriod): string {
  return PERIOD_LABELS[period].toLowerCase()
}

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st. */
export function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  const unit = n % 10
  return `${n}${unit === 1 ? 'st' : unit === 2 ? 'nd' : unit === 3 ? 'rd' : 'th'}`
}

/** 1 point, 2 points. */
export function pointsWord(n: number): string {
  return `${n.toLocaleString()} ${n === 1 ? 'point' : 'points'}`
}

/** 1 pt, 2 pts. */
export function pts(n: number): string {
  return `${n.toLocaleString()} ${n === 1 ? 'pt' : 'pts'}`
}

/** Below this many players, shares say little, and the card talks about the players around you instead. */
const SHARE_FIELD_MIN = 20

/** The places that are always named: the top ten. */
export const TOP_TEN = 10

export type ShareLineKey = 'half' | 'quarter' | 'tenth' | 'ten'

/** A line across the arcade's board: everyone at `rank` or better is inside it. */
export type ShareLine = { key: ShareLineKey; label: string; rank: number }

/**
 * The lines on a board of `field` players, loosest first: the top half, the
 * top 25%, the top 10% and the top ten. A share line that falls inside the
 * top ten, or on another line, is left out.
 */
export function shareLines(field: number): ShareLine[] {
  if (field <= SHARE_FIELD_MIN) return []
  const lines: ShareLine[] = [
    { key: 'half', label: 'Top half', rank: Math.floor(field / 2) },
    { key: 'quarter', label: 'Top 25%', rank: Math.floor(field / 4) },
    { key: 'tenth', label: 'Top 10%', rank: Math.floor(field / 10) },
  ]
  const out = lines.filter((line) => line.rank > TOP_TEN)
  out.push({ key: 'ten', label: 'Top ten', rank: TOP_TEN })
  return out.filter((line, i) => out.findIndex((l) => l.rank === line.rank) === i)
}

/**
 * Whether a place is best told as a place among named players (the top ten,
 * or any place on a small board) or as a gap to the next share line.
 */
export function talksInPlaces(rank: number, field: number): boolean {
  return rank <= TOP_TEN || field <= SHARE_FIELD_MIN
}

/** The tightest line still ahead of a place: the one to chase next. */
export function nextLine(rank: number, field: number): ShareLine | null {
  const ahead = shareLines(field).filter((line) => line.rank < rank)
  return ahead[0] ?? null
}

/** Where a place sits along a bar of the whole board: 0 is last place, 1 is first. */
export function barPosition(rank: number, field: number): number {
  if (field <= 1) return 1
  return Math.min(1, Math.max(0, (field - rank) / (field - 1)))
}

/** Points needed to go past a score: one more than the gap, and never less than one. */
export function toPass(theirs: number, mine: number): number {
  return Math.max(1, theirs - mine + 1)
}

export type ByGame = Partial<Record<string, GlobalGamePlace>>

export type Climb = { slug: string; places: number; gain: number }

/**
 * The fewest places to climb on one game already placed on to gain more than
 * `gap` points, the field staying as it is. Null when no single game can.
 */
export function cheapestClimb(mine: ByGame, gap: number): Climb | null {
  let best: Climb | null = null
  for (const [slug, row] of Object.entries(mine)) {
    if (!row || !row.total || row.place <= 1) continue
    for (let places = 1; places < row.place; places++) {
      const gain = placePoints(row.place - places, row.total) - row.points
      if (gain > gap) {
        if (!best || places < best.places || (places === best.places && gain > best.gain)) {
          best = { slug, places, gain }
        }
        break
      }
    }
  }
  return best
}

export type SharedGame = { slug: string; mine: number; theirs: number }

/** The games two players both placed on, with each one's place, best-placed first. */
export function sharedGames(mine: ByGame, theirs: ByGame): SharedGame[] {
  const out: SharedGame[] = []
  for (const [slug, row] of Object.entries(mine)) {
    const other = theirs[slug]
    if (row && other) out.push({ slug, mine: row.place, theirs: other.place })
  }
  return out.sort((a, b) => Math.min(a.mine, a.theirs) - Math.min(b.mine, b.theirs))
}

/** Head to head on the games both placed on: who placed higher on how many. */
export function headToHead(shared: SharedGame[]): { mine: number; theirs: number } {
  let mine = 0
  let theirs = 0
  for (const g of shared) {
    if (g.mine < g.theirs) mine++
    else if (g.theirs < g.mine) theirs++
  }
  return { mine, theirs }
}

export type Unshared = { slugs: string[]; points: number }

/** The games one player has points on that the other hasn't placed on, most points first, and those points summed. */
export function pointsFromMissing(theirs: ByGame, mine: ByGame): Unshared {
  const rows = Object.entries(theirs)
    .filter(([slug, row]) => row && !mine[slug])
    .sort((a, b) => (b[1]?.points ?? 0) - (a[1]?.points ?? 0))
  return {
    slugs: rows.map(([slug]) => slug),
    points: rows.reduce((sum, [, row]) => sum + (row?.points ?? 0), 0),
  }
}

/** A list read as a sentence: Snake, Pellets and Putt; past `most`, the rest counted: Snake, Pellets, Putt and 4 more. */
export function andList(items: string[], most = 5): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length > most) return `${items.slice(0, most - 1).join(', ')} and ${items.length - (most - 1)} more`
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** What each game counts, where it is not points. Time boards read as a clock. */
const UNITS: Record<string, [string, string]> = {
  crosswalk: ['row', 'rows'],
  stacker: ['block', 'blocks'],
  simon: ['round', 'rounds'],
}

/** A score in the game's own unit: 432 rows, 1 block, 13,110 pts, 12.4s. */
export function scoreWithUnit(slug: string, score: number): string {
  const figure = formatLeaderboardScore(slug, score)
  if (isTimeBoard(slug)) return figure
  const [one, many] = UNITS[slug] ?? ['pt', 'pts']
  return `${figure} ${score === 1 ? one : many}`
}

/** The game a player does best on, all time: the run that beats the biggest share of its board. */
export function bestBoard<T extends { rank: number; total: number }>(bests: Record<string, T>): T | null {
  let best: T | null = null
  for (const b of Object.values(bests)) {
    if (!b.total) continue
    const share = b.rank / b.total
    if (!best || share < best.rank / best.total || (share === best.rank / best.total && b.rank < best.rank)) best = b
  }
  return best
}

/**
 * The lines of an all-time board of runs, for a player's best run: the
 * record, the top three, the top ten, and the top 10%, 25% and half of every
 * run. The loosest one still ahead of a run is the next to chase.
 */
export function nextRunLine(rank: number, total: number): { rank: number; label: string } | null {
  if (rank <= 1) return null
  const lines = [
    { rank: Math.floor(total / 2), label: 'top half' },
    { rank: Math.floor(total / 4), label: 'top 25%' },
    { rank: Math.floor(total / 10), label: 'top 10%' },
    { rank: TOP_TEN, label: 'top ten' },
    { rank: 3, label: 'top three' },
    { rank: 1, label: 'record' },
  ].filter((line, i, all) => line.rank >= 1 && all.findIndex((l) => l.rank === line.rank) === i)
  return lines.find((line) => line.rank < rank) ?? null
}
