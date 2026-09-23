import { getGame } from '../data/games'
import { normalizePlayerName, type LeaderboardEntry } from './leaderboard'
import { formatLeaderboardScore, isTimeBoard } from './leaderboardFormat'
import { numberWord } from './numberWord'
import { ordinal, type PeriodCopy, type Stat } from './scoreboard'

/*
 * One game's board as players rather than runs. The API lists runs, best
 * first, so one player can hold several places in a row; a player's place is
 * their best run, and that place is what pays (placePoints in the API's store).
 * Everything the game board page says about places, gaps and what a score is
 * worth is worked out here from the runs.
 */

/** One player on a board: their best run, how many runs they have, and what their place pays. */
export type BoardPlayer = {
  place: number
  name: string
  best: LeaderboardEntry
  runs: number
  pays: number
}

/** What a place pays toward the period's standings: first 100, last a point or two. */
export function placePoints(place: number, field: number): number {
  if (place < 1 || field < 1 || place > field) return 0
  return Math.max(1, Math.round((100 * (field - place + 1)) / field))
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
    return { place: i + 1, name, best, runs: count, pays: placePoints(i + 1, order.length) }
  })
}

/* ---------- words ---------- */

/** What each game counts, where it is not points. Time boards count seconds. */
const UNITS: Record<string, [string, string]> = {
  crosswalk: ['row', 'rows'],
  stacker: ['block', 'blocks'],
  simon: ['round', 'rounds'],
  fireflies: ['note', 'notes'],
}

function gameName(slug: string): string {
  return getGame(slug)?.name ?? slug
}

function count(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`
}

/** What a score counts, to set beside the figure: rows, blocks, points; nothing for a time. */
export function scoreUnit(slug: string, score: number): string {
  if (isTimeBoard(slug)) return ''
  const [one, many] = UNITS[slug] ?? ['point', 'points']
  return score === 1 ? one : many
}

/** A gap between two scores in the game's own terms: 9 rows, 1 point, 0.4s. */
export function gapText(slug: string, gap: number): string {
  if (isTimeBoard(slug)) return `${(gap / 1000).toFixed(1)}s`
  const [one, many] = UNITS[slug] ?? ['point', 'points']
  return count(gap, one, many)
}

/** A score in the game's own terms, for a sentence: 49 rows, 1,000 points, 9.9s. */
export function scoreText(slug: string, score: number): string {
  if (isTimeBoard(slug)) return formatLeaderboardScore(slug, score)
  return gapText(slug, score)
}

/** The unit a gap is counted in, for a label under the figure: rows, points; nothing for time. */
function gapUnit(slug: string, gap: number): string {
  if (isTimeBoard(slug)) return ''
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
    if (gap > 0) return { name: first.name, rest: ` leads ${game} by ${gapText(slug, gap)}.` }
    return { name: '', rest: `${first.name} and ${second.name} are level at the top of ${game}.` }
  }
  if (first) return { name: first.name, rest: `’s alone on ${game}${copy.noun ? ` ${copy.phrase}` : ''}.` }
  return { name: '', rest: `Nobody’s played ${game} ${copy.noun ? copy.phrase : 'yet'}.` }
}

/** The line under the headline: how busy the board is, and what it pays. */
export function boardLede(slug: string, copy: PeriodCopy, players: BoardPlayer[], runs: number): string {
  const toward = copy.noun ? `the ${copy.noun}` : 'the all-time standings'
  if (players.length >= 2) {
    const when = copy.noun ? ` ${copy.phrase}` : ', all time'
    return `${count(players.length, 'player')} and ${count(runs, 'run')}${when}. A player’s best run is their place, and first pays 100 points toward ${toward}.`
  }
  if (players.length === 1) {
    const only = players[0]
    const soFar = only.runs === 1 ? 'One run so far' : `${capital(numberWord(only.runs))} runs so far`
    const score = formatLeaderboardScore(slug, only.best.score)
    return `${soFar}, ${scoreText(slug, only.best.score)}. Any run puts you on the board, and beating ${score} takes first and all 100 points.`
  }
  return `The first run takes first place, and all 100 points toward ${toward}.`
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
  runs: LeaderboardEntry[]
}

export function youOnBoard(players: BoardPlayer[], runs: LeaderboardEntry[], me: string): BoardYou | null {
  if (!me) return null
  const index = players.findIndex((p) => p.name === me)
  if (index < 0) return null
  return {
    player: players[index],
    field: players.length,
    above: players[index - 1] ?? null,
    below: players[index + 1] ?? null,
    runs: runs.filter((r) => normalizePlayerName(r.name ?? '') === me),
  }
}

/** How far to the player above and how far back the one below is, in the game's own terms. */
export function boardYouStats(slug: string, you: BoardYou): Stat[] {
  const stats: Stat[] = []
  const versus = (other: BoardPlayer, gap: number, side: string): Stat =>
    gap > 0
      ? { value: isTimeBoard(slug) ? gapText(slug, gap) : gap.toLocaleString(), label: `${gapUnit(slug, gap)}${side} ${other.name}` }
      : { value: 'Level', label: `with ${other.name}` }
  if (you.above) stats.push(versus(you.above, you.above.best.score - you.player.best.score, 'behind'))
  if (you.below) stats.push(versus(you.below, you.player.best.score - you.below.best.score, 'ahead of'))
  return stats
}

/** The one thing to do next on this board. */
export function boardCallout(slug: string, you: BoardYou): string {
  const { player, above, below, field } = you
  if (above) {
    return `Beat ${formatLeaderboardScore(slug, above.best.score)} for ${ordinal(player.place - 1)}, and it pays ${placePoints(player.place - 1, field)}.`
  }
  if (below) return `You hold first. ${below.name} is ${gapText(slug, player.best.score - below.best.score)} back.`
  return 'You hold first.'
}

/** Where a best from outside this period would land on it, and what that place would pay. */
export function wouldPlace(players: BoardPlayer[], best: number): { place: number; pays: number } {
  const place = players.filter((p) => p.best.score > best).length + 1
  return { place, pays: placePoints(place, players.length + 1) }
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
  let line: string
  if (allTimeBest != null && allTimeBest > 0) {
    const { place, pays } = wouldPlace(players, allTimeBest)
    line = `Your best, ${formatLeaderboardScore(slug, allTimeBest)}, would put you ${ordinal(place)}${when}, and pay ${pays} points.`
  } else {
    line = `You haven’t played ${game}${copy.noun ? when : ' yet'}. Any run puts you on the board.`
  }
  const field = players.length
  const halfway = field >= 6 ? players[Math.ceil(field / 2) - 1] : null
  const callout = halfway
    ? `Beat ${formatLeaderboardScore(slug, halfway.best.score)} to be halfway up, worth about 50 points.`
    : field
      ? `Any run pays at least ${placePoints(field + 1, field + 1)}.`
      : 'Any run takes first, and all 100 points.'
  return { line, callout }
}

/* ---------- what a run is worth ---------- */

export type PriceRow = { beat: string; what: string; pays: string }

/**
 * The scores that take each step up the board, and what the step pays: first,
 * the podium, the top ten, halfway up, and any run at all.
 */
export function priceList(slug: string, players: BoardPlayer[]): PriceRow[] {
  const field = players.length
  const rows: PriceRow[] = []
  const step = (place: number, what: string) => {
    const at = players[place - 1]
    if (at) rows.push({ beat: `Beat ${formatLeaderboardScore(slug, at.best.score)}`, what, pays: String(at.pays) })
  }
  step(1, '1st')
  if (field >= 3) step(3, 'Podium')
  if (field >= 10) step(10, 'Top ten')
  if (field >= 6) step(Math.ceil(field / 2), 'Halfway up')
  rows.push({
    beat: 'Any run',
    what: field ? 'On the board' : 'Takes first',
    pays: field ? `${placePoints(field + 1, field + 1)}+` : '100',
  })
  return rows
}

/* ---------- charts ---------- */

/** Everyone's best along one line, lowest to highest, with the top ten and halfway marked. */
export function fieldStrip(players: BoardPlayer[], me: string) {
  const scores = players.map((p) => p.best.score)
  const low = Math.min(...scores)
  const high = Math.max(...scores)
  const at = (score: number) => (high > low ? ((score - low) / (high - low)) * 100 : 50)
  const marks: { label: string; left: number }[] = []
  if (players.length >= 10) marks.push({ label: 'Top ten', left: at(players[9].best.score) })
  if (players.length >= 6) marks.push({ label: 'Halfway', left: at(players[Math.ceil(players.length / 2) - 1].best.score) })
  return {
    low: players[players.length - 1],
    high: players[0],
    dots: players.map((p, i) => ({ name: p.name, left: at(p.best.score), row: i % 4, mine: Boolean(me) && p.name === me })),
    marks,
  }
}

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
  if (you.above) lines.push({ label: `${ordinal(you.player.place - 1)} · ${formatLeaderboardScore(slug, you.above.best.score)}`, score: you.above.best.score })
  // First as well, when it is in reach and not the same score as the next place.
  const lead = players[0]
  const inReach = (score: number) => isTimeBoard(slug) || score <= you.player.best.score * 1.6
  if (lead && you.player.place > 2 && inReach(lead.best.score) && lead.best.score !== you.above?.best.score) {
    lines.push({ label: `1st · ${formatLeaderboardScore(slug, lead.best.score)}`, score: lead.best.score })
  }
  const values = [...runs.map((r) => r.score), ...lines.map((l) => l.score)]
  const max = Math.max(...values)
  const min = Math.min(...values)
  const floor = isTimeBoard(slug) ? Math.max(0, min - (max - min) * 0.6 - 1000) : 0
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
