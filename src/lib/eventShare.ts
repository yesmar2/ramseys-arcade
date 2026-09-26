import { getGame } from '../data/games'
import { APP_NAME } from './brand'
import { scoreText } from './gameBoard'
import { normalizePlayerName } from './leaderboard'
import { ordinal } from './scoreboard'
import type { TournamentDetail } from './tournaments'

/*
 * Sharing where you stand in an event: /e/<event>/<tag>. The link carries
 * only the event and the tag. What unfurls it gets the words and a card
 * (api/event-page.js, api/event-card.js) read from the standings as it's
 * opened, so it says where you stand now; a friend who opens it is taken to
 * the event itself, to play the same one.
 */

export function eventShareUrl(id: string, name: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  return `${origin}/e/${encodeURIComponent(id)}/${encodeURIComponent(normalizePlayerName(name))}`
}

/** The card the link unfurls into, drawn for this player on this event. */
export function eventShareCard(id: string, name: string): string {
  return `/api/event-card?id=${encodeURIComponent(id)}&name=${encodeURIComponent(normalizePlayerName(name))}`
}

/** Whether a result on this event can be shared: a public event of scores. A bracket's match, or a private event's standings, isn't for passing round. */
export function canShareEvent(detail: Pick<TournamentDetail, 'private' | 'kind'>): boolean {
  return !detail.private && detail.kind !== 'bracket'
}

/**
 * The words that go out with the link: what you got, where it puts you, and
 * the dare. Null when the standings don't have you on them yet.
 */
export function eventShareMessage(detail: TournamentDetail, gameSlug: string, name: string): string | null {
  const you = normalizePlayerName(name)
  const row = detail.standings.find((s) => normalizePlayerName(s.name) === you)
  if (!row) return null
  const single = detail.games.length === 1
  const cell = row.byGame[gameSlug]
  const place = single ? cell?.place : row.place
  const field = (single ? detail.fieldByGame?.[gameSlug] : undefined) ?? detail.standingsTotal ?? detail.standings.length
  const where = place ? `, ${ordinal(place)} of ${field}` : ''
  if (!single) {
    const pts = `${row.totalPoints.toLocaleString()} point${row.totalPoints === 1 ? '' : 's'}`
    return `${detail.title} on ${APP_NAME}: ${pts}${where} so far. Can you beat it?`
  }
  if (cell?.score == null) return null
  const what = `${scoreText(gameSlug, cell.score)} on ${getGame(gameSlug)?.name ?? gameSlug}`
  if (detail.official && detail.cadence === 'oneshot') return `${APP_NAME} One Shot, one try: ${what}${where}. Your turn.`
  if (detail.official && detail.cadence === 'daily') return `Today’s ${APP_NAME} Daily: ${what}${where} so far. Can you beat it?`
  return `${detail.title} on ${APP_NAME}: ${what}${where} so far. Can you beat it?`
}
