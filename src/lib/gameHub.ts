import type { Game } from '../data/games'
import { placePoints, type BoardPlayer, type BoardYou } from './gameBoard'
import { barPosition, nextLine, shareLines, talksInPlaces } from './profileMath'
import { closestToInk, coverRecord, recordBrief, recordGap } from './recordBook'
import type { RecordSummary } from './records'

/*
 * A game's page, worked out: where the viewer stands on its board and the one
 * run that moves them, what a first run would be worth, which records to put
 * in front of them, and which games to suggest next. The page only fetches and
 * lays out. Boards are best first, and a higher stored score is always the
 * better one, time boards included (they store inverted time).
 */

/** What beating one score does for a player: the place it takes, who it passes, what it pays. */
export type Step = {
  /** The score to beat. */
  beat: number
  place: number
  pays: number
  /** Points over what the player is paid now; for a new player, the whole of it. */
  gain: number
  /** The players it goes past, best first. */
  passes: string[]
  /** The share line it crosses into, when it crosses one: "Top half". */
  line: string | null
}

/** The place a run just better than `target` takes: above everyone at or below it. */
function placeBeating(players: BoardPlayer[], target: number, me: string): number {
  return players.filter((p) => p.name !== me && p.best.score > target).length + 1
}

/** The step from where `you` stand to just past `target`. */
function stepFor(players: BoardPlayer[], you: BoardYou, target: number, line: string | null): Step {
  const place = placeBeating(players, target, you.player.name)
  const pays = placePoints(place, you.field)
  const passes = players
    .filter((p) => p.place < you.player.place && p.best.score <= target)
    .map((p) => p.name)
  return { beat: target, place, pays, gain: Math.max(0, pays - you.player.pays), passes, line }
}

export type Standing = {
  place: number
  field: number
  pays: number
  best: number
  runs: number
  /** Where the place sits along a bar of the whole board: 0 last, 1 first. */
  bar: number
  /** The share lines to mark on the bar, where the board is big enough for them. */
  lines: { label: string; rank: number; at: number }[]
  /** The run that moves them next; none for the player in first. */
  next: Step | null
  /** For the player in first: who is next, and how far back. */
  chaser: { name: string; gap: number } | null
}

/**
 * Where a player on the board stands and what to chase. In the top ten, or on
 * a small board, that is the place above; further down it is the next share
 * line (the top half, 25%, 10%), which means the same on a board of any size.
 */
export function standingOn(players: BoardPlayer[], you: BoardYou): Standing {
  const { player, field, above, below } = you
  const lines = shareLines(field).map((l) => ({ label: l.label, rank: l.rank, at: barPosition(l.rank, field) }))
  let next: Step | null = null
  if (above) {
    if (talksInPlaces(player.place, field)) {
      next = stepFor(players, you, above.best.score, player.place - 1 === 10 ? 'Top ten' : null)
    } else {
      const line = nextLine(player.place, field)
      const at = line ? players[line.rank - 1] : null
      next = at ? stepFor(players, you, at.best.score, line!.label) : stepFor(players, you, above.best.score, null)
    }
  }
  return {
    place: player.place,
    field,
    pays: player.pays,
    best: player.best.score,
    runs: player.runs,
    bar: barPosition(player.place, field),
    lines,
    next,
    chaser: !above && below ? { name: below.name, gap: player.best.score - below.best.score } : null,
  }
}

/** A mark a first run could aim at: the score to beat (none: any run at all), the place it takes, and what the place pays. */
export type Aim = { label: string; beat: number | null; place: number; pays: number }

/**
 * What a first run is worth: the middle of the board, the top ten and the
 * record, each with the place and points it brings. Joining makes the field
 * one bigger, so the points are counted on that.
 */
export function firstRunAims(players: BoardPlayer[]): Aim[] {
  const field = players.length
  const aim = (label: string, at: BoardPlayer | undefined): Aim | null => {
    if (!at) return null
    const place = placeBeating(players, at.best.score, '')
    return { label, beat: at.best.score, place, pays: placePoints(place, field + 1) }
  }
  const aims = [
    // On a small board, what just turning up is worth; on a bigger one, the middle.
    field >= 6
      ? aim('Middle', players[Math.ceil(field / 2) - 1])
      : field > 0
        ? { label: 'Any run', beat: null, place: field + 1, pays: anyRunPays(field) }
        : null,
    field >= 14 ? aim('Top ten', players[9]) : null,
    aim('Record', players[0]),
  ].filter((a): a is Aim => a !== null)
  // Ties can make two marks the same run (beating the middle's score already reaches the top ten): keep the bigger claim.
  return aims.filter((a, i) => !aims.slice(i + 1).some((later) => later.place === a.place))
}

/** What any run at all pays, for a board with `field` players on it already. */
export function anyRunPays(field: number): number {
  return placePoints(field + 1, field + 1)
}

/* ---------- the record books ---------- */

export type RecordRow = {
  record: RecordSummary
  /** The number beside it: yours, the record's, or Open. */
  value: string
  note: string
  /** The one worth pointing at first: a record you are level with, or one nobody holds. */
  hot: boolean
}

/**
 * The records to show on a game's page. For a player in the book: the ones
 * level with the holder (one more run takes them), the ones they hold, the
 * nearest, and one nobody has set. For anyone else: the unset ones, then the
 * book's best.
 */
export function recordRows(records: RecordSummary[], me: string, limit = 4): { rows: RecordRow[]; yours: boolean } {
  const yours = Boolean(me) && records.some((r) => r.you)
  const open = records
    .filter((r) => !r.top)
    .map((record) => ({
      record,
      value: 'Open',
      note: yours ? 'Nobody has set it yet. Your next run could.' : 'Nobody has set it yet.',
      hot: false,
    }))

  if (yours) {
    const tied: RecordRow[] = []
    const held: RecordRow[] = []
    for (const r of records) {
      const you = r.you
      if (!you || !r.top) continue
      if (you.rank === 1) {
        const second = r.second
        const note = second
          ? second.score === you.score
            ? `Yours, tied with ${second.name}`
            : `Yours, ${recordGap(r, you.score, second.score)} ahead of ${second.name}`
          : 'Yours'
        held.push({ record: r, value: recordBrief(r, you.score), note, hot: false })
      } else if (you.score === r.top.score) {
        tied.push({
          record: r,
          value: recordBrief(r, you.score),
          note: `Level with ${r.top.name}, who got there first. One better and it’s yours.`,
          hot: true,
        })
      }
    }
    const near = closestToInk([{ game: records[0]?.game ?? '', records }], records.length)
      .filter(({ record }) => record.you && record.top && record.you.score !== record.top.score)
      .map(({ record, off }) => ({
        record,
        value: recordBrief(record, record.you!.score),
        note: `${ordinalOf(record.you!.rank)}${record.players ? ` of ${record.players}` : ''} · ${off}`,
        hot: false,
      }))
    const firstOpen = open.slice(0, 1).map((row) => ({ ...row, hot: tied.length === 0 }))
    const rows = [...tied, ...held, ...near.slice(0, 1), ...firstOpen, ...near.slice(1), ...open.slice(1)]
    return { rows: rows.slice(0, limit), yours }
  }

  const cover = coverRecord(records)
  const held = records
    .filter((r) => r.top)
    .sort((a, b) => (a === cover ? -1 : b === cover ? 1 : 0))
    .map((record) => {
      const top = record.top!
      const tie = record.second && record.second.score === top.score ? `, tied with ${record.second.name}` : ''
      return { record, value: recordBrief(record, top.score), note: `${top.name}${tie}`, hot: false }
    })
  const rows = [...open.slice(0, 1).map((row) => ({ ...row, hot: true })), ...held, ...open.slice(1)]
  return { rows: rows.slice(0, limit), yours }
}

function ordinalOf(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  const unit = n % 10
  return `${n}${unit === 1 ? 'st' : unit === 2 ? 'nd' : unit === 3 ? 'rd' : 'th'}`
}

/* ---------- more games ---------- */

/** Games to suggest from this one: its own kinds first, then the rest of the shelf. */
export function moreLike(game: Game, shelf: Game[], count = 6): Game[] {
  const tags = new Set(game.tags ?? [])
  const others = shelf.filter((g) => g.slug !== game.slug && !g.comingSoon)
  const shared = (g: Game) => (g.tags ?? []).filter((t) => tags.has(t)).length
  return [...others].sort((a, b) => shared(b) - shared(a)).slice(0, count)
}

/* ---------- scoring rows ---------- */

/** A scoring value in pieces, with its numbers (+10, ×2, 1.75×) apart so they can be bold. */
export function scoreBits(value: string): { text: string; strong: boolean }[] {
  const bits: { text: string; strong: boolean }[] = []
  const re = /[+−-]\d[\d,.]*|×\d[\d,.]*|\d[\d,.]*×/g
  let last = 0
  for (const m of value.matchAll(re)) {
    const at = m.index ?? 0
    if (at > last) bits.push({ text: value.slice(last, at), strong: false })
    bits.push({ text: m[0], strong: true })
    last = at + m[0].length
  }
  if (last < value.length) bits.push({ text: value.slice(last), strong: false })
  return bits
}
