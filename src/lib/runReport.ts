import { getGame } from '../data/games'
import { gapText, playersFromRuns, wouldPlace, type BoardPlayer } from './gameBoard'
import { refreshGlobalRank } from './globalRank'
import {
  addLeaderboardScore,
  fetchGlobalRank,
  getLeaderboard,
  normalizePlayerName,
  type GlobalRankResult,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from './leaderboard'
import { formatLeaderboardScore, isTimeBoard } from './leaderboardFormat'
import { rememberPersonalBest } from './personalBest'
import { recordBrief } from './recordBook'
import { fetchRecordBoard, shouldCelebrateRecordSubmit, type RecordDef } from './records'
import {
  pushRunAchievement,
  takeRunAchievements,
  whenRunAchievementsSettled,
  type RunAchievement,
} from './runAchievements'
import { ordinal, periodCopy, type PeriodCopy } from './scoreboard'
import { submitScoreToJoinedTournaments } from './tournaments'

/*
 * The run report: what one run did, and how loudly to say it.
 *
 * A run is saved, then the period's board is read back and set against itself
 * without the new run, which is how the report knows the names it passed. The
 * standings are read either side of the save for the overall place. From
 * those facts come the lines (your best, the board, overall, the record
 * books), each in a tone, and one of three tiers: quiet for an ordinary run,
 * lit for a personal best or a top-ten place, big for the top of a board or a
 * new record, which also gets the race it won and confetti.
 */

export type ReportTier = 'quiet' | 'lit' | 'big'
export type ReportTone = 'plain' | 'accent' | 'gold'
export type ReportIcon = 'up' | 'crown' | 'book' | 'board' | 'target' | 'sum'

export type ReportLine = {
  id: string
  icon: ReportIcon
  label: string
  detail: string | null
  value: string
  tone: ReportTone
}

export type ReportRibbon = { icon: ReportIcon; text: string; tone: 'accent' | 'gold' }

export type ReportRaceRow = {
  place: number
  name: string
  score: string
  mine: boolean
  note: string | null
  /** Your place before this run; null when it is new to the board. */
  from?: number | null
  avatarId?: string
}

export type ReportRace = { title: string; rows: ReportRaceRow[] }

export type RunReportData = {
  tier: ReportTier
  ribbon: ReportRibbon | null
  /** The big figure: gold when it tops a board, the game's colour for a personal best. */
  scoreTone: ReportTone
  lines: ReportLine[]
  race: ReportRace | null
  avatarId?: string
}

/** A record-book win, with who holds that record and whose it was before. */
export type BookFact = {
  hit: RunAchievement
  record: RecordDef | null
  holder: LeaderboardEntry | null
  /** The record this run broke: null when it was the first, undefined when unknown. */
  previous?: LeaderboardEntry | null
}

export type RunFacts = {
  slug: string
  score: number
  name: string
  period: LeaderboardPeriod
  /** The player's best on this game before the run; 0 when there was none. */
  priorBest: number
  /** This run's place among every run ever, and the player's best's place before it. */
  allTimeRank: number | null
  priorAllTimeRank: number | null
  /** The period's board as players, after the save and as it stood without this run. */
  board: { after: BoardPlayer[]; before: BoardPlayer[] } | null
  overall: { before: GlobalRankResult | null; after: GlobalRankResult | null }
  books: BookFact[]
}

/** Runs read to count places: one page covers every run above all but the lowest scores. */
const BOARD_READ = 500
/** Record-book lines on one report, at most. */
const MAX_BOOKS = 3
const MAX_LINES = 5

function gameName(slug: string): string {
  return getGame(slug)?.name ?? slug
}

function figure(slug: string, score: number): string {
  return formatLeaderboardScore(slug, score)
}

/** WES; WES and CHEF; WES and 3 more. */
function namesText(names: string[]): string {
  if (names.length <= 2) return names.join(' and ')
  return `${names[0]} and ${names.length - 1} more`
}

function pointsText(points: number): string {
  return `${points.toLocaleString()} point${points === 1 ? '' : 's'}`
}

/** "this month", or "all time" read as a place: Crosswalk this month, Crosswalk all time. */
function boardLabel(slug: string, copy: PeriodCopy): string {
  return `${gameName(slug)} ${copy.phrase}`
}

/* ---------- the lines ---------- */

function bestLine(f: RunFacts): ReportLine {
  const { slug, score, priorBest } = f
  const line = { id: 'best', icon: 'target' as ReportIcon, label: 'Your best' }
  const time = isTimeBoard(slug)
  if (priorBest <= 0) {
    return { ...line, detail: `Your first ${gameName(slug)} score`, value: figure(slug, score), tone: 'plain' }
  }
  if (score > priorBest) {
    const gain = gapText(slug, score - priorBest)
    return {
      ...line,
      icon: 'up',
      detail: time ? `${gain} faster than ${figure(slug, priorBest)}` : `up ${gain} on ${figure(slug, priorBest)}`,
      value: figure(slug, score),
      tone: 'accent',
    }
  }
  if (score === priorBest) return { ...line, detail: 'Tied it', value: figure(slug, priorBest), tone: 'plain' }
  const gap = gapText(slug, priorBest - score)
  return {
    ...line,
    detail: time ? `${gap} off it` : `${gap} more to beat it`,
    value: figure(slug, priorBest),
    tone: 'plain',
  }
}

type BoardRead = {
  line: ReportLine
  place: number
  before: number | null
  /** Took first from somebody. */
  newTop: boolean
  /** Moved up, or arrived. */
  climbed: boolean
}

function boardLine(f: RunFacts, copy: PeriodCopy): BoardRead | null {
  const { slug } = f
  const me = normalizePlayerName(f.name)
  const after = f.board?.after ?? []
  const label = boardLabel(slug, copy)
  const index = after.findIndex((p) => p.name === me)
  if (index < 0) {
    // Below the runs read: the standings still know the place.
    const place = f.overall.after?.byGame[slug]?.place
    if (!place) return null
    const leader = after[0]
    return {
      line: {
        id: 'board',
        icon: 'board',
        label,
        detail: leader ? `${leader.name} leads with ${figure(slug, leader.best.score)}` : null,
        value: `#${place}`,
        tone: 'plain',
      },
      place,
      before: null,
      newTop: false,
      climbed: false,
    }
  }

  const place = index + 1
  const mine = after[index]
  const beforeIndex = (f.board?.before ?? []).findIndex((p) => p.name === me)
  const before = beforeIndex < 0 ? null : beforeIndex + 1
  const above = after[index - 1] ?? null
  const below = after[index + 1] ?? null
  const climbed = before == null || place < before
  const behind = (other: BoardPlayer) => {
    const gap = other.best.score - mine.best.score
    return gap > 0 ? `${gapText(slug, gap)} behind ${other.name}` : `level with ${other.name}`
  }
  const read = (detail: string | null, tone: ReportTone, icon: ReportIcon = 'board', newTop = false): BoardRead => ({
    line: { id: 'board', icon, label, detail, value: `#${place}`, tone },
    place,
    before,
    newTop,
    climbed,
  })

  if (place === 1) {
    if (!below) return read(before == null ? 'The first run on the board' : 'Nobody else on it yet', 'plain')
    const lead = gapText(slug, mine.best.score - below.best.score)
    // First from somebody: the one now second held it before this run.
    if (before !== 1) return read(`passed ${below.name} by ${lead}`, 'gold', 'crown', true)
    return read(`${lead} ahead of ${below.name}`, 'plain')
  }
  if (before != null && place < before) {
    const passed = after.slice(index + 1, before).map((p) => p.name)
    const detail = passed.length ? `up from ${ordinal(before)}, passed ${namesText(passed)}` : `up from ${ordinal(before)}`
    return read(detail, 'accent', 'up')
  }
  if (before == null) return read(above ? behind(above) : null, place <= 10 ? 'accent' : 'plain', place <= 10 ? 'up' : 'board')
  return read(above ? behind(above) : null, 'plain')
}

function overallLine(f: RunFacts, copy: PeriodCopy): { line: ReportLine; newTop: boolean } | null {
  const after = f.overall.after
  const rank = after?.rank
  if (!after || !rank) return null
  const before = f.overall.before?.rank ?? null
  const points = pointsText(after.score)
  const near = after.nearby ?? []
  const above = near.find((n) => n.rank === rank - 1)
  const below = near.find((n) => n.rank === rank + 1)
  const label = copy.noun ? `Overall ${copy.phrase}` : 'Overall, all time'
  const line = (detail: string, tone: ReportTone, icon: ReportIcon, newTop = false) => ({
    line: { id: 'overall', icon, label, detail, value: `#${rank}`, tone },
    newTop,
  })
  if (rank === 1) {
    if (!below) return line(points, 'plain', 'sum')
    if (before !== 1) return line(`${points}, passed ${below.name}`, 'gold', 'crown', true)
    return line(`${points}, ${(after.score - below.score).toLocaleString()} ahead of ${below.name}`, 'plain', 'sum')
  }
  if (before == null) return line(`${points}, new on the standings`, 'accent', 'up')
  if (rank < before) return line(`${points}, up ${before - rank}`, 'accent', 'up')
  if (above) {
    const gap = above.score - after.score
    return line(gap > 0 ? `${points}, ${gap.toLocaleString()} behind ${above.name}` : `${points}, level with ${above.name}`, 'plain', 'sum')
  }
  return line(points, 'plain', 'sum')
}

function bookLine(f: RunFacts, book: BookFact, i: number): ReportLine {
  const me = normalizePlayerName(f.name)
  const { hit, record } = book
  const brief = (e: LeaderboardEntry) => (record ? recordBrief(record, e.score) : e.score.toLocaleString())
  const value = hit.value ?? (hit.rank != null ? `#${hit.rank}` : 'New')
  const line = { id: `book-${i}`, icon: 'book' as ReportIcon, label: hit.label, value }
  if (hit.rank === 1) {
    const previous = book.previous
    const detail =
      previous === null
        ? 'The first in the book'
        : previous
          ? normalizePlayerName(previous.name) === me
            ? `beat your own ${brief(previous)}`
            : `${previous.name} held it with ${brief(previous)}`
          : 'A new record'
    return { ...line, detail, tone: 'gold' }
  }
  const holder = book.holder && normalizePlayerName(book.holder.name) !== me ? book.holder : null
  const where = hit.rank != null ? `${ordinal(hit.rank)} in the book` : 'In the book'
  return { ...line, detail: holder ? `${where}, ${holder.name} holds it` : where, tone: 'accent' }
}

/* ---------- the report ---------- */

const TONE_ORDER: Record<ReportTone, number> = { gold: 0, accent: 1, plain: 2 }

export function composeReport(f: RunFacts): RunReportData {
  const copy = periodCopy(f.period)
  const me = normalizePlayerName(f.name)
  const board = boardLine(f, copy)
  const overall = overallLine(f, copy)
  const books = [...f.books]
    .sort((a, b) => (a.hit.rank ?? 99) - (b.hit.rank ?? 99))
    .slice(0, MAX_BOOKS)
    .map((book, i) => bookLine(f, book, i))

  const isBest = f.priorBest > 0 && f.score > f.priorBest
  // The best run anyone has played: first of every run, over somebody else's.
  const highScore =
    f.allTimeRank === 1 &&
    (f.priorAllTimeRank != null ? f.priorAllTimeRank > 1 : (f.board?.after.length ?? 0) >= 2)
  const bookTop = books.some((line) => line.tone === 'gold')

  const lines: ReportLine[] = [bestLine(f)]
  if (board) lines.push(board.line)
  if (highScore && f.period !== 'all') {
    lines.push({
      id: 'all-time',
      icon: 'crown',
      label: `${gameName(f.slug)} all time`,
      detail: 'The best run anyone has played',
      value: '#1',
      tone: 'gold',
    })
  }
  if (overall) lines.push(overall.line)
  lines.push(...books)
  // Loudest first, each tone in reading order.
  const ordered = lines
    .map((line, i) => ({ line, i }))
    .sort((a, b) => TONE_ORDER[a.line.tone] - TONE_ORDER[b.line.tone] || a.i - b.i)
    .map(({ line }) => line)
    .slice(0, MAX_LINES)

  let tier: ReportTier = 'quiet'
  let ribbon: ReportRibbon | null = null
  if (overall?.newTop) {
    tier = 'big'
    ribbon = { icon: 'crown', text: 'Top of the standings', tone: 'gold' }
  } else if (highScore) {
    tier = 'big'
    ribbon = { icon: 'crown', text: 'The high score', tone: 'gold' }
  } else if (board?.newTop) {
    tier = 'big'
    ribbon = { icon: 'crown', text: 'Top of the board', tone: 'gold' }
  } else if (bookTop) {
    tier = 'big'
    ribbon = { icon: 'book', text: 'New record', tone: 'gold' }
  } else if (isBest) {
    tier = 'lit'
    ribbon = { icon: 'up', text: 'New personal best', tone: 'accent' }
  } else if (board?.climbed && board.place <= 10) {
    tier = 'lit'
    ribbon = { icon: 'up', text: `${ordinal(board.place)} ${copy.phrase}`, tone: 'accent' }
  } else if (books.length) {
    tier = 'lit'
    ribbon = { icon: 'book', text: 'In the record book', tone: 'accent' }
  }

  const race: ReportRace | null =
    board?.newTop && f.board
      ? {
          title: `${gameName(f.slug)} · ${copy.phrase}`,
          rows: f.board.after.slice(0, 3).map((p) => ({
            place: p.place,
            name: p.name,
            score: figure(f.slug, p.best.score),
            mine: p.name === me,
            note: p.name === me ? (board.before != null ? `up from ${ordinal(board.before)}` : 'new') : null,
            from: p.name === me ? board.before : null,
            avatarId: p.best.avatarId,
          })),
        }
      : null

  return {
    tier,
    ribbon,
    scoreTone: highScore || board?.newTop ? 'gold' : isBest ? 'accent' : 'plain',
    lines: ordered,
    race,
    avatarId: f.overall.after?.avatarId,
  }
}

/* ---------- reading the facts ---------- */

/** The record a win was in, who holds it, and whose it was before this run. */
async function readBook(slug: string, me: string, hit: RunAchievement): Promise<BookFact> {
  const prefix = `${slug}:`
  const recordId = hit.id?.startsWith(prefix) ? hit.id.slice(prefix.length) : null
  if (!recordId) return { hit, record: null, holder: null }
  try {
    const board = await fetchRecordBoard(slug, recordId, 'all', me, { limit: 1 })
    const holder = board.entries[0] ?? null
    const progression = board.progression
    let previous: LeaderboardEntry | null | undefined
    const last = progression?.[progression.length - 1]
    // The newest setting is this run when it broke the record; the one before is what it broke.
    if (progression && last && normalizePlayerName(last.name) === me) {
      previous = progression[progression.length - 2] ?? null
    }
    return { hit, record: board.record ?? null, holder, previous }
  } catch {
    return { hit, record: null, holder: null }
  }
}

export async function readBookFacts(slug: string, name: string, hits: RunAchievement[]): Promise<BookFact[]> {
  const me = normalizePlayerName(name)
  const top = [...hits].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)).slice(0, MAX_BOOKS)
  return Promise.all(top.map((hit) => readBook(slug, me, hit)))
}

/** The runs this period, best first, as far as one read goes. */
async function readBoardRuns(slug: string, period: LeaderboardPeriod) {
  return getLeaderboard(slug, period, undefined, { limit: BOARD_READ })
}

/**
 * Where a score would place on the period's board, for a run not saved yet;
 * null when the board can't be read, or the score falls below what was read.
 */
export async function wouldPlaceOnBoard(
  slug: string,
  period: LeaderboardPeriod,
  score: number,
): Promise<number | null> {
  try {
    const board = await readBoardRuns(slug, period)
    const lowest = board.entries[board.entries.length - 1]
    if (board.entries.length < board.total && lowest && score < lowest.score) return null
    return wouldPlace(playersFromRuns(board.entries), score).place
  } catch {
    return null
  }
}

type SaveInput = {
  slug: string
  name: string
  score: number
  period: LeaderboardPeriod
  priorBest: number
}

/** Saves in flight or just done, so the same run asked twice is saved once. */
const recentSaves = new Map<string, { at: number; promise: Promise<RunFacts> }>()
const SAVE_REUSE_MS = 8000

/**
 * Save a run to the boards and read back what it did.
 *
 * The save goes through whatever happens to the card that asked for it: a
 * player who presses Play again at once still has the run on the boards. A
 * second ask for the same run while the first is in flight gets the first.
 */
export function saveRunForReport(input: SaveInput): Promise<RunFacts> {
  const key = `${input.slug}|${input.name}|${input.score}`
  const recent = recentSaves.get(key)
  if (recent && Date.now() - recent.at < SAVE_REUSE_MS) return recent.promise
  const promise = saveAndRead(input)
  recentSaves.set(key, { at: Date.now(), promise })
  // A save that failed can be tried again straight away.
  promise.catch(() => {
    if (recentSaves.get(key)?.promise === promise) recentSaves.delete(key)
  })
  return promise
}

async function saveAndRead({ slug, name, score, period, priorBest }: SaveInput): Promise<RunFacts> {
  const me = normalizePlayerName(name)
  const priorOverall = await fetchGlobalRank(me, period).catch(() => null)
  const saved = await addLeaderboardScore(slug, me, score)
  for (const hit of saved.streakRecords ?? []) {
    if (
      shouldCelebrateRecordSubmit({ improved: hit.improved, rank: hit.rank, totalEntries: hit.totalEntries })
    ) {
      pushRunAchievement({
        id: `${slug}:${hit.recordId}`,
        label: hit.label,
        value: hit.recordId === 'play-days-streak' ? `${hit.value} day${hit.value === 1 ? '' : 's'}` : `${hit.value}×`,
        rank: hit.rank,
      })
    }
  }
  void submitScoreToJoinedTournaments(slug, score).catch(() => {})
  rememberPersonalBest(slug, Math.max(priorBest, score))
  void refreshGlobalRank()

  // Record books the run filled can still be landing; give them a moment.
  await whenRunAchievementsSettled()
  const hits = takeRunAchievements()

  const [runs, overall, books] = await Promise.all([
    readBoardRuns(slug, period)
      .then((b) => b.entries)
      .catch(() => null),
    fetchGlobalRank(me, period).catch(() => null),
    readBookFacts(slug, me, hits),
  ])

  let board: RunFacts['board'] = null
  if (runs) {
    const newest = saved.entry?.id ?? newestRunId(runs, me, score)
    board = {
      after: playersFromRuns(runs),
      before: playersFromRuns(newest ? runs.filter((r) => r.id !== newest) : runs),
    }
  }

  return {
    slug,
    score,
    name: me,
    period,
    priorBest,
    allTimeRank: saved.ranks?.all ?? null,
    priorAllTimeRank: saved.previousBestRanks?.all ?? null,
    board,
    overall: { before: priorOverall, after: overall },
    books,
  }
}

/** This run on a board read back without its id: the player's latest run at that score. */
function newestRunId(runs: LeaderboardEntry[], me: string, score: number): string | null {
  let newest: LeaderboardEntry | null = null
  for (const run of runs) {
    if (normalizePlayerName(run.name) !== me || run.score !== score) continue
    if (!newest || run.at > newest.at) newest = run
  }
  return newest?.id ?? null
}
