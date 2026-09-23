import type { CSSProperties } from 'react'
import { rankHref, tournamentHref } from '../hooks/useHashRoute'
import { inkOn } from '../lib/color'
import {
  bestScore,
  fieldByGame,
  gameBests,
  gameList,
  gameName,
  ordinal,
  scoringSteps,
  type SkipLesson,
  type TableRow,
} from '../lib/eventPages'
import { normalizePlayerName } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { resolveGameAccent } from '../lib/theme'
import { eventKind, formatEventCountdown, type TournamentDetail, type TournamentSummary } from '../lib/tournaments'
import { getGame } from '../data/games'
import { eventAccent } from './EventCard'
import { EventScreen } from './EventScreen'
import { ClockIcon, EventArtBox, TrophyIcon } from './EventsHome'
import { GameThumbArt } from './GameThumbArt'
import { PlayerAvatar } from './PlayerAvatar'

/* One event's page, below its banner: the games to play, the standings, and what the event says about itself. */

function gameAccent(slug: string): string {
  return resolveGameAccent(slug, getGame(slug)?.accent ?? '#2eb8a0')
}

export type GameCardState = { slug: string; href: string | null; status: string }

/** Each game with its screen, what is left to do on it, and Play. */
export function EventGames({ games }: { games: GameCardState[] }) {
  return (
    <ul className={`evp-games evp-games--${Math.min(games.length, 3)}`} aria-label="The games">
      {games.map(({ slug, href, status }) => {
        const accent = gameAccent(slug)
        return (
          <li key={slug} className="evp-card evp-game" style={{ '--e': accent, '--e-ink': inkOn(accent) } as CSSProperties}>
            <EventScreen slug={slug} href={href} />
            <div className="evp-game__foot">
              <span className="evp-game__text">
                <span className="evp-game__name">{gameName(slug)}</span>
                <span className="evp-game__status">{status}</span>
              </span>
              {href ? (
                <a className="evp-btn evp-btn--small" href={href}>
                  Play
                </a>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function Cell({ slug, place, points, score, usePoints }: { slug: string; place: number | null; points: number; score: number | null; usePoints: boolean }) {
  if (place == null) {
    return (
      <span className="evp-cell evp-cell--skipped">
        —<small>skipped</small>
      </span>
    )
  }
  return (
    <span className={`evp-cell${place === 1 ? ' evp-cell--won' : ''}`}>
      <b>{usePoints ? points : formatLeaderboardScore(slug, score ?? 0)}</b>
      <small>{ordinal(place)}</small>
    </span>
  )
}

function StandingsRow({ row, usePoints, cols, gap = false }: { row: TableRow; usePoints: boolean; cols: CSSProperties; gap?: boolean }) {
  const cls = [
    'evp-table__row',
    row.you ? 'evp-table__row--you' : '',
    row.place <= 3 ? `evp-table__row--p${row.place}` : '',
    gap ? 'evp-table__row--gap' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <li className={cls} style={cols}>
      <span className="evp-table__place">{row.place}</span>
      <a className="evp-table__who" href={rankHref(row.name)}>
        <PlayerAvatar name={row.name} avatarId={row.avatarId} size="md" />
        <span className="evp-table__name">{row.name}</span>
        {row.you ? <span className="evp-you">You</span> : null}
      </a>
      {row.cells.map((cell) => (
        <span key={cell.slug} className="evp-table__cell" title={`${gameName(cell.slug)}: ${cell.place == null ? 'skipped' : ordinal(cell.place)}`}>
          <span className="evp-table__cell-game" aria-hidden="true">
            <GameThumbArt slug={cell.slug} accent={gameAccent(cell.slug)} />
          </span>
          <Cell {...cell} usePoints={usePoints} />
        </span>
      ))}
      <span className="evp-table__total">
        {usePoints ? row.total : row.total.toLocaleString()}
        {usePoints ? <small> pts</small> : null}
      </span>
    </li>
  )
}

/**
 * The standings, a row a player and a column a game: what each game paid and
 * where they placed on it, and the total. A game a player skipped shows as
 * skipped, which is most of the story of who won.
 */
export function StandingsTable({
  detail,
  rows,
  limit,
}: {
  detail: TournamentDetail
  rows: TableRow[]
  limit?: number
}) {
  const usePoints = detail.format === 'place-points'
  const ended = detail.status === 'ended'
  const shown = limit ? rows.slice(0, limit) : rows
  const mine = rows.find((r) => r.you)
  const extra = mine && !shown.includes(mine) ? mine : null
  const cols = { '--games': detail.games.length } as CSSProperties
  return (
    <section className="evp-card evp-table" aria-labelledby="evp-table-title">
      <div className="evp-card__head">
        <h2 id="evp-table-title" className="evp-card__title">
          {ended ? 'Final standings' : 'Standings'}
          <span className="evp-card__count">
            {rows.length} {rows.length === 1 ? 'player' : 'players'}
          </span>
        </h2>
      </div>
      <div className="evp-table__row evp-table__row--head" style={cols} aria-hidden="true">
        <span />
        <span className="evp-cap">Player</span>
        {detail.games.map((slug) => (
          <span key={slug} className="evp-cap evp-table__game">
            {gameName(slug)}
          </span>
        ))}
        <span className="evp-cap evp-table__total">Total</span>
      </div>
      <ol className="evp-table__rows">
        {shown.map((row) => (
          <StandingsRow key={row.name} row={row} usePoints={usePoints} cols={cols} />
        ))}
        {extra ? <StandingsRow row={extra} usePoints={usePoints} cols={cols} gap /> : null}
      </ol>
      {limit && rows.length > shown.length ? (
        <details className="evp-table__all">
          <summary>All {rows.length} players</summary>
          <ol className="evp-table__rows">
            {rows.slice(shown.length).map((row) => (
              <StandingsRow key={row.name} row={row} usePoints={usePoints} cols={cols} />
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  )
}

/** Nobody in yet: the empty table says what the first run does. */
export function StandingsEmpty({ detail }: { detail: TournamentDetail }) {
  const multi = detail.games.length > 1
  const top = detail.placePoints?.top ?? 10
  return (
    <section className="evp-card evp-table" aria-labelledby="evp-table-title">
      <div className="evp-card__head">
        <h2 id="evp-table-title" className="evp-card__title">
          Standings
          <span className="evp-card__count">no players yet</span>
        </h2>
      </div>
      <div className="evp-empty">
        <span className="evp-empty__mark" aria-hidden="true">
          <TrophyIcon />
        </span>
        <p className="evp-empty__title">{detail.status === 'upcoming' ? 'Not started yet' : 'Nobody’s in yet'}</p>
        <p className="evp-empty__copy">
          {detail.status === 'upcoming'
            ? 'Join now and you’re on the board the moment it starts.'
            : multi && detail.format === 'place-points'
              ? `A run on any of the ${detail.games.length} puts you 1st on it, and ${top} points up. The first player in leads.`
              : 'The first run posted leads, whatever it scores.'}
        </p>
      </div>
    </section>
  )
}

/** The top three on their steps, with where each placed on every game. */
export function EventPodium({ rows, detail }: { rows: TableRow[]; detail: TournamentDetail }) {
  const top = rows.filter((r) => r.place <= 3).slice(0, 3)
  if (top.length === 0) return null
  const order = [top[1], top[0], top[2]].filter(Boolean) as TableRow[]
  const usePoints = detail.format === 'place-points'
  const level = top[1] && top[1].total === top[0].total ? top[1] : null
  return (
    <section className="evp-card evp-podium-card" aria-label="Podium">
      <ol className="evp-podium">
        {order.map((row) => (
          <li key={row.name} className={`evp-podium__step evp-podium__step--${row.place}`}>
            <a className="evp-podium__who" href={rankHref(row.name)}>
              <PlayerAvatar name={row.name} avatarId={row.avatarId} size={row.place === 1 ? 'lg' : 'md'} />
              <span className="evp-podium__name">{row.name}</span>
              <span className="evp-podium__pts">
                {usePoints ? `${row.total} pts` : row.total.toLocaleString()}
              </span>
            </a>
            <span className="evp-podium__block">{ordinal(row.place)}</span>
            {detail.games.length > 1 ? (
              <span className="evp-podium__games">
                {row.cells
                  .filter((c) => c.place != null)
                  .map((c) => `${gameName(c.slug)} ${ordinal(c.place!)}`)
                  .join(' · ')}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      {level ? (
        <p className="evp-podium__tie">
          {top[0].name} and {level.name} both finished on {usePoints ? `${level.total} points` : level.total.toLocaleString()}.
          A tie goes to the higher best score.
        </p>
      ) : null}
    </section>
  )
}

/** How the event scores, in steps; and, for a weekly, what last week showed. */
export function HowItScores({
  detail,
  lesson,
  me,
}: {
  detail: TournamentDetail
  lesson: { lesson: SkipLesson; all: number; field: number } | null
  me: string
}) {
  const you = normalizePlayerName(me)
  const who = (name: string) => (you && normalizePlayerName(name) === you ? 'You' : name)
  return (
    <section className="evp-card evp-scores" id="evp-how" aria-labelledby="evp-scores-title">
      <h2 id="evp-scores-title" className="evp-card__title">
        {eventKind(detail) === 'bracket' ? 'How it works' : 'How it scores'}
      </h2>
      <ol className="evp-steps">
        {scoringSteps(detail).map((step, i) => (
          <li key={i}>
            <span className="evp-steps__n" aria-hidden="true">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {lesson ? (
        <p className="evp-lesson">
          <b>{detail.status === 'ended' ? 'The lesson:' : 'Last time:'}</b> {who(lesson.lesson.name)} won{' '}
          {lesson.lesson.won.length === 1 ? gameName(lesson.lesson.won[0]) : gameList(lesson.lesson.won)} but never played{' '}
          {gameList(lesson.lesson.skipped)}, and finished {ordinal(lesson.lesson.place)}. {who(lesson.lesson.winner)} placed
          on all of them and won with {lesson.lesson.winnerTotal} points. {lesson.all} of {lesson.field} played every game.
        </p>
      ) : null}
    </section>
  )
}

/** "QUINN · 27", or "QUINN and MANTIS, tied on 27". */
function bestLine(names: string[], score: string | null): string {
  if (names.length === 1) return score ? `${names[0]} · ${score}` : names[0]
  const who = `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return score ? `${who}, tied on ${score}` : `${who}, tied`
}

/** Who topped each game. Winning a game is not winning the event, which is the point. */
export function GameBests({ detail }: { detail: TournamentDetail }) {
  const bests = gameBests(detail)
  const fields = fieldByGame(detail)
  return (
    <section className="evp-card evp-bests" aria-labelledby="evp-bests-title">
      <h2 id="evp-bests-title" className="evp-card__title">
        Each game’s best
      </h2>
      <ul className="evp-bests__list">
        {bests.map((b) => (
          <li key={b.slug}>
            <span className="evp-bests__art" aria-hidden="true">
              <GameThumbArt slug={b.slug} accent={gameAccent(b.slug)} />
            </span>
            <span className="evp-bests__text">
              <b>{gameName(b.slug)}</b>
              <span>
                {b.names.length ? bestLine(b.names, bestScore(b.slug, b.score)) : 'Nobody played it'}
                {fields[b.slug] ? ` · ${fields[b.slug]} played` : ''}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {detail.games.length > 1 && detail.format === 'place-points' ? (
        <p className="evp-card__copy">Winning a game isn’t winning the event: placing on all of them is.</p>
      ) : null}
    </section>
  )
}

/** The one running now of the same kind, for a page about one that has finished. */
export function NextEventCard({ t }: { t: TournamentSummary }) {
  const accent = eventAccent(t.games)
  return (
    <a className="evp-card evp-next evp-wash" href={tournamentHref(t.id)} style={{ '--e': accent, '--e-ink': inkOn(accent) } as CSSProperties}>
      <p className="evp-kick evp-kick--live">
        <span className="evp-dot" aria-hidden="true" />
        {t.cadence === 'weekly' ? 'This week’s Triple is on' : t.cadence === 'daily' ? 'Today’s daily is on' : 'On now'}
      </p>
      <span className="evp-next__row">
        <EventArtBox games={t.games} size="2.6rem" />
        <span className="evp-next__title">{t.cadence === 'weekly' ? gameList(t.games) : t.title}</span>
      </span>
      <span className="evp-next__foot">
        <span className="evp-meta">
          <ClockIcon />
          {formatEventCountdown(t.endsAt)}
        </span>
        <span className="evp-more">Join</span>
      </span>
    </a>
  )
}

/** The winner, in the banner of a finished event. */
export function WinnerCard({ winner, avatarId, total, usePoints, mine, runnersUp }: { winner: string; avatarId?: string; total: number | null; usePoints: boolean; mine: boolean; runnersUp: string | null }) {
  const amount = total == null ? '' : usePoints ? `, with ${total} ${total === 1 ? 'point' : 'points'}` : `, with ${total.toLocaleString()}`
  return (
    <div className="evp-winner">
      <span className="evp-winner__mark">
        <PlayerAvatar name={winner} avatarId={avatarId} size="lg" />
        <span className="evp-winner__cup" aria-hidden="true">
          <TrophyIcon />
        </span>
      </span>
      <span className="evp-winner__text">
        <b>{mine ? `You won${amount}` : `${winner} won${amount}`}</b>
        {mine ? (
          <a className="evp-more" href={rankHref()}>
            The trophy is on your player card
          </a>
        ) : runnersUp ? (
          <span>{runnersUp}</span>
        ) : null}
      </span>
    </div>
  )
}

