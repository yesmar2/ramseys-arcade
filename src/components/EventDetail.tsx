import type { CSSProperties } from 'react'
import { rankHref, tournamentCreateHref, tournamentHref } from '../hooks/useHashRoute'
import { inkOn, readableFill } from '../lib/color'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import {
  bestScore,
  fieldByGame,
  gameBests,
  gameList,
  gameName,
  ordinal,
  scoringSteps,
  standingsCount,
  type SkipLesson,
  type TableRow,
} from '../lib/eventPages'
import { normalizePlayerName } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { resolveGameAccent } from '../lib/theme'
import { eventScoreText, formatEventCountdown, type TournamentDetail, type TournamentSummary } from '../lib/tournaments'
import { getGame } from '../data/games'
import { eventAccent } from './EventCard'
import { EventScreen } from './EventScreen'
import { ClockIcon, EventArtBox, TrophyIcon } from './EventsHome'
import { GameThumbArt } from './GameThumbArt'
import { PlayerAvatar } from './PlayerAvatar'
import { PlayerName } from './PlayerName'

/* One event's page, below its banner: the games to play, the standings, and what the event says about itself. */

function gameAccent(slug: string): string {
  return resolveGameAccent(slug, getGame(slug)?.accent ?? '#2eb8a0')
}

/** A game on the event page; a racing daily's event names its course ("#12 Bramble Speedway"). */
export type GameCardState = { slug: string; href: string | null; status: string; course?: string }

/** Each game with its screen, what is left to do on it, and Play. */
export function EventGames({ games }: { games: GameCardState[] }) {
  return (
    <ul className={`evp-games evp-games--${Math.min(games.length, 3)}`} aria-label="The games">
      {games.map(({ slug, href, status, course }) => {
        const accent = gameAccent(slug)
        return (
          <li key={slug} className="evp-card evp-game" style={{ '--e': accent, '--e-ink': inkOn(accent), '--e-fill': readableFill(accent) } as CSSProperties}>
            <EventScreen slug={slug} href={href} />
            <div className="evp-game__foot">
              <span className="evp-game__text">
                <span className="evp-game__name">{course ? `${gameName(slug)} · ${course}` : gameName(slug)}</span>
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

/*
 * What a player scored on a game, and where it placed them. The place is
 * what counts in an all-round event, but the score is what they played for.
 * A game with no run is "not yet" while the event runs: only once it's over
 * was it skipped.
 */
function Cell({ slug, place, score, ended }: TableRow['cells'][number] & { ended: boolean }) {
  if (place == null) {
    return (
      <span className="evp-cell evp-cell--skipped">
        —<small>{ended ? 'skipped' : 'not yet'}</small>
      </span>
    )
  }
  return (
    <span className={`evp-cell${place === 1 ? ' evp-cell--won' : ''}`}>
      <b>{formatLeaderboardScore(slug, score ?? 0)}</b>
      <small>{ordinal(place)}</small>
    </span>
  )
}

function cellTitle(cell: TableRow['cells'][number], ended: boolean): string {
  if (cell.place == null) return `${gameName(cell.slug)}: ${ended ? 'skipped' : 'not played yet'}`
  return `${gameName(cell.slug)}: ${formatLeaderboardScore(cell.slug, cell.score ?? 0)}, ${ordinal(cell.place)}`
}

/*
 * An all-round event has no total column: its total is only the places added
 * up, and the order already says it. Scores that add up keep theirs.
 */
function StandingsRow({
  row,
  allRound,
  ended,
  cols,
  gap = false,
}: {
  row: TableRow
  allRound: boolean
  ended: boolean
  cols: CSSProperties
  gap?: boolean
}) {
  // A player's card opens at the period you picked.
  const period = useDefaultPeriod()
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
      <a className="evp-table__who" href={rankHref(row.name, period)}>
        <PlayerAvatar name={row.name} avatarId={row.avatarId} size="md" />
        <PlayerName className="evp-table__name" name={row.name} avatarId={row.avatarId} />
        {row.you ? <span className="evp-you">You</span> : null}
      </a>
      {row.cells.map((cell) => (
        <span key={cell.slug} className="evp-table__cell" title={cellTitle(cell, ended)}>
          <span className="evp-table__cell-game" aria-hidden="true">
            <GameThumbArt slug={cell.slug} accent={gameAccent(cell.slug)} />
          </span>
          <Cell {...cell} ended={ended} />
        </span>
      ))}
      {allRound ? null : <span className="evp-table__total">{eventScoreText(row.cells.map((c) => c.slug), row.total)}</span>}
    </li>
  )
}

/**
 * The standings, a row a player and a column a game: what each scored and
 * where they placed on it. A game a player skipped shows as skipped (as "not
 * yet" while the event runs), which is most of the story of who won.
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
  const allRound = detail.format === 'place-points'
  const ended = detail.status === 'ended'
  const total = standingsCount(detail)
  // The unbroken run from first place: everything on a small event's page, the top hundred on a big one's.
  const run = rows.findIndex((r, i) => i > 0 && r.gap)
  const top = run === -1 ? rows : rows.slice(0, run)
  const shown = limit ? top.slice(0, limit) : top
  const mine = rows.find((r) => r.you)
  const extra = mine && !shown.includes(mine) ? mine : null
  const below = total - top.length
  const cols = { '--games': detail.games.length } as CSSProperties
  return (
    <section className={`evp-card evp-table${allRound ? ' evp-table--all-round' : ''}`} aria-labelledby="evp-table-title">
      <div className="evp-card__head">
        <h2 id="evp-table-title" className="evp-card__title">
          {ended ? 'Final standings' : 'Standings'}
          <span className="evp-card__count">
            {total.toLocaleString()} {total === 1 ? 'player' : 'players'}
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
        {allRound ? null : <span className="evp-cap evp-table__total">Total</span>}
      </div>
      <ol className="evp-table__rows">
        {shown.map((row) => (
          <StandingsRow key={row.name} row={row} allRound={allRound} ended={ended} cols={cols} />
        ))}
        {extra ? <StandingsRow row={extra} allRound={allRound} ended={ended} cols={cols} gap /> : null}
      </ol>
      {limit && top.length > shown.length ? (
        <details className="evp-table__all">
          <summary>{below > 0 ? `The top ${top.length}` : `All ${total.toLocaleString()} players`}</summary>
          <ol className="evp-table__rows">
            {top.slice(shown.length).map((row) => (
              <StandingsRow key={row.name} row={row} allRound={allRound} ended={ended} cols={cols} />
            ))}
          </ol>
          {below > 0 ? (
            <p className="evp-card__copy">
              {below.toLocaleString()} more {below === 1 ? 'player' : 'players'} below them.
            </p>
          ) : null}
        </details>
      ) : below > 0 ? (
        <p className="evp-card__copy">
          {below.toLocaleString()} more {below === 1 ? 'player' : 'players'} below them.
        </p>
      ) : null}
    </section>
  )
}

/** Nobody in yet: the empty table says what the first run does. */
export function StandingsEmpty({ detail }: { detail: TournamentDetail }) {
  const multi = detail.games.length > 1
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
              ? `Post a run on any of the ${detail.games.length} and you lead.`
              : 'The first run posted leads, whatever it scores.'}
        </p>
      </div>
    </section>
  )
}

/**
 * A bracket whose lobby closed a week after it was made, its seats not all taken: no draw, so the card says
 * who was in, and offers its host another go.
 */
export function LobbyClosedCard({ detail }: { detail: TournamentDetail }) {
  const cap = detail.rules.maxPlayers
  const names = detail.players.map((p) => p.name)
  const who =
    names.length > 6
      ? `${names.slice(0, 5).join(', ')} and ${names.length - 5} more`
      : names.length > 1
        ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
        : (names[0] ?? 'Nobody')
  return (
    <section className="evp-card evp-table" aria-labelledby="evp-closed-title">
      <div className="evp-card__head">
        <h2 id="evp-closed-title" className="evp-card__title">
          Bracket
          <span className="evp-card__count">no draw</span>
        </h2>
      </div>
      <div className="evp-empty">
        <span className="evp-empty__mark" aria-hidden="true">
          <TrophyIcon />
        </span>
        <p className="evp-empty__title">It didn’t fill</p>
        <p className="evp-empty__copy">
          {who} joined in its week{cap ? `, but it needed ${cap}` : ''}, so it closed with no draw.
        </p>
        {detail.isHost ? (
          <a className="evp-btn evp-btn--small" href={tournamentCreateHref()}>
            Make another
          </a>
        ) : null}
      </div>
    </section>
  )
}

/** The top three on their steps, with where each placed on every game. */
export function EventPodium({ rows, detail }: { rows: TableRow[]; detail: TournamentDetail }) {
  const period = useDefaultPeriod()
  const top = rows.filter((r) => r.place <= 3).slice(0, 3)
  if (top.length === 0) return null
  const order = [top[1], top[0], top[2]].filter(Boolean) as TableRow[]
  const allRound = detail.format === 'place-points'
  const level = top[1] && top[1].total === top[0].total ? top[1] : null
  return (
    <section className="evp-card evp-podium-card" aria-label="Podium">
      <ol className="evp-podium">
        {order.map((row) => (
          <li key={row.name} className={`evp-podium__step evp-podium__step--${row.place}`}>
            <a className="evp-podium__who" href={rankHref(row.name, period)}>
              <PlayerAvatar name={row.name} avatarId={row.avatarId} size={row.place === 1 ? 'lg' : 'md'} />
              <span className="evp-podium__name">{row.name}</span>
              {/* An all-round podium is names and places; one where scores add up shows the total. */}
              {allRound ? null : <span className="evp-podium__pts">{eventScoreText(detail.games, row.total)}</span>}
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
          {level.name} and {top[0].name} tied{allRound ? '' : ` on ${eventScoreText(level.cells.map((c) => c.slug), level.total)}`}. The tie went to{' '}
          {top[0].name}.
        </p>
      ) : null}
    </section>
  )
}

/** How the event works, in steps; and, for a weekly, what last week showed. */
export function HowItScores({
  detail,
  lesson,
  me,
}: {
  detail: TournamentDetail
  lesson: SkipLesson | null
  me: string
}) {
  const you = normalizePlayerName(me)
  const who = (name: string) => (you && normalizePlayerName(name) === you ? 'You' : name)
  return (
    <section className="evp-card evp-scores" id="evp-how" aria-labelledby="evp-scores-title">
      <h2 id="evp-scores-title" className="evp-card__title">
        How it works
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
          <b>{detail.status === 'ended' ? 'The lesson:' : 'Last time:'}</b> {who(lesson.name)} won{' '}
          {lesson.won.length === 1 ? gameName(lesson.won[0]) : gameList(lesson.won)} but never played{' '}
          {gameList(lesson.skipped)}, and finished {ordinal(lesson.place)}. {who(lesson.winner)} played them all and won.
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
    <a className="evp-card evp-next evp-wash" href={tournamentHref(t.id)} style={{ '--e': accent, '--e-ink': inkOn(accent), '--e-fill': readableFill(accent) } as CSSProperties}>
      <p className="evp-kick evp-kick--live">
        <span className="evp-dot" aria-hidden="true" />
        {t.cadence === 'weekly'
          ? 'This week’s Triple is on'
          : t.cadence === 'daily'
            ? 'Today’s event is on'
            : t.cadence === 'oneshot'
              ? 'Today’s One Shot is on'
              : 'On now'}
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

/**
 * The winner, in the banner of a finished event: with their score, when a score decided it. The cup and the
 * trophy line only when a trophy was given (lib/eventPages trophyGiven): below its field, the event still has a
 * winner, but no trophy.
 */
export function WinnerCard({
  winner,
  avatarId,
  total,
  mine,
  runnersUp,
  games = [],
  trophy,
  trophyAt,
}: {
  winner: string
  avatarId?: string
  total: number | null
  mine: boolean
  runnersUp: string | null
  /** The event's games, so a racing daily's winning time reads as a time. */
  games?: readonly string[]
  trophy: boolean
  /** How many players a trophy takes, for a win without one. */
  trophyAt: number
}) {
  const amount = total == null ? '' : `, with ${eventScoreText(games, total)}`
  const period = useDefaultPeriod()
  return (
    <div className="evp-winner">
      <span className="evp-winner__mark">
        <PlayerAvatar name={winner} avatarId={avatarId} size="lg" />
        {trophy ? (
          <span className="evp-winner__cup" aria-hidden="true">
            <TrophyIcon />
          </span>
        ) : null}
      </span>
      <span className="evp-winner__text">
        <b>{mine ? `You won${amount}` : `${winner} won${amount}`}</b>
        {mine ? (
          trophy ? (
            <a className="evp-more" href={rankHref(undefined, period)}>
              The trophy is on your player card
            </a>
          ) : (
            <span>No trophy this time: it takes {trophyAt} or more players.</span>
          )
        ) : runnersUp ? (
          <span>{runnersUp}</span>
        ) : null}
      </span>
    </div>
  )
}

