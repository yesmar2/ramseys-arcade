import { getGame } from '../data/games'
import { normalizePlayerName } from './leaderboard'
import { formatLeaderboardScore } from './leaderboardFormat'
import {
  eventKind,
  isDoubleElim,
  type StandingRow,
  type TournamentDetail,
  type TournamentSummary,
} from './tournaments'

/*
 * The events pages, worked out: which events lead the list, how results
 * group, the standings as a table of games, each game's best, the lesson a
 * finished multi-game event teaches (winning a game is not winning the
 * event), and how an event scores, in words. The pages only fetch and lay out.
 */

export function gameName(slug: string): string {
  return getGame(slug)?.name ?? slug
}

/** "Snake, Crumbtrail and Bop". */
export function gameList(slugs: string[]): string {
  const names = slugs.map(gameName)
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  const unit = n % 10
  return `${n}${unit === 1 ? 'st' : unit === 2 ? 'nd' : unit === 3 ? 'rd' : 'th'}`
}

/* ---------- the list ---------- */

const running = (t: TournamentSummary) =>
  t.status === 'active' || (t.status === 'upcoming' && eventKind(t) === 'bracket')

export type EventsLineup = {
  /** The official weekly that is on now. */
  weekly: TournamentSummary | null
  /** The official daily that is on now. */
  daily: TournamentSummary | null
  /** The official weekly that finished last, when anyone played it. */
  lastWeekly: TournamentSummary | null
  /** Everything else still running: other official events, and open ones people made. */
  others: TournamentSummary[]
  /** Finished events, newest first. */
  ended: TournamentSummary[]
}

/** What leads the events page, and what follows. */
export function eventsLineup(list: TournamentSummary[]): EventsLineup {
  const live = list.filter(running)
  const weekly = live.find((t) => t.official && t.cadence === 'weekly') ?? null
  const daily = live.find((t) => t.official && t.cadence === 'daily') ?? null
  const ended = list.filter((t) => t.status === 'ended').sort((a, b) => b.endsAt - a.endsAt)
  const lastWeekly =
    ended.find((t) => t.official && t.cadence === 'weekly' && (t.podium?.length ?? 0) > 0) ?? null
  return {
    weekly,
    daily,
    lastWeekly,
    others: live.filter((t) => t !== weekly && t !== daily).sort((a, b) => a.endsAt - b.endsAt),
    ended,
  }
}

/** A finished event anybody played, or several in a row that nobody did. */
export type ResultLine = { kind: 'event'; t: TournamentSummary } | { kind: 'quiet'; events: TournamentSummary[] }

function nobodyPlayed(t: TournamentSummary): boolean {
  return !t.winner && (t.podium?.length ?? 0) === 0
}

/** Results, with the events nobody played gathered into one quiet line instead of a row each. */
export function resultLines(ended: TournamentSummary[]): ResultLine[] {
  const played = ended.filter((t) => !nobodyPlayed(t)).map((t): ResultLine => ({ kind: 'event', t }))
  const quiet = ended.filter(nobodyPlayed)
  return quiet.length ? [...played, { kind: 'quiet', events: quiet }] : played
}

/** The official events run on the arcade's days, midnight to midnight Eastern, wherever you are. */
const ARCADE_ZONE = 'America/New_York'

function arcadeDate(d: Date, opts: Intl.DateTimeFormatOptions): string {
  try {
    return d.toLocaleDateString('en-US', { timeZone: ARCADE_ZONE, ...opts })
  } catch {
    return d.toLocaleDateString('en-US', opts)
  }
}

/** "Sep 22", from when an event started (a daily ends on the next day's date). */
export function eventDay(t: Pick<TournamentSummary, 'startsAt'>): string {
  return arcadeDate(new Date(t.startsAt), { month: 'short', day: 'numeric' })
}

/** "Sep 21 to 27", "Sep 28 to Oct 4", or for a daily just "Sep 23": the days an event runs. */
export function eventSpan(t: Pick<TournamentSummary, 'startsAt' | 'endsAt'>): string {
  const start = new Date(t.startsAt)
  const end = new Date(t.endsAt - 60_000)
  const from = arcadeDate(start, { month: 'short', day: 'numeric' })
  if (arcadeDate(start, {}) === arcadeDate(end, {})) return from
  const sameMonth = arcadeDate(start, { month: 'short' }) === arcadeDate(end, { month: 'short' })
  return `${from} to ${arcadeDate(end, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}`
}

/** "Ends Sunday at 11:59 pm ET", or "Ends tonight at 11:59 pm ET": the last minute an event runs, in the arcade's own time. */
export function endsWords(endsAt: number): string {
  const last = new Date(endsAt - 60_000)
  const zone = ARCADE_ZONE
  try {
    const day = (d: Date) => d.toLocaleDateString('en-US', { timeZone: zone })
    const when = day(last) === day(new Date())
      ? 'tonight'
      : last.toLocaleDateString('en-US', { timeZone: zone, weekday: 'long' })
    const time = last
      .toLocaleTimeString('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit' })
      .toLowerCase()
    return `Ends ${when} at ${time} ET`
  } catch {
    return ''
  }
}

/* ---------- one event's standings ---------- */

export type StandingCell = {
  slug: string
  /** Null when they skipped the game. */
  place: number | null
  points: number
  score: number | null
}

export type TableRow = {
  place: number
  name: string
  avatarId?: string
  total: number
  cells: StandingCell[]
  you: boolean
}

/**
 * The standings as a table: a row a player, a column a game. Points events
 * total the points; the others total the scores. Places follow the server's
 * order, which settles a tie (the higher best score first), so the table
 * agrees with the podium and the trophy.
 */
export function standingsTable(detail: TournamentDetail, me: string): TableRow[] {
  const points = detail.format === 'place-points'
  const you = normalizePlayerName(me)
  const rows = detail.standings.map((row) => ({
    row,
    total: points
      ? row.totalPoints
      : detail.games.reduce((sum, g) => sum + (row.byGame[g]?.score ?? 0), 0),
  }))
  return rows.map(({ row, total }, i) => {
    return {
      place: i + 1,
      name: normalizePlayerName(row.name),
      avatarId: row.avatarId,
      total,
      you: Boolean(you) && normalizePlayerName(row.name) === you,
      cells: detail.games.map((slug) => {
        const cell = row.byGame[slug]
        const played = cell?.score != null
        return { slug, place: played ? (cell.place ?? null) : null, points: played ? cell.points : 0, score: played ? cell.score : null }
      }),
    }
  })
}

/** How many played each game, for "1st of 33". */
export function fieldByGame(detail: TournamentDetail): Record<string, number> {
  const out: Record<string, number> = {}
  for (const slug of detail.games) {
    out[slug] = detail.standings.filter((r) => r.byGame[slug]?.score != null).length
  }
  return out
}

export type GameBest = { slug: string; names: string[]; score: number | null; field: number }

/** Who topped each game, ties and all. */
export function gameBests(detail: TournamentDetail): GameBest[] {
  const fields = fieldByGame(detail)
  return detail.games.map((slug) => {
    const top = detail.standings.filter((r) => r.byGame[slug]?.score != null && r.byGame[slug]?.place === 1)
    return {
      slug,
      names: top.map((r) => normalizePlayerName(r.name)),
      score: top[0]?.byGame[slug]?.score ?? null,
      field: fields[slug] ?? 0,
    }
  })
}

/** A game's best, in its own terms: 20,550, or a clock for the time games. */
export function bestScore(slug: string, score: number | null): string | null {
  return score == null ? null : formatLeaderboardScore(slug, score)
}

export type SkipLesson = {
  name: string
  place: number
  won: string[]
  skipped: string[]
  winner: string
  winnerTotal: number
}

/**
 * The lesson a finished multi-game points event teaches, when it has one:
 * the best-placed player who won a game but skipped another, and finished
 * behind someone who placed on them all.
 */
export function skipLesson(detail: TournamentDetail): SkipLesson | null {
  if (detail.format !== 'place-points' || detail.games.length < 2 || detail.standings.length < 4) return null
  const table = standingsTable(detail, '')
  const winner = table[0]
  if (!winner || winner.cells.some((c) => c.place == null)) return null
  const lesson = table.find(
    (r) => r.place > 1 && r.cells.some((c) => c.place === 1) && r.cells.some((c) => c.place == null),
  )
  if (!lesson) return null
  return {
    name: lesson.name,
    place: lesson.place,
    won: lesson.cells.filter((c) => c.place === 1).map((c) => c.slug),
    skipped: lesson.cells.filter((c) => c.place == null).map((c) => c.slug),
    winner: winner.name,
    winnerTotal: winner.total,
  }
}

/** How many players placed on every game. */
export function playedAll(detail: TournamentDetail): number {
  return detail.standings.filter((r: StandingRow) => detail.games.every((g) => r.byGame[g]?.score != null)).length
}

/** How an event scores, as short steps. */
export function scoringSteps(detail: TournamentDetail): string[] {
  const top = detail.placePoints?.top ?? 10
  const last = detail.placePoints?.last ?? 1
  const tries = detail.rules.maxAttempts
  const triesLine =
    tries == null || tries === 0
      ? 'Play as often as you like; your best run is the one that counts.'
      : tries === 1
        ? 'You get one run on each game, so make it count.'
        : `You get ${tries} tries on each game, and the best one counts.`
  if (eventKind(detail) === 'bracket') {
    const hours = detail.rules.roundPlayHours
    const span = !hours
      ? null
      : hours % 24 === 0
        ? `${hours / 24} ${hours === 24 ? 'day' : 'days'}`
        : `${hours} ${hours === 1 ? 'hour' : 'hours'}`
    const each = !tries ? 'You each play as often as you like' : tries === 1 ? 'You each get one try' : `You each get ${tries} tries`
    return [
      'Everyone is drawn into head-to-head matches, a round at a time.',
      `${each}${span ? ` in the round’s ${span}` : ''}, and the higher best score goes through.`,
      isDoubleElim(detail)
        ? 'A first loss drops you to the losers bracket and a second puts you out. Win the grand final and the trophy is yours.'
        : 'Lose a match and you’re out. Win the final and the trophy is yours.',
    ]
  }
  if (detail.format === 'place-points' && detail.games.length > 1) {
    return [
      'Each game ranks everyone who played it, by their best run.',
      `1st on a game pays ${top} points and last pays ${last}. A game you skip pays nothing.`,
      detail.cadence === 'weekly'
        ? 'The highest total on Sunday night wins the week, and its trophy.'
        : 'The highest total when it ends wins, and takes the trophy.',
    ]
  }
  if (detail.format === 'place-points') {
    return [triesLine, `1st pays ${top} points and last pays ${last}.`, 'The most points when it ends wins.']
  }
  if (detail.format === 'cumulative' || detail.rules.scoring === 'sum') {
    return [triesLine, 'Every run adds to your total.', 'The biggest total when it ends wins.']
  }
  return [
    triesLine,
    detail.games.length > 1 ? 'Your scores on the games add up to your total.' : 'The best score when it ends wins.',
    detail.cadence === 'daily' ? 'It closes at midnight, and the winner takes the day’s trophy.' : 'The winner takes a trophy for their player card.',
  ]
}
