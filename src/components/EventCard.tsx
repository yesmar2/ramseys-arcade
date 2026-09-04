import type { CSSProperties } from 'react'
import { getGame } from '../data/games'
import {
  cadenceLabel,
  eventDurationLabel,
  isUnlimitedDuration,
  playerCountLabel,
  type TournamentStatus,
  type TournamentSummary,
} from '../lib/tournaments'
import { EventCountdown } from './EventCountdown'
import { GameThumbArt } from './GameThumbArt'

function statusLabel(status: TournamentStatus) {
  if (status === 'active') return 'Live'
  if (status === 'upcoming') return 'Soon'
  return 'Ended'
}


export function eventAccent(games: string[]) {
  return getGame(games[0] ?? '')?.accent ?? '#2eb8a0'
}

function EventMetaChips({
  t,
  joined = false,
  omitStatus = false,
}: {
  t: Pick<TournamentSummary, 'status' | 'official' | 'cadence' | 'format' | 'formatLabel' | 'private'>
  joined?: boolean
  omitStatus?: boolean
}) {
  const cadence = cadenceLabel(t.cadence)
  return (
    <>
      {!omitStatus ? (
        <span className={`tour-pill tour-pill--${t.status}`}>{statusLabel(t.status)}</span>
      ) : null}
      {cadence ? <span className="tour-pill tour-pill--cadence">{cadence}</span> : null}
      {t.private ? <span className="tour-pill tour-pill--private">Invite only</span> : null}
      {!cadence && t.official && !t.private ? (
        <span className="tour-pill tour-pill--official">Official</span>
      ) : null}
      {!cadence && !t.official && !t.private ? (
        <span className="tour-pill tour-pill--format">{t.formatLabel}</span>
      ) : null}
      {joined ? <span className="tour-pill tour-pill--joined">Joined</span> : null}
    </>
  )
}

export function EventStatusChips({
  t,
  joined = false,
}: {
  t: Pick<TournamentSummary, 'status' | 'official' | 'cadence' | 'format' | 'formatLabel' | 'private'>
  /** Show a Joined chip when the current player is in this event. */
  joined?: boolean
}) {
  return (
    <div className="event-chips">
      <EventMetaChips t={t} joined={joined} />
    </div>
  )
}

/** Prominent admission-ticket status for the event detail page. */
export function EventTicket({
  t,
  joined = false,
}: {
  t: Pick<
    TournamentSummary,
    | 'status'
    | 'official'
    | 'cadence'
    | 'format'
    | 'formatLabel'
    | 'private'
    | 'endsAt'
    | 'startsAt'
    | 'playerCount'
    | 'rules'
  >
  joined?: boolean
}) {
  const live = t.status === 'active'
  return (
    <div
      className={`event-ticket event-ticket--${t.status}`}
      role="status"
      aria-label={`${statusLabel(t.status)} event`}
    >
      <div className="event-ticket__main">
        <div className="event-ticket__status">
          {live ? <span className="event-ticket__pulse" aria-hidden="true" /> : null}
          <span className="event-ticket__label">{statusLabel(t.status)}</span>
        </div>
        <p className="event-ticket__timing">
          {live ? (
            <EventCountdown
              endsAt={t.endsAt}
              unlimitedDuration={isUnlimitedDuration(t.rules)}
            />
          ) : (
            eventDurationLabel(t)
          )}
        </p>
        <p className="event-ticket__players">{playerCountLabel(t.playerCount, t.rules)}</p>
        <div className="event-ticket__chips">
          <EventMetaChips t={t} joined={joined} omitStatus />
        </div>
      </div>
      <div className="event-ticket__stub" aria-hidden="true">
        <span className="event-ticket__stub-mark">Admit</span>
      </div>
    </div>
  )
}

export function EventThumbs({
  games,
  size = 'md',
}: {
  games: string[]
  size?: 'sm' | 'md' | 'lg'
}) {
  const shown = games.slice(0, 3)
  return (
    <div
      className={`event-thumbs event-thumbs--${size}${shown.length > 1 ? ' event-thumbs--stack' : ''}`}
      aria-hidden="true"
    >
      {shown.map((slug, i) => {
        const g = getGame(slug)
        return (
          <span
            key={slug}
            className="event-thumbs__item"
            style={
              {
                '--thumb-accent': g?.accent ?? '#2eb8a0',
                zIndex: shown.length - i,
              } as CSSProperties
            }
          >
            <GameThumbArt slug={slug} accent={g?.accent} />
          </span>
        )
      })}
    </div>
  )
}

type EventCardProps = {
  t: TournamentSummary
  /** Slightly smaller thumbs on tight surfaces like home. */
  compact?: boolean
  href?: string
}

/** Shared live/ended event card — Events list and home strip. */
export function EventCard({ t, compact = false, href }: EventCardProps) {
  const accent = eventAccent(t.games)
  const gameNames = t.games.map((g) => getGame(g)?.name ?? g).join(' · ')
  const link = href ?? `#/tournaments/${t.id}`

  return (
    <a
      className={`event-card${compact ? ' event-card--compact' : ''}`}
      href={link}
      style={{ '--event-accent': accent } as CSSProperties}
    >
      <EventThumbs games={t.games} size={compact ? 'md' : 'lg'} />
      <div className="event-card__body">
        <div className="event-card__top">
          <h2 className="event-card__title">{t.title}</h2>
          <EventStatusChips t={t} />
        </div>
        <p className="event-card__games">{gameNames}</p>
        <div className="event-card__foot">
          {t.status === 'active' ? (
            <span className="event-card__countdown">
              <EventCountdown
                endsAt={t.endsAt}
                unlimitedDuration={isUnlimitedDuration(t.rules)}
              />
            </span>
          ) : (
            <span className="event-card__window">{eventDurationLabel(t)}</span>
          )}
          <span className="event-card__joined">{t.playerCount} joined</span>
        </div>
      </div>
    </a>
  )
}
