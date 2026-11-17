import { useId, type CSSProperties } from 'react'
import { rankHref, tournamentCreateHref, tournamentHref } from '../hooks/useHashRoute'
import { inkOn, readableFill } from '../lib/color'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import {
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
import { Panel, PanelHead } from './Panel'
import { InfoIcon } from './pastIcons'
import { PlayerAvatar } from './PlayerAvatar'
import { PlayerName } from './PlayerName'

/*
 * One event's page, under its heading (A from the canvas's "One event" page, Ramsey 2026-11-17: "we can go
 * with A, but i don't want brackets to really change"): the games to play as tiles, the standings as rows
 * with a place a game, the winner once it's over, and how it works behind the ⓘ. A bracket keeps its own
 * drawing (EventBracket).
 */

function gameAccent(slug: string): string {
  return resolveGameAccent(slug, getGame(slug)?.accent ?? '#2eb8a0')
}

/**
 * A game on the event page; a racing daily's event names its course ("#12 Bramble Speedway"). `status` is the
 * tries said in words, for a screen reader; `max` and `left` draw them as dots (no max: as many as you like).
 */
export type GameCardState = {
  slug: string
  href: string | null
  status: string
  course?: string
  max: number | null
  left: number | null
}

/** The tries a game has left, as dots: filled for each one left. Too many to count on dots, a number. */
function TriesDots({ max, left, label }: { max: number | null; left: number | null; label: string }) {
  if (max == null) {
    return (
      <span className="evx-tries evx-tries--any" role="img" aria-label={label}>
        ∞
      </span>
    )
  }
  const have = left ?? max
  if (max > 5) {
    return (
      <span className="evx-tries" role="img" aria-label={label}>
        {have} left
      </span>
    )
  }
  return (
    <span className="evx-dots" role="img" aria-label={label}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={i < have ? 'is-on' : undefined} />
      ))}
    </span>
  )
}

/** Each game as a tile: its screen (Play on it while you can), its name, and the tries left. */
export function EventGameTiles({ games }: { games: GameCardState[] }) {
  return (
    <section className="evh-section" aria-labelledby="evx-play">
      <h2 id="evx-play" className="evh-label">
        Play
      </h2>
      <ul className={`evp-card evx-games evx-games--${Math.min(games.length, 3)}`}>
        {games.map(({ slug, href, status, course, max, left }) => {
          const accent = gameAccent(slug)
          const name = course ? `${gameName(slug)} · ${course}` : gameName(slug)
          return (
            <li key={slug} className="evx-game" style={{ '--e': accent, '--e-ink': inkOn(accent), '--e-fill': readableFill(accent) } as CSSProperties}>
              <EventScreen slug={slug} href={href} label={`Play ${name}`} />
              <span className="evx-game__line">
                <b>{name}</b>
                <TriesDots max={max} left={left} label={status} />
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function cellTitle(cell: TableRow['cells'][number], ended: boolean): string {
  if (cell.place == null) return `${gameName(cell.slug)}: ${ended ? 'skipped' : 'not played yet'}`
  return `${gameName(cell.slug)}: ${formatLeaderboardScore(cell.slug, cell.score ?? 0)}, ${ordinal(cell.place)}`
}

function placeTone(place: number | null): string {
  return place == null ? ' evx-pl--none' : place <= 3 ? ` evx-pl--${place}` : ''
}

/*
 * A player's row: where they stand, who, and where they placed on each game. The scores sit in each place's
 * title (and a screen reader's label); an event where scores add up keeps its total, the number that decides it.
 */
function PlaceRow({ row, allRound, ended, gap = false }: { row: TableRow; allRound: boolean; ended: boolean; gap?: boolean }) {
  // A player's card opens at the period you picked.
  const period = useDefaultPeriod()
  return (
    <li className={`evx-row${row.you ? ' evx-row--you' : ''}${gap ? ' evx-row--gap' : ''}`}>
      <span className={`evx-pos${row.place <= 3 ? ` evx-pos--${row.place}` : ''}`}>{row.place}</span>
      <a className="evx-who" href={rankHref(row.name, period)}>
        <PlayerAvatar name={row.name} avatarId={row.avatarId} size="sm" />
        <PlayerName className="evx-name" name={row.name} avatarId={row.avatarId} />
        {row.you ? <span className="evx-you">You</span> : null}
      </a>
      {row.cells.map((cell) => {
        const title = cellTitle(cell, ended)
        return (
          <span key={cell.slug} className={`evx-pl${placeTone(cell.place)}`} title={title} aria-label={title}>
            {cell.place == null ? '–' : ordinal(cell.place)}
          </span>
        )
      })}
      {allRound ? null : <span className="evx-total">{eventScoreText(row.cells.map((c) => c.slug), row.total)}</span>}
    </li>
  )
}

/**
 * The standings, a row a player: a place for each game, its picture over the column. A game a player hasn't
 * played is a dash. A big event's page carries its top hundred and you (lib/eventPages standingsTable).
 */
export function PlaceTable({ detail, rows, limit }: { detail: TournamentDetail; rows: TableRow[]; limit?: number }) {
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
    <section className="evh-section" aria-labelledby="evx-standings">
      <h2 id="evx-standings" className="evh-label">
        {ended ? 'Final' : 'Standings'} <span className="evh-count">{total.toLocaleString()}</span>
      </h2>
      <div className={`evp-card evx-table${allRound ? '' : ' evx-table--total'}`} style={cols}>
        <div className="evx-row evx-row--head" aria-hidden="true">
          <span />
          <span />
          {detail.games.map((slug) => (
            <span key={slug} className="evx-head-game" title={gameName(slug)}>
              <GameThumbArt slug={slug} accent={gameAccent(slug)} />
            </span>
          ))}
          {allRound ? null : <span />}
        </div>
        <ol className="evx-rows">
          {shown.map((row) => (
            <PlaceRow key={row.name} row={row} allRound={allRound} ended={ended} />
          ))}
          {extra ? <PlaceRow row={extra} allRound={allRound} ended={ended} gap /> : null}
        </ol>
        {limit && top.length > shown.length ? (
          <details className="evx-all">
            <summary>Show {top.length - shown.length} more</summary>
            <ol className="evx-rows">
              {top.slice(shown.length).map((row) => (
                <PlaceRow key={row.name} row={row} allRound={allRound} ended={ended} />
              ))}
            </ol>
          </details>
        ) : null}
        {below > 0 ? <p className="evx-below">+{below.toLocaleString()} more</p> : null}
      </div>
    </section>
  )
}

/** Nobody on the board yet: the empty card says only that. */
export function StandingsEmpty({ detail }: { detail: TournamentDetail }) {
  return (
    <section className="evh-section" aria-labelledby="evx-standings">
      <h2 id="evx-standings" className="evh-label">
        Standings
      </h2>
      <div className="evp-card evx-empty">
        <span className="evx-empty__mark" aria-hidden="true">
          <TrophyIcon />
        </span>
        <p>{detail.status === 'upcoming' ? 'Not started yet' : 'Nobody’s played yet'}</p>
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

/**
 * Who won, once it's over: their face, the cup when a trophy was given (lib/eventPages trophyGiven), and the
 * winning score when a score decided it. A win below the field still wins, without a trophy: said to the winner.
 */
export function EventWinner({
  winner,
  avatarId,
  score,
  mine,
  trophy,
  trophyAt,
}: {
  winner: string
  avatarId?: string
  /** The winning score, in the game's own words; none for an all-round win or a bracket's. */
  score: string | null
  mine: boolean
  trophy: boolean
  /** How many players a trophy takes, for a win without one. */
  trophyAt: number
}) {
  const period = useDefaultPeriod()
  return (
    <div className="evp-card evx-winner">
      <span className={`evx-winner__cup${trophy ? '' : ' evx-winner__cup--none'}`} aria-hidden="true">
        <TrophyIcon />
      </span>
      <a className="evx-winner__who" href={rankHref(mine ? undefined : winner, period)}>
        <PlayerAvatar name={winner} avatarId={avatarId} size="sm" />
        <span className="evx-winner__text">
          <b>{mine ? 'You won' : `${winner} won`}</b>
          {mine && !trophy ? <span>No trophy under {trophyAt} players</span> : null}
        </span>
      </a>
      {score ? <span className="evx-winner__score">{score}</span> : null}
    </div>
  )
}

/** How the event works, from the ⓘ: its steps, and for a weekly, what last week showed. */
export function HowEventModal({
  detail,
  lesson,
  me,
  onClose,
}: {
  detail: TournamentDetail
  lesson: SkipLesson | null
  me: string
  onClose: () => void
}) {
  const titleId = useId()
  const you = normalizePlayerName(me)
  const who = (name: string) => (you && normalizePlayerName(name) === you ? 'You' : name)
  return (
    <Panel labelledBy={titleId} onClose={onClose} className="evh-how">
      <PanelHead titleId={titleId} title="How it works" icon={<InfoIcon />} onClose={onClose} />
      <div className="panel__body">
        <ol className="evh-how__lines">
          {scoringSteps(detail).map((step, i) => (
            <li key={i} className="evh-how__line">
              <span className="evh-how__mark">{i + 1}</span>
              <span className="evh-how__text">
                <span className="evx-step">{step}</span>
              </span>
            </li>
          ))}
        </ol>
        {lesson ? (
          <p className="evx-lesson">
            <b>{detail.status === 'ended' ? 'The lesson:' : 'Last time:'}</b> {who(lesson.name)} won{' '}
            {lesson.won.length === 1 ? gameName(lesson.won[0]) : gameList(lesson.won)} but never played{' '}
            {gameList(lesson.skipped)}, and finished {ordinal(lesson.place)}. {who(lesson.winner)} played them all and won.
          </p>
        ) : null}
      </div>
      <div className="panel__actions">
        <button type="button" className="panel__btn" onClick={onClose}>
          Got it
        </button>
      </div>
    </Panel>
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
