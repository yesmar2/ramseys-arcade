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

/** Hub-style live ticker for the event detail page. */
export function EventTicker({
  t,
  joined = false,
  yourPlace = null,
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
  /** Current player's rank in the event standings, if they have one. */
  yourPlace?: number | null
}) {
  const live = t.status === 'active'
  const upcoming = t.status === 'upcoming'
  const unlimited = isUnlimitedDuration(t.rules)
  const ticking = (live || upcoming) && !unlimited
  const target = upcoming ? t.startsAt : t.endsAt
  const clockLabel = unlimited && live
    ? 'Duration'
    : upcoming
      ? 'Starts in'
      : live
        ? 'Time left'
        : 'Window'

  return (
    <div className="event-ticker">
      <div className="event-ticker__stats">
        <div
          className={`lb-stat event-ticker__stat event-ticker__stat--clock${
            ticking ? ' event-ticker__stat--countdown' : ''
          }${live ? ' event-ticker__stat--live' : ''}`}
          role={ticking ? 'timer' : undefined}
        >
          <span className="lb-stat__label event-ticker__label">
            {live ? <span className="event-ticker__dot" aria-hidden="true" /> : null}
            {clockLabel}
          </span>
          <strong>
            {ticking ? (
              <EventCountdown endsAt={target} precise />
            ) : unlimited && live ? (
              'Open'
            ) : (
              eventDurationLabel(t)
            )}
          </strong>
        </div>
        <div className="event-ticker__facts">
          {yourPlace != null ? (
            <div className="lb-stat event-ticker__stat event-ticker__stat--place">
              <span className="lb-stat__label">Your place</span>
              <strong>#{yourPlace}</strong>
            </div>
          ) : null}
          <div className="lb-stat event-ticker__stat">
            <span className="lb-stat__label">Joined</span>
            <strong>{playerCountLabel(t.playerCount, t.rules)}</strong>
          </div>
        </div>
      </div>
      <div className="event-ticker__chips">
        <EventMetaChips t={t} joined={joined} omitStatus />
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
