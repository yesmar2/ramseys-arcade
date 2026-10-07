import { chosenSkin } from './skins'
import { getGame, isRankedGame } from '../data/games'
import { noteTicketsPaid, type RunTickets } from './tickets'
import { noteSeasonRun, type SeasonRun } from './season'
import { boardPlayer, gapBetween, gapFigure, type BoardPlayer } from './gameBoard'
import { refreshGlobalRank } from './globalRank'
import {
  addLeaderboardScore,
  fetchGlobalRank,
  getPlayerBoard,
  normalizePlayerName,
  type GlobalRankResult,
  type LeaderboardEntry,
  type LeaderboardPeriod,
  type SavedPlates,
  type SavedPours,
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
import { isRaceGame, raceGapWords } from './raceMedals'
import { ordinal, periodCopy, type PeriodCopy } from './scoreboard'
import { submitScoreToJoinedTournaments } from './tournaments'

/*
 * The run report: what one run did, and how loudly to say it.
 *
 * A run is saved, then the period's board is read back and set against itself
 * without the new run, which is how the report knows the names it passed. The
 * standings are read either side of the save for the overall place. From
 * those facts come the lines (your best, the board, the standings, the record
 * books), each in a tone, and one of three tiers: quiet for an ordinary run,
 * lit for a personal best or a top-ten place, big for the top of a board or a
 * new record, which also gets the race it won and confetti.
 */

export type ReportTier = 'quiet' | 'lit' | 'big'
export type ReportTone = 'plain' | 'accent' | 'gold'
export type ReportIcon = 'up' | 'crown' | 'book' | 'board' | 'target' | 'sum' | 'flag'

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
  /** Took first in the period's standings from somebody: the whole screen, before the report. */
  standingsTop: boolean
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
  /** The standings' period, the header's; left out, the board's. A daily's board is the day's, its Standings aren't. */
  standingsPeriod?: LeaderboardPeriod
  /** The player's best on this game before the run; 0 when there was none. */
  priorBest: number
  /** This run's place among every run ever, and the player's best's place before it. */
  allTimeRank: number | null
  priorAllTimeRank: number | null
  /** The period's board around the player, after the save, and where they stood on it before (boardFacts). */
  board: BoardFacts | null
  /** The player's Standings before and after the save; before is null when the read before the save failed. */
  overall: { before: GlobalRankResult | null; after: GlobalRankResult | null }
  books: BookFact[]
  /** The run's id on the boards, so it can go out as a challenge. */
  runId?: string | null
  /** A friend's challenge the run was played against, and how it went. */
  challenge?: { name: string; score: number; won: boolean; replyId: string | null } | null
  /** What the run paid in tickets; null when it paid none, undefined before it was saved. */
  tickets?: RunTickets | null
  /** What the run did on the season's pass, while a season is live. */
  season?: SeasonRun | null
}

/**
 * What a run report reads of the period's board, as players: how many, the first three, the player with
 * those either side after the save, the place they held before it (null: not on it), and who they went
 * past, named as far as the line names them (namesText: the first, then a count).
 */
export type BoardFacts = {
  field: number
  top: BoardPlayer[]
  you: BoardPlayer | null
  above: BoardPlayer | null
  below: BoardPlayer | null
  before: number | null
  /** The players passed, best first: the first two by name, the rest counted. */
  passed: string[]
}

/** BoardFacts from whole boards before and after (the dev celebrate page's made-up ones). */
export function boardFacts(after: BoardPlayer[], before: BoardPlayer[], me: string): BoardFacts {
  const at = after.findIndex((p) => p.name === me)
  const was = before.findIndex((p) => p.name === me)
  const you = after[at] ?? null
  const prior = was < 0 ? null : was + 1
  return {
    field: after.length,
    top: after.slice(0, 3),
    you,
    above: at > 0 ? after[at - 1]! : null,
    below: at >= 0 ? (after[at + 1] ?? null) : null,
    before: prior,
    passed: you && prior != null && you.place < prior ? after.slice(at + 1, prior).map((p) => p.name) : [],
  }
}

/** Players the report names among those passed; past them it counts (namesText). */
const PASSED_NAMED = 2
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

/** A board and its period read as a place: Crosswalk this month, Standings, all time. */
function scopeLabel(board: string, copy: PeriodCopy): string {
  return copy.noun ? `${board} ${copy.phrase}` : `${board}, all time`
}

function boardLabel(slug: string, copy: PeriodCopy): string {
  return scopeLabel(gameName(slug), copy)
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
    const gain = gapBetween(slug, score, priorBest)
    return {
      ...line,
      icon: 'up',
      detail: time ? `${gain} faster than ${figure(slug, priorBest)}` : `up ${gain} on ${figure(slug, priorBest)}`,
      value: figure(slug, score),
      tone: 'accent',
    }
  }
  if (score === priorBest) return { ...line, detail: 'Tied it', value: figure(slug, priorBest), tone: 'plain' }
  const gap = gapBetween(slug, priorBest, score)
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
  const b = f.board
  const label = boardLabel(slug, copy)
  const mine = b?.you
  if (!b || !mine) {
    // The board didn't read: the standings still know the place, when they cover the board's period.
    const place = (f.standingsPeriod ?? f.period) === f.period ? f.overall.after?.byGame[slug]?.place : undefined
    if (!place) return null
    const leader = b?.top[0]
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

  const place = mine.place
  const { before, above, below } = b
  const climbed = before == null || place < before
  // A racing daily's gaps read as its clock does (0.31s), and the one above is the place to take, as its
  // start card's ghost says ("Beat PILOT for 3rd"). Its boards keep a million less the ms, so a gap in
  // score is one in ms.
  const race = isRaceGame(slug)
  const gapOf = (higher: number, lower: number) => (race ? raceGapWords(higher - lower) : gapBetween(slug, higher, lower))
  const behind = (other: BoardPlayer) => {
    const gap = other.best.score - mine.best.score
    if (gap <= 0) return `tied with ${other.name}`
    return `${gapOf(other.best.score, mine.best.score)} behind ${other.name}${race ? ` for ${ordinal(other.place)}` : ''}`
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
    const lead = gapOf(mine.best.score, below.best.score)
    // First from somebody: the one now second held it before this run.
    if (before !== 1) return read(`passed ${below.name} by ${lead}`, 'gold', 'crown', true)
    return read(`${lead} ahead of ${below.name}`, 'plain')
  }
  // A racing daily's climb says where it came from and who's next above, not who it passed.
  if (race && before != null && place < before) {
    return read([`up from ${ordinal(before)}`, above ? behind(above) : null].filter(Boolean).join(' · '), 'accent', 'up')
  }
  if (before != null && place < before) {
    const passed = b.passed
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
  // The before read failed: whether the run moved the rank is unknown, so say nothing,
  // not "new on the standings" or a false "passed" at the top (which would also set newTop).
  if (!f.overall.before) return null
  const before = f.overall.before.rank ?? null
  const below = (after.nearby ?? []).find((n) => n.rank === rank + 1)
  // Every game added up: the Standings, as the Boards page names that table.
  // Beside the game's own line, "Overall" read as one more place on this game,
  // and "All games" as the list of games it names everywhere else on the site.
  const label = scopeLabel('Standings', copy)
  const line = (detail: string, tone: ReportTone, icon: ReportIcon, newTop = false) => ({
    line: { id: 'overall', icon, label, detail, value: `#${rank}`, tone },
    newTop,
  })
  // Said only when the run moved it, or kept first: the header already shows the rank.
  if (rank === 1) {
    if (!below) return line('Nobody else on it yet', 'plain', 'sum')
    if (before !== 1) return line(`passed ${below.name}`, 'gold', 'crown', true)
    return line(`still ahead of ${below.name}`, 'plain', 'sum')
  }
  if (before == null) return line('new on the standings', 'accent', 'up')
  if (rank < before) {
    const up = before - rank
    return line(`up ${up} ${up === 1 ? 'place' : 'places'}`, 'accent', 'up')
  }
  return null
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

/** A friend's challenge, as a line: beaten by how much, or how far short. */
export function challengeReportLine(slug: string, score: number, challenge: { name: string; score: number }): ReportLine {
  const won = score > challenge.score
  const gap = Math.abs(score - challenge.score)
  const words = gapBetween(slug, score, challenge.score)
  // A clock is "off" by its gap, as the record book says it, and slower reads as a plus.
  const time = isTimeBoard(slug)
  return {
    id: 'challenge',
    icon: 'flag',
    label: `${challenge.name}’s challenge`,
    detail: won
      ? `beat ${figure(slug, challenge.score)} by ${words}`
      : gap > 0
        ? `${words} ${time ? 'off' : 'short of'} ${figure(slug, challenge.score)}`
        : `tied with ${figure(slug, challenge.score)}, and a tie doesn’t beat it`,
    value: won ? 'Won' : gap > 0 ? (time ? `+${words}` : `−${gapFigure(slug, score, challenge.score)}`) : 'Tied',
    tone: won ? 'gold' : 'plain',
  }
}

/** The heading a beaten challenge gets. */
export const CHALLENGE_WON: ReportRibbon = { icon: 'flag', text: 'Challenge won', tone: 'gold' }

export function composeReport(f: RunFacts): RunReportData {
  const copy = periodCopy(f.period)
  const me = normalizePlayerName(f.name)
  // A daily just for fun places nobody (data/games.ts Game.ranked): no board, standings or record lines.
  const ranked = isRankedGame(f.slug)
  const board = ranked ? boardLine(f, copy) : null
  const overall = ranked ? overallLine(f, periodCopy(f.standingsPeriod ?? f.period)) : null
  const books = ranked
    ? [...f.books]
        .sort((a, b) => (a.hit.rank ?? 99) - (b.hit.rank ?? 99))
        .slice(0, MAX_BOOKS)
        .map((book, i) => bookLine(f, book, i))
    : []

  const isBest = f.priorBest > 0 && f.score > f.priorBest
  // The best run anyone has played: first of every run, over somebody else's.
  const highScore =
    ranked &&
    f.allTimeRank === 1 &&
    (f.priorAllTimeRank != null ? f.priorAllTimeRank > 1 : (f.board?.field ?? 0) >= 2)
  const bookTop = books.some((line) => line.tone === 'gold')

  const challenge = f.challenge ?? null
  const lines: ReportLine[] = []
  // A friend's challenge is what the run was for, so it is said first.
  if (challenge) lines.push(challengeReportLine(f.slug, f.score, challenge))
  lines.push(bestLine(f))
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
  if (challenge?.won) {
    tier = 'big'
    ribbon = CHALLENGE_WON
  } else if (overall?.newTop) {
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
          rows: f.board.top.map((p) => ({
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
    scoreTone: challenge?.won || highScore || board?.newTop ? 'gold' : isBest ? 'accent' : 'plain',
    lines: ordered,
    race,
    standingsTop: Boolean(overall?.newTop),
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
/**
 * The period's board around the player after the save, with where they stood before it (`before`, read
 * just ahead of the save), as the API counts places: a few small asks, however deep they are.
 */
async function readBoardFacts(slug: string, period: LeaderboardPeriod, me: string, before: number | null): Promise<BoardFacts> {
  const b = await getPlayerBoard(slug, period, me, { limit: 3, around: 1 })
  const you = b.you ? boardPlayer(b.you) : null
  const near = b.around.map(boardPlayer)
  let passed: string[] = []
  if (you && before != null && you.place < before) {
    // Now just behind you, best first: the first two by name, the rest only counted.
    const count = before - you.place
    const named = await getPlayerBoard(slug, period, undefined, { offset: you.place, limit: Math.min(PASSED_NAMED, count) })
      .then((p) => p.entries.map((e) => normalizePlayerName(e.name)))
      .catch(() => [] as string[])
    passed = [...named, ...Array.from({ length: Math.max(0, count - named.length) }, () => '')]
  }
  return {
    field: b.total,
    top: b.entries.map(boardPlayer),
    you,
    above: you ? (near.find((p) => p.place === you.place - 1) ?? null) : null,
    below: you ? (near.find((p) => p.place === you.place + 1) ?? null) : null,
    before,
    passed,
  }
}

/**
 * Where a score would place on the period's board, for a run not saved yet, as the API counts it among the
 * players (getPlayerBoard `would`): behind everyone at or above it, however deep. Null when it can't be read.
 */
export async function wouldPlaceOnBoard(
  slug: string,
  period: LeaderboardPeriod,
  score: number,
): Promise<number | null> {
  try {
    return (await getPlayerBoard(slug, period, undefined, { limit: 1, would: score })).wouldPlace
  } catch {
    return null
  }
}

type SaveInput = {
  slug: string
  name: string
  score: number
  period: LeaderboardPeriod
  /** The standings' period, when it isn't the board's (see RunFacts). */
  standingsPeriod?: LeaderboardPeriod
  priorBest: number
  /** A friend's challenge this run was played against. */
  challengeId?: string
  /** The run the score came from, asked for as it ended (see runIdFor). */
  run: Promise<string | undefined>
  /** Prize tickets the run picked up on the way (Crosswalk's). */
  pickups?: number
  /** Hot Lap: the day's blue car, in milliseconds. */
  pace?: number
  /** Half Full: the day's five pours, which the API scores the day from. */
  pours?: SavedPours
  /** Centroid: the day's six taps, which the API scores the day from. */
  plates?: SavedPlates
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

async function saveAndRead({ slug, name, score, period, standingsPeriod = period, priorBest, challengeId, run, pickups, pace, pours, plates }: SaveInput): Promise<RunFacts> {
  const me = normalizePlayerName(name)
  // A daily just for fun places nobody (data/games.ts Game.ranked): no standings or board to read around it.
  const ranked = isRankedGame(slug)
  // Where they stood before this run, on the Standings and on the game's board.
  const [priorOverall, priorPlace] = ranked
    ? await Promise.all([
        fetchGlobalRank(me, standingsPeriod).catch(() => null),
        getPlayerBoard(slug, period, me, { limit: 1, around: 0 })
          .then((b) => b.you?.place ?? null)
          .catch(() => null),
      ])
    : [null, null]
  // The skin the game drew the player in: the one chosen for it, if they own it (lib/skins.ts).
  const saved = await addLeaderboardScore(slug, me, score, { challengeId, run, pickups, pace, pours, plates, skin: chosenSkin(slug) })
  noteTicketsPaid(saved.tickets)
  noteSeasonRun(saved.season)
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
  void submitScoreToJoinedTournaments(slug, score, run).catch(() => {})
  rememberPersonalBest(slug, Math.max(priorBest, score))
  void refreshGlobalRank()

  // Record books the run filled can still be landing; give them a moment.
  await whenRunAchievementsSettled()
  const hits = takeRunAchievements()

  const [board, overall, books] = ranked
    ? await Promise.all([
        readBoardFacts(slug, period, me, priorPlace).catch(() => null),
        fetchGlobalRank(me, standingsPeriod).catch(() => null),
        readBookFacts(slug, me, hits),
      ])
    : [null, null, []]

  return {
    slug,
    score,
    name: me,
    period,
    standingsPeriod,
    priorBest,
    allTimeRank: saved.ranks?.all ?? null,
    priorAllTimeRank: saved.previousBestRanks?.all ?? null,
    board,
    overall: { before: priorOverall, after: overall },
    books,
    runId: saved.entry?.id ?? null,
    tickets: saved.tickets ?? null,
    season: saved.season ?? null,
    // Your own challenge played back is just a run.
    challenge:
      saved.challenge && saved.challenge.outcome !== 'own'
        ? {
            name: saved.challenge.name,
            score: saved.challenge.score,
            won: saved.challenge.outcome === 'won',
            replyId: saved.challenge.replyId,
          }
        : null,
  }
}

