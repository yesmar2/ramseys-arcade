import { getGame } from '../data/games'
import { rankHowHref, rankHref } from '../hooks/useHashRoute'
import { eventSpan, gameList, ordinal, standingsTable } from './eventPages'
import { gapBetween } from './gameBoard'
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
  /** The game's score, or '' when the place says it all. */
  value: string
}

export type WinPodium = {
  place: 1 | 2 | 3
  name: string
  /** Under the place: a score, or '' for names and places only. */
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
  /** A quiet link under the note: the standings' workings. */
  more?: { text: string; href: string }
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
    // The arcade's own events read as a title ("the Weekly Triple"); a hosted one is its own name, and so is
    // the day's ("Today’s event · Pop", never "the Today’s event").
    lead: detail.official && detail.cadence !== 'daily' ? 'You won the' : 'You won',
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
    const count = detail.playerCount || detail.players.length
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
  // The server names the winner once it's over; without that, first place only
  // counts if they played. Everyone who joined an event nobody played sits at
  // nothing, in whatever order, and none of them won it.
  if (detail.winner && normalizePlayerName(detail.winner) !== you) return null
  const table = standingsTable(detail, you)
  const mine = table[0]
  if (!mine?.you || !mine.cells.some((cell) => cell.score != null)) return null
  const second = table[1] ?? null
  const single = detail.games.length === 1 ? detail.games[0]! : null
  // All-round: every game's place counts, and the screen says who won in words. What each place was
  // worth stays off it. One game, or scores added up, say the scores.
  const allRound = detail.format === 'place-points' && !single
  // One game is its score, whatever the event ranks it by.
  const scoreOf = (row: (typeof table)[number]) => (single ? (row.cells[0]?.score ?? 0) : row.total)
  const total = (value: number) => (single ? formatLeaderboardScore(single, value) : value.toLocaleString())
  const count = detail.playerCount || table.length

  let how: string
  if (allRound) how = `Best all-round across ${gameList(detail.games)}`
  else if (single) how = `${total(scoreOf(mine))} on ${gameName(single)}`
  else how = `${total(mine.total)} across ${gameList(detail.games)}`
  let margin = ''
  if (second) {
    const gap = scoreOf(mine) - scoreOf(second)
    if (allRound) margin = gap > 0 ? `, ahead of ${second.name}` : `, just edging out ${second.name}`
    else {
      margin =
        gap > 0
          ? `, ${single ? gapBetween(single, scoreOf(mine), scoreOf(second)) : gap.toLocaleString()} ahead of ${second.name}`
          : `, tied with ${second.name} and ahead on the tie-break`
    }
  }

  const rows: WinRow[] = single
    ? []
    : mine.cells.map((cell) => ({
        key: cell.slug,
        color: gameColor(cell.slug),
        name: gameName(cell.slug),
        place: cell.place != null ? ordinal(cell.place) : 'Skipped',
        placeTone: placeTone(cell.place),
        // The game's own score beside its place; a game skipped has just the word.
        value: cell.score != null ? formatLeaderboardScore(cell.slug, cell.score) : '',
      }))

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
      // All-round, names and places only; a score event keeps its scores.
      value: allRound ? '' : total(scoreOf(row)),
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
  // The games that won it, best place first. What each place was worth is for How your rank works.
  const games = Object.entries(after.byGame)
    .filter((entry): entry is [string, NonNullable<(typeof entry)[1]>] => Boolean(entry[1]))
    .sort((a, b) => a[1].place - b[1].place)
  // A long list of games reads as a count.
  const on = games.length > 3 ? ` on ${games.length} games` : games.length ? ` on ${gameList(games.map(([slug]) => slug))}` : ''
  const ahead = second ? `${second.name} and everyone else` : 'everyone else'
  return {
    kicker: `The standings · ${copy.phrase}`,
    lead: 'You’re',
    prize: copy.noun ? `first ${copy.phrase}.` : 'first of all time.',
    // All time has no period to name here: the title says it.
    lede: `Your runs${on} put you ahead of ${ahead}${copy.noun ? ` ${copy.phrase}` : ''}.`,
    rows: games.slice(0, 5).map(([slug, place]) => ({
      key: slug,
      color: gameColor(slug),
      name: gameName(slug),
      place: ordinal(place.place),
      placeTone: placeTone(place.place),
      value: '',
    })),
    podium: near.map((n) => ({
      place: n.rank as 1 | 2 | 3,
      name: n.name,
      value: '',
      avatarId: n.avatarId,
      mine: normalizePlayerName(n.name) === you,
    })),
    plate: null,
    note: copy.noun ? { text: copy.closes } : null,
    more: { text: 'How your rank works ›', href: rankHowHref(undefined, period) },
  }
}
