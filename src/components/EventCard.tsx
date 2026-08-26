import type { CSSProperties } from 'react'
import { getGame } from '../data/games'
import {
  cadenceLabel,
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

function formatWindow(startsAt: number, endsAt: number) {
  const opts: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }
  try {
    return `${new Date(startsAt).toLocaleString(undefined, opts)} → ${new Date(endsAt).toLocaleString(undefined, opts)}`
  } catch {
    return ''
  }
}

export function eventAccent(games: string[]) {
  return getGame(games[0] ?? '')?.accent ?? '#2eb8a0'
}

export function EventStatusChips({
  t,
}: {
  t: Pick<TournamentSummary, 'status' | 'official' | 'cadence'>
}) {
  const cadence = cadenceLabel(t.cadence)
  return (
    <div className="event-chips">
      <span className={`tour-pill tour-pill--${t.status}`}>{statusLabel(t.status)}</span>
      {cadence ? <span className="tour-pill tour-pill--cadence">{cadence}</span> : null}
      {t.official && !cadence ? (
        <span className="tour-pill tour-pill--official">Official</span>
      ) : null}
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
}

/** Shared live/ended event card — Events list and home strip. */
export function EventCard({ t, compact = false }: EventCardProps) {
  const accent = eventAccent(t.games)
  const gameNames = t.games.map((g) => getGame(g)?.name ?? g).join(' · ')

  return (
    <a
      className={`event-card${compact ? ' event-card--compact' : ''}`}
      href={`#/tournaments/${t.id}`}
      style={{ '--event-accent': accent } as CSSProperties}
    >
      <EventThumbs games={t.games} size={compact ? 'md' : 'lg'} />
      <div className="event-card__body">
        <EventStatusChips t={t} />
        <h2 className="event-card__title">{t.title}</h2>
        <p className="event-card__games">{gameNames}</p>
        <div className="event-card__foot">
          {t.status === 'active' ? (
            <span className="event-card__countdown">
              <EventCountdown endsAt={t.endsAt} />
            </span>
          ) : (
            <span className="event-card__window">{formatWindow(t.startsAt, t.endsAt)}</span>
          )}
          <span className="event-card__joined">{t.playerCount} joined</span>
        </div>
      </div>
    </a>
  )
}
