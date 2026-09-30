import type { Game } from '../data/games'
import type { HubDay, HubWeek } from '../hooks/useGameHub'
import { placeBeating, type BoardPlayer, type BoardYou } from './gameBoard'
import { numberWord } from './numberWord'
import { andList, barPosition, nextLine, shareLines, talksInPlaces } from './profileMath'
import { dayInFull, inPeriod } from './rankHow'
import { closestToInk, coverRecord, recordBrief, recordGap } from './recordBook'
import { recordShut } from './recordPage'
import type { RecordSummary } from './records'

/*
 * A game's page, worked out: where the viewer stands on its board and the one
 * run that moves them, the scores a first run could aim at, which records to put
 * in front of them, and which games to suggest next. The page only fetches and
 * lays out. Boards are best first, and a higher stored score is always the
 * better one, time boards included (they store inverted time).
 */

/** What beating one score does for a player: the place it takes and who it passes. */
export type Step = {
  /** The score to beat. */
  beat: number
  place: number
  /** The players it goes past, best first. */
  passes: string[]
}

/** The step from where `you` stand to just past `target`: past anyone tied with it too (gameBoard placeBeating). */
function stepFor(players: BoardPlayer[], you: BoardYou, target: number): Step {
  const place = placeBeating(players, target, you.player.name)
  const passes = players
    .filter((p) => p.place < you.player.place && p.best.score <= target)
    .map((p) => p.name)
  return { beat: target, place, passes }
}

export type Standing = {
  place: number
  field: number
  best: number
  runs: number
  /** Where the place sits along a bar of the whole board: 0 last, 1 first. */
  bar: number
  /** The board's share lines, where it is big enough for them: the page draws the bar only then, unmarked. */
  lines: { label: string; rank: number; at: number }[]
  /** The run that moves them next; none for the player in first, or once their run is in on a one-run board. */
  next: Step | null
  /** For the player in first: who is next, and how far back. */
  chaser: { name: string; gap: number; score: number } | null
  /** The board takes one run a player (gameBoard oneRunBoard) and theirs is in, so no run moves them now. */
  settled: boolean
}

/**
 * Where a player on the board stands and what to chase. In the top ten, or on
 * a small board, that is the place above; further down it is the next share
 * line (the top half, 25%, 10%), which means the same on a board of any size.
 * On a board that takes one run a player, theirs is it: nothing to chase.
 */
export function standingOn(players: BoardPlayer[], you: BoardYou, oneRun = false): Standing {
  const { player, field, above, below } = you
  const lines = shareLines(field).map((l) => ({ label: l.label, rank: l.rank, at: barPosition(l.rank, field) }))
  let next: Step | null = null
  if (above && !oneRun) {
    if (talksInPlaces(player.place, field)) {
      next = stepFor(players, you, above.best.score)
    } else {
      // Further down, the run to chase is the next share line's score; the page just doesn't name the line.
      const line = nextLine(player.place, field)
      const at = line ? players[line.rank - 1] : null
      next = stepFor(players, you, (at ?? above).best.score)
    }
  }
  return {
    place: player.place,
    field,
    best: player.best.score,
    runs: player.runs,
    bar: barPosition(player.place, field),
    lines,
    next,
    chaser: !above && below ? { name: below.name, gap: player.best.score - below.best.score, score: below.best.score } : null,
    settled: oneRun,
  }
}

/** A mark a first run could aim at: the score to beat (none: any run at all) and the place it takes. */
export type Aim = { label: string; beat: number | null; place: number }

/**
 * What a first run could aim at: the middle of the board, the top ten and the
 * record, each with the place it takes. On a daily's board, which is today's,
 * the top is 1st today: a course's record is the best on it of all time.
 */
export function firstRunAims(players: BoardPlayer[], daily = false): Aim[] {
  const field = players.length
  const aim = (label: string, at: BoardPlayer | undefined): Aim | null =>
    at ? { label, beat: at.best.score, place: placeBeating(players, at.best.score) } : null
  const aims = [
    // On a small board, just turning up; on a bigger one, the middle.
    field >= 6
      ? aim('Middle', players[Math.ceil(field / 2) - 1])
      : field > 0
        ? { label: 'Any run', beat: null, place: field + 1 }
        : null,
    field >= 14 ? aim('Top ten', players[9]) : null,
    aim(daily ? '1st today' : 'Record', players[0]),
  ].filter((a): a is Aim => a !== null)
  // Ties can make two marks the same run (beating the middle's score already reaches the top ten): keep the bigger claim.
  return aims.filter((a, i) => !aims.slice(i + 1).some((later) => later.place === a.place))
}

/* ---------- a daily, beyond today ---------- */

/**
 * Whether the viewer is new to a daily, back again, or not known to be either (their days didn't load):
 * someone back is never told about their "first run", and someone new is welcomed rather than measured.
 * No tag at all is new: nothing of theirs is on any board.
 */
export type DailyHistory = 'new' | 'back' | 'unknown'

export function dailyHistory(week: HubWeek | null, me: string): DailyHistory {
  if (!me) return 'new'
  if (!week) return 'unknown'
  return week.days.length > 0 ? 'back' : 'new'
}

const weekdayLong = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' })

/** Monday, from a board day's YYYY-MM-DD. */
function weekdayOf(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return weekdayLong.format(new Date(Date.UTC(y!, m! - 1, d!)))
}

/** 5th of 14 on Monday; on Monday alone when the place didn't come with it. */
function dayPlace(d: HubDay): string {
  return d.place != null ? `${ordinalOf(d.place)} of ${d.players} on ${weekdayOf(d.day)}` : `on ${weekdayOf(d.day)}`
}

/** The days this week before today that the viewer played, newest first: today's is on today's board. */
export function daysThisWeek(week: HubWeek, today: string): HubDay[] {
  return week.days.filter((d) => inPeriod(d.day, 'weekly', today) && d.day !== today)
}

/**
 * What a daily's week so far is made of, in places and days, never its points: "From one day so far: 5th
 * of 14 on Monday." Past three days, the best of them. Not played this week: the last day they did, or
 * null for someone who never has.
 */
export function weekSoFar(week: HubWeek, today: string): string | null {
  const thisWeek = daysThisWeek(week, today)
  if (thisWeek.length === 0) {
    const last = week.days.find((d) => d.day < today)
    if (!last) return null
    return last.place != null
      ? `You last played it on ${dayInFull(last.day)}: ${ordinalOf(last.place)} of ${last.players}.`
      : `You last played it on ${dayInFull(last.day)}.`
  }
  const oldestFirst = [...thisWeek].reverse()
  if (oldestFirst.length === 1) return `From one day so far: ${dayPlace(oldestFirst[0]!)}.`
  if (oldestFirst.length <= 3) {
    return `From ${numberWord(oldestFirst.length)} days so far: ${andList(oldestFirst.map(dayPlace))}.`
  }
  // The best day is the one that paid most; the latest when two paid the same.
  const best = oldestFirst.reduce((a, b) => ((b.points ?? 0) >= (a.points ?? 0) ? b : a))
  return `From ${numberWord(oldestFirst.length)} days so far. Your best: ${dayPlace(best)}.`
}

/* ---------- the record books ---------- */

export type RecordRow = {
  record: RecordSummary
  /** The number beside it: yours, the record's, or Open. */
  value: string
  note: string
  /** The one worth pointing at first: a record you are tied with, or one nobody holds. */
  hot: boolean
}

/**
 * The records to show on a game's page. For a player in the book: the ones
 * tied with the holder (one more run takes them, unless the record is shut:
 * recordPage recordShut), the ones they hold, the nearest, and one nobody has
 * set. For anyone else: the unset ones, then the book's best. A day's record
 * nobody set on its day stays unset for good, so it isn't one to point at.
 */
export function recordRows(records: RecordSummary[], me: string, limit = 4): { rows: RecordRow[]; yours: boolean } {
  const yours = Boolean(me) && records.some((r) => r.you)
  const open = records
    .filter((r) => !r.top && recordShut(r.game, r, false) !== 'over')
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
        const shut = recordShut(r.game, r, true)
        tied.push({
          record: r,
          value: recordBrief(r, you.score),
          note: `Tied with ${r.top.name}, who got there first.${shut ? '' : ' One better and it’s yours.'}`,
          hot: !shut,
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
    const firstOpen = open.slice(0, 1).map((row) => ({ ...row, hot: !tied.some((t) => t.hot) }))
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
