import { getGame } from '../data/games'
import { normalizePlayerName, type LeaderboardEntry, type LeaderboardPeriod } from './leaderboard'
import {
  formatLeaderboardScore,
  formatPercentGap,
  formatTimeGap,
  isInvertedBoard,
  isPercentBoard,
  isTimeBoard,
} from './leaderboardFormat'
import { numberWord } from './numberWord'
import { ordinal, type PeriodCopy, type Stat } from './scoreboard'

/*
 * One game's board as players rather than runs. The API lists runs, best
 * first, so one player can hold several places in a row; a player's place is
 * their best run's. Everything the game board page says about places, gaps
 * and the scores to beat is worked out here from the runs.
 */

/** One player on a board: their best run and how many runs they have. */
export type BoardPlayer = {
  place: number
  name: string
  best: LeaderboardEntry
  runs: number
}

/** A board's runs, best first, as players: each at their best run, with a count of their runs. */
export function playersFromRuns(runs: LeaderboardEntry[]): BoardPlayer[] {
  const byName = new Map<string, { best: LeaderboardEntry; runs: number }>()
  const order: string[] = []
  for (const run of runs) {
    const name = normalizePlayerName(run.name ?? '')
    if (!name) continue
    const seen = byName.get(name)
    if (seen) {
      seen.runs++
    } else {
      byName.set(name, { best: run, runs: 1 })
      order.push(name)
    }
  }
  return order.map((name, i) => {
    const { best, runs: count } = byName.get(name)!
    return { place: i + 1, name, best, runs: count }
  })
}

/**
 * The place a run just better than `score` takes: above everyone at or below it, so past anyone tied
 * with it as well (two tied on top, and beating their score takes 1st, not 2nd). `me` isn't counted.
 */
export function placeBeating(players: BoardPlayer[], score: number, me = ''): number {
  return players.filter((p) => p.name !== me && p.best.score > score).length + 1
}

/* ---------- words ---------- */

/** What each game counts, where it is not points. Time boards count seconds. */
const UNITS: Record<string, [string, string]> = {
  crosswalk: ['row', 'rows'],
  stacker: ['block', 'blocks'],
  simon: ['round', 'rounds'],
  fireflies: ['note', 'notes'],
  acechase: ['try', 'tries'],
}

function gameName(slug: string): string {
  return getGame(slug)?.name ?? slug
}

function count(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`
}

/** What a score counts, to set beside the figure: rows, blocks, points; nothing for a time, tries or a percent, which say it. */
export function scoreUnit(slug: string, score: number): string {
  if (isInvertedBoard(slug) || isPercentBoard(slug)) return ''
  const [one, many] = UNITS[slug] ?? ['point', 'points']
  return score === 1 ? one : many
}

/**
 * A gap between two scores in the game's own terms: 9 rows, 1 point, 0.4s, 0.4%. A percent's gap alone is
 * read the way a figure is shown, to the tenth (0.04% under one); gapBetween works it from both figures.
 */
export function gapText(slug: string, gap: number): string {
  if (isTimeBoard(slug)) return formatTimeGap(slug, gap)
  if (isPercentBoard(slug)) return formatPercentGap(gap, 0)
  const [one, many] = UNITS[slug] ?? ['point', 'points']
  return count(gap, one, many)
}

/** The gap between two scores in the game's own terms, a percent's from the tenths on show: 91.2% is 0.4% over 90.8%. */
export function gapBetween(slug: string, a: number, b: number): string {
  if (isPercentBoard(slug)) return formatPercentGap(a, b)
  return gapText(slug, Math.abs(a - b))
}

/** The gap between two scores as a bare figure, for beside words that say the rest: 9, 1,250, 2.4s, 0.4%. */
export function gapFigure(slug: string, a: number, b: number): string {
  if (isPercentBoard(slug)) return formatPercentGap(a, b)
  const gap = Math.abs(a - b)
  return isTimeBoard(slug) ? formatTimeGap(slug, gap) : gap.toLocaleString()
}

/** A score in the game's own terms, for a sentence: 49 rows, 1,000 points, 9.9s, 3 tries, 91.2%. */
export function scoreText(slug: string, score: number): string {
  if (isInvertedBoard(slug) || isPercentBoard(slug)) return formatLeaderboardScore(slug, score)
  return gapText(slug, score)
}

/** The unit a gap is counted in, for a label under the figure: rows, points; nothing for a time or a percent. */
function gapUnit(slug: string, gap: number): string {
  if (isTimeBoard(slug) || isPercentBoard(slug)) return ''
  const [one, many] = UNITS[slug] ?? ['point', 'points']
  return `${gap === 1 ? one : many} `
}

/** The headline, with the leader's name apart so it can wear the gold. */
export function boardHeadline(
  slug: string,
  copy: PeriodCopy,
  players: BoardPlayer[],
): { name: string; rest: string } {
  const game = gameName(slug)
  const [first, second] = players
  if (first && second) {
    const gap = first.best.score - second.best.score
    if (gap > 0) return { name: first.name, rest: ` leads ${game} by ${gapBetween(slug, first.best.score, second.best.score)}.` }
    return { name: '', rest: `${first.name} and ${second.name} are tied at the top of ${game}.` }
  }
  if (first) return { name: first.name, rest: `’s alone on ${game}${copy.noun ? ` ${copy.phrase}` : ''}.` }
  return { name: '', rest: `Nobody’s played ${game} ${copy.noun ? copy.phrase : 'yet'}.` }
}

/** The line under the headline: how busy the board is. */
export function boardLede(slug: string, copy: PeriodCopy, players: BoardPlayer[], runs: number): string {
  if (players.length >= 2) {
    const when = copy.noun ? ` ${copy.phrase}` : ', all time'
    return `${count(players.length, 'player')} and ${count(runs, 'run')}${when}.`
  }
  if (players.length === 1) {
    const only = players[0]
    const soFar = only.runs === 1 ? 'One run so far' : `${capital(numberWord(only.runs))} runs so far`
    // With several runs, "it" could be any of them: name the best.
    const beat = only.runs === 1 ? 'it' : formatLeaderboardScore(slug, only.best.score)
    return `${soFar}, ${scoreText(slug, only.best.score)}. Beat ${beat} to take first.`
  }
  return 'The first run takes first place.'
}

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/* ---------- you ---------- */

/** Where the viewer stands on this board, with the players either side and all their runs in it. */
export type BoardYou = {
  player: BoardPlayer
  field: number
  above: BoardPlayer | null
  below: BoardPlayer | null
  /** The place a run just better than the player above takes (placeBeating); for the player in first, 1. */
  nextPlace: number
  runs: LeaderboardEntry[]
}

export function youOnBoard(players: BoardPlayer[], runs: LeaderboardEntry[], me: string): BoardYou | null {
  if (!me) return null
  const index = players.findIndex((p) => p.name === me)
  if (index < 0) return null
  const above = players[index - 1] ?? null
  return {
    player: players[index],
    field: players.length,
    above,
    below: players[index + 1] ?? null,
    nextPlace: above ? placeBeating(players, above.best.score, me) : 1,
    runs: runs.filter((r) => normalizePlayerName(r.name ?? '') === me),
  }
}

/** How far to the player above and how far back the one below is, in the game's own terms. */
export function boardYouStats(slug: string, you: BoardYou): Stat[] {
  const stats: Stat[] = []
  const versus = (other: BoardPlayer, high: number, low: number, side: string): Stat =>
    high > low
      ? { value: gapFigure(slug, high, low), label: `${gapUnit(slug, high - low)}${side} ${other.name}` }
      : { value: 'Tied', label: `with ${other.name}` }
  if (you.above) stats.push(versus(you.above, you.above.best.score, you.player.best.score, 'behind'))
  if (you.below) stats.push(versus(you.below, you.player.best.score, you.below.best.score, 'ahead of'))
  return stats
}

/** The one thing to do next on this board: on one that takes a run a player (oneRunBoard), that yours is in. */
export function boardCallout(slug: string, you: BoardYou, period: LeaderboardPeriod): string {
  const { player, above, below, nextPlace } = you
  if (above) {
    if (oneRunBoard(slug, period)) return dayRunIn(slug)
    return `Beat ${formatLeaderboardScore(slug, above.best.score)} to take ${ordinal(nextPlace)}.`
  }
  if (below && below.best.score === player.best.score) return `You hold first, tied with ${below.name}: you got there first.`
  if (below) return `You hold first. ${below.name} is ${gapBetween(slug, player.best.score, below.best.score)} back.`
  return 'You hold first.'
}

/**
 * Dailies whose day's result is the day's first, so once it's in no later run moves it: Find the Bug's
 * first run and Half Full's first pour (the API's FIRST_RUN_DAILIES, firstRun.ts), and Ace Chase's first
 * bullseye (the API's dailyHole.ts keeps an account's first result a day, and holes.ts its first on a hole
 * after its day). Hot Lap's day is its best lap, so another lap can always move you.
 */
export const FIRST_RUN_DAILIES: ReadonlySet<string> = new Set(['findbug', 'acechase', 'halffull'])

/** What a daily calls one go at its day, where it isn't a run: Ace Chase's bullseye, Half Full's pour, Hot Lap's lap. */
const RUN_WORDS: Partial<Record<string, string>> = { acechase: 'bullseye', halffull: 'pour', hotlap: 'lap' }

/** What a daily calls its day's result: a run, a bullseye, a pour, a lap ("Your first lap goes here"). */
export function firstRunWord(slug: string): string {
  return RUN_WORDS[slug] ?? 'run'
}

/**
 * What gets a player onto a game's board: any run, but on a daily that counts the day's first result
 * only, that one (Find the Bug's first run, Ace Chase's first bullseye, Half Full's first pour).
 */
export function whatPutsYouOn(slug: string): string {
  if (FIRST_RUN_DAILIES.has(slug)) return `Your first ${firstRunWord(slug)} of the day puts you on the board`
  return 'Any run puts you on the board'
}

/**
 * Whether a board takes one run a player, so once theirs is on it no run moves them: today's, on a
 * first-run daily. Its week, month and all time are day points, which the next day's run adds to.
 */
export function oneRunBoard(slug: string, period: LeaderboardPeriod): boolean {
  return period === 'daily' && FIRST_RUN_DAILIES.has(slug)
}

/** What a player whose run is in on a one-run board is told, in place of a score to beat. */
export function dayRunIn(slug: string): string {
  return `That’s your ${firstRunWord(slug)} for today. A new board at midnight, New York time.`
}

/** What a first-result daily keeps of each player's day, said plainly: Ace Chase's first bullseye, the others' first result. */
export function firstResultWord(slug: string): string {
  return slug === 'acechase' ? 'bullseye' : 'result'
}

/** The note over a board's players: each one's best run, or on today's board of a first-result daily, their first result. */
export function playersNote(slug: string, period: LeaderboardPeriod): string {
  if (oneRunBoard(slug, period)) return `Each player’s first ${firstResultWord(slug)} today.`
  return 'Each player’s best run.'
}

/**
 * Said on a first-result daily's punch once today's is in: playing today's again changes nothing, as the
 * first result stands. Null for a daily whose best run counts (Hot Lap, Marble Run), where it still can.
 */
export function replayIsPractice(slug: string): string | null {
  if (!FIRST_RUN_DAILIES.has(slug)) return null
  return `Playing it again is practice: your first ${firstResultWord(slug)} stands.`
}

/**
 * Where a run of `best` would land on this board if played now: behind everyone at or above it, as a tie
 * goes to whoever got there first and a new run is the latest. (placeBeating is a run just better than it.)
 */
export function wouldPlace(players: BoardPlayer[], best: number): { place: number } {
  return { place: players.filter((p) => p.best.score >= best).length + 1 }
}

/** For a player not on this board yet: what their best elsewhere would do here, or how to get on. */
export function offBoardLines(
  slug: string,
  copy: PeriodCopy,
  players: BoardPlayer[],
  allTimeBest: number | null,
): { line: string; callout: string } {
  const game = gameName(slug)
  const when = copy.noun ? ` ${copy.phrase}` : ''
  const field = players.length
  const halfway = field >= 6 ? players[Math.ceil(field / 2) - 1] : null
  const callout = halfway
    ? `Beat ${formatLeaderboardScore(slug, halfway.best.score)} to be halfway up the board.`
    : field
      ? `${whatPutsYouOn(slug)}.`
      : 'Any run takes first.'
  let line: string
  if (allTimeBest != null && allTimeBest > 0) {
    const { place } = wouldPlace(players, allTimeBest)
    line = `Your best, ${formatLeaderboardScore(slug, allTimeBest)}, would put you ${ordinal(place)}${when}.`
  } else {
    // How to get on, unless the callout under it already says so.
    const on = halfway || !field ? ` ${whatPutsYouOn(slug)}.` : ''
    line = `You haven’t played ${game}${copy.noun ? when : ' yet'}.${on}`
  }
  return { line, callout }
}

/* ---------- scores to beat ---------- */

export type PriceRow = { beat: string; what: string }

/**
 * The scores that take each step up the board, best first: first, the
 * podium, the top ten and halfway up (on a small board halfway comes before
 * the top ten), then any run at all. Ties can make two steps one score (three
 * tied on top: beating them is first and the podium both), so only the
 * bigger step is kept.
 */
export function priceList(slug: string, players: BoardPlayer[]): PriceRow[] {
  const field = players.length
  const steps: { place: number; what: string }[] = [{ place: 1, what: '1st' }]
  if (field >= 3) steps.push({ place: 3, what: 'Podium' })
  if (field >= 10) steps.push({ place: 10, what: 'Top ten' })
  if (field >= 6) steps.push({ place: Math.ceil(field / 2), what: 'Halfway up' })
  const rows: PriceRow[] = []
  let last: number | null = null
  for (const { place, what } of steps.sort((a, b) => a.place - b.place)) {
    const at = players[place - 1]
    if (!at || at.best.score === last) continue
    last = at.best.score
    rows.push({ beat: `Beat ${formatLeaderboardScore(slug, at.best.score)}`, what })
  }
  rows.push({ beat: 'Any run', what: field ? 'On the board' : 'Takes first' })
  return rows
}

/* ---------- your runs, charted ---------- */

/** Most runs a chart shows: the latest ones, oldest first. */
const CHART_RUNS = 12

/**
 * Your runs in the period, oldest first, against the score that takes the
 * next place (and first, when it is in reach). Time boards count down to a
 * floor under the slowest run, so their differences show; points count up
 * from nothing.
 */
export function runsChart(slug: string, you: BoardYou, players: BoardPlayer[]) {
  const runs = [...you.runs].sort((a, b) => a.at - b.at).slice(-CHART_RUNS)
  const lines: { label: string; score: number }[] = []
  if (you.above) lines.push({ label: `${ordinal(you.nextPlace)} · ${formatLeaderboardScore(slug, you.above.best.score)}`, score: you.above.best.score })
  // First as well, when it is in reach and the next place isn't it already.
  const lead = players[0]
  const inReach = (score: number) => isInvertedBoard(slug) || score <= you.player.best.score * 1.6
  if (lead && you.nextPlace > 1 && inReach(lead.best.score)) {
    lines.push({ label: `1st · ${formatLeaderboardScore(slug, lead.best.score)}`, score: lead.best.score })
  }
  const values = [...runs.map((r) => r.score), ...lines.map((l) => l.score)]
  const max = Math.max(...values)
  const min = Math.min(...values)
  // A clock or a count of tries counts down to a floor under the worst run: a second, or a try, below it.
  const floor = isInvertedBoard(slug) ? Math.max(0, min - (max - min) * 0.6 - (isTimeBoard(slug) ? 1000 : 1)) : 0
  const top = max + (max - floor) * 0.12
  const pct = (score: number) => ((score - floor) / (top - floor || 1)) * 100
  return {
    bars: runs.map((r) => ({
      id: r.id,
      score: formatLeaderboardScore(slug, r.score),
      height: Math.max(3, pct(r.score)),
      best: r.id === you.player.best.id,
      at: r.at,
    })),
    lines: lines.map((l) => ({ label: l.label, bottom: pct(l.score) })),
    count: you.runs.length,
  }
}
