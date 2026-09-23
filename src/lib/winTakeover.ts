import { getGame } from '../data/games'
import { rankHref } from '../hooks/useHashRoute'
import { eventSpan, gameList, ordinal, standingsTable } from './eventPages'
import { gapText } from './gameBoard'
import { normalizePlayerName, type GlobalRankResult, type LeaderboardPeriod } from './leaderboard'
import { formatLeaderboardScore } from './leaderboardFormat'
import { periodCopy } from './scoreboard'
import { resolveGameAccent } from './theme'
import { eventKind, finalBracketMatch, type PublicBracketMatch, type TournamentDetail } from './tournaments'

/*
 * The whole-screen moment: an event won, or first place in the standings.
 * This works out what it says (the prize, how it was won, the games that won
 * it, the podium) from an event's final standings or the standings' top; the
 * takeover in WinTakeover.tsx only lays it out.
 */

export type WinRow = {
  key: string
  color: string
  name: string
  place: string
  placeTone: 'gold' | 'silver' | 'bronze' | 'plain'
  value: string
}

export type WinPodium = {
  place: 1 | 2 | 3
  name: string
  value: string
  avatarId?: string
  mine: boolean
}

export type WinTakeoverData = {
  kicker: string
  /** "You won the", then the prize in gold. */
  lead: string
  prize: string
  lede: string
  rows: WinRow[]
  podium: WinPodium[]
  /** Engraved on the trophy's base, when it fits. */
  plate: string | null
  note: { text: string; href?: string } | null
}

const PLATE_MAX = 16

function placeTone(place: number | null): WinRow['placeTone'] {
  return place === 1 ? 'gold' : place === 2 ? 'silver' : place === 3 ? 'bronze' : 'plain'
}

function gameColor(slug: string): string {
  return resolveGameAccent(slug, getGame(slug)?.accent ?? '#2eb8a0')
}

function gameName(slug: string): string {
  return getGame(slug)?.name ?? slug
}

function players(n: number): string {
  return `${n.toLocaleString()} ${n === 1 ? 'player' : 'players'}`
}

function wonBy(match: PublicBracketMatch, you: string) {
  return match.players.some((p) => p && normalizePlayerName(p.name) === you && p.id === match.winnerId)
}

/** The prize line and the trophy's plate, from the event's name. */
function prizeWords(detail: TournamentDetail) {
  const title = detail.title.trim()
  return {
    // The arcade's own events read as a title ("the Weekly Triple"); a hosted one is its own name.
    lead: detail.official ? 'You won the' : 'You won',
    prize: `${title}.`,
    plate: title.length <= PLATE_MAX ? title.toUpperCase() : null,
    kicker: `${title} · ${eventSpan(detail)}`,
  }
}

/**
 * An event this player won: a bracket's final, or first in a finished event's
 * standings. Null when they didn't win it.
 */
export function eventWinTakeover(detail: TournamentDetail, me: string): WinTakeoverData | null {
  const you = normalizePlayerName(me)
  if (!you) return null
  const words = prizeWords(detail)
  const note = { text: 'The trophy is on your shelf, on your player card.', href: rankHref() }

  if (eventKind(detail) === 'bracket') {
    const final = finalBracketMatch(detail.bracket?.matches ?? [])
    if (!final?.winnerId || !wonBy(final, you)) return null
    const opponent = final.players.find((p) => p && normalizePlayerName(p.name) !== you)?.name ?? null
    const count = detail.players.length || detail.playerCount
    return {
      kicker: words.kicker,
      lead: words.lead,
      prize: words.prize,
      plate: words.plate,
      lede: `${opponent ? `You beat ${normalizePlayerName(opponent)} in the final. ` : ''}${players(count)} in the draw.`,
      rows: [],
      podium: [
        { place: 1, name: you, value: 'Champion', mine: true },
        ...(opponent ? [{ place: 2 as const, name: normalizePlayerName(opponent), value: 'Final', mine: false }] : []),
      ],
      note,
    }
  }

  if (detail.status !== 'ended') return null
  const table = standingsTable(detail, you)
  const mine = table[0]
  if (!mine?.you) return null
  const second = table[1] ?? null
  const points = detail.format === 'place-points'
  const single = detail.games.length === 1 ? detail.games[0]! : null
  const total = (value: number) =>
    points ? `${value.toLocaleString()} ${value === 1 ? 'point' : 'points'}` : single ? formatLeaderboardScore(single, value) : value.toLocaleString()
  const count = detail.playerCount || table.length

  let how: string
  if (points) how = `${total(mine.total)} from ${gameList(detail.games)}`
  else if (single) how = `${total(mine.total)} on ${gameName(single)}`
  else how = `${total(mine.total)} across ${gameList(detail.games)}`
  let margin = ''
  if (second) {
    const gap = mine.total - second.total
    margin =
      gap > 0
        ? `, ${points ? gap.toLocaleString() : single ? gapText(single, gap) : gap.toLocaleString()} ahead of ${second.name}`
        : `, level with ${second.name} and ahead on the tie-break`
  }

  const rows: WinRow[] =
    detail.games.length > 1
      ? mine.cells.map((cell) => ({
          key: cell.slug,
          color: gameColor(cell.slug),
          name: gameName(cell.slug),
          place: cell.place != null ? ordinal(cell.place) : 'Skipped',
          placeTone: placeTone(cell.place),
          value: points
            ? `+${cell.points}`
            : cell.score != null
              ? formatLeaderboardScore(cell.slug, cell.score)
              : '—',
        }))
      : []

  return {
    kicker: words.kicker,
    lead: words.lead,
    prize: words.prize,
    plate: words.plate,
    lede: `${how}${margin}. ${players(count)} went for it.`,
    rows,
    podium: table.slice(0, 3).map((row, i) => ({
      place: (i + 1) as 1 | 2 | 3,
      name: row.name,
      value: points ? `${row.total} pts` : total(row.total),
      avatarId: row.avatarId,
      mine: row.you,
    })),
    note,
  }
}

/** First place in the period's standings, taken from somebody on this run. */
export function standingsTakeover(after: GlobalRankResult, name: string, period: LeaderboardPeriod): WinTakeoverData | null {
  const you = normalizePlayerName(name)
  if (after.rank !== 1 || !you) return null
  const copy = periodCopy(period)
  const near = (after.nearby ?? []).filter((n) => n.rank <= 3).sort((a, b) => a.rank - b.rank)
  const second = near.find((n) => n.rank === 2) ?? null
  const games = Object.entries(after.byGame)
    .filter((entry): entry is [string, NonNullable<(typeof entry)[1]>] => Boolean(entry[1]))
    .sort((a, b) => b[1].points - a[1].points)
  const points = `${after.score.toLocaleString()} ${after.score === 1 ? 'point' : 'points'}`
  const from = games.length ? ` from ${gameList(games.map(([slug]) => slug))}` : ''
  const margin = second ? `, ${(after.score - second.score).toLocaleString()} ahead of ${second.name}` : ''
  return {
    kicker: copy.noun ? `The standings · this ${copy.noun}` : 'The standings · all time',
    lead: 'You’re',
    prize: copy.noun ? `first this ${copy.noun}.` : 'first of all time.',
    lede: `${points}${from}${margin}. ${players(after.totalPlayers)} on the standings.`,
    rows: games.slice(0, 5).map(([slug, place]) => ({
      key: slug,
      color: gameColor(slug),
      name: gameName(slug),
      place: ordinal(place.place),
      placeTone: placeTone(place.place),
      value: `+${place.points}`,
    })),
    podium: near.map((n) => ({
      place: n.rank as 1 | 2 | 3,
      name: n.name,
      value: `${n.score.toLocaleString()} pts`,
      avatarId: n.avatarId,
      mine: normalizePlayerName(n.name) === you,
    })),
    plate: null,
    note: copy.noun ? { text: copy.closes } : null,
  }
}
