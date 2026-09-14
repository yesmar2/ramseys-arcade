import type { CSSProperties } from 'react'
import { getGame } from '../data/games'
import { EventCountdown } from './EventCountdown'
import { GameThumbArt } from './GameThumbArt'
import { PodiumMedal, medalKind } from './PodiumMedal'
import { eventAccent } from './EventCard'
import {
  eventKind,
  isUnlimitedDuration,
  type TournamentSummary,
} from '../lib/tournaments'

function seatsLeft(t: TournamentSummary): number {
  const cap = t.rules.maxPlayers ?? 0
  return cap > 0 ? Math.max(0, cap - t.playerCount) : 0
}

/** One short line: what this event is and where it is up to. */
function MetaLine({ t }: { t: TournamentSummary }) {
  const isBracket = eventKind(t) === 'bracket'
  const bits: (string | null)[] = [t.title]

  if (t.status === 'ended') {
    bits.push('ended')
  } else if (t.status === 'upcoming' && isBracket) {
    const left = seatsLeft(t)
    bits.push(left > 0 ? `waiting for ${left} more` : 'drawing')
  } else if (isBracket) {
    bits.push('in play')
  }

  return (
    <p className="ev-b__meta">
      <span className="ev-b__name">{bits[0]}</span>
      {bits.slice(1).map((bit) => (
        <span key={bit}>· {bit}</span>
      ))}
      {t.status === 'active' && !isBracket ? (
        <span>
          ·{' '}
          <EventCountdown
            endsAt={t.endsAt}
            unlimitedDuration={isUnlimitedDuration(t.rules)}
          />
        </span>
      ) : null}
      {t.playerCount > 0 ? <span>· {t.playerCount} in</span> : null}
    </p>
  )
}

/**
 * An event, led by its result.
 *
 * The list used to lead with a title and a joined count and keep the standing
 * inside, so you had to open every event to find out what happened in any of
 * them. Here the podium is the row, and the name and clock are the caption.
 */
export function EventBoardRow({ t, href }: { t: TournamentSummary; href?: string }) {
  const isBracket = eventKind(t) === 'bracket'
  const podium = t.podium ?? []
  const onPodium = t.yourPlace != null && t.yourPlace <= podium.length
  const gameName = getGame(t.games[0] ?? '')?.name ?? ''

  return (
    <a
      className="ev-b"
      href={href ?? `#/tournaments/${t.id}`}
      style={{ '--event-accent': eventAccent(t.games) } as CSSProperties}
    >
      <span className="ev-b__art" aria-hidden="true">
        <GameThumbArt slug={t.games[0] ?? ''} accent={eventAccent(t.games)} />
      </span>

      <span className="ev-b__body">
        <MetaLine t={t} />

        {podium.length > 0 ? (
          <ol className="ev-b__podium">
            {podium.map((row) => {
              const medal = medalKind(row.place)
              return (
                <li key={row.name} className={`ev-b__place ev-b__place--${row.place}`}>
                  <span className="ev-b__pos">
                    {medal ? <PodiumMedal kind={medal} size="sm" /> : row.place}
                  </span>
                  <span className="ev-b__who">{row.name}</span>
                  <span className="ev-b__val">
                    {row.score != null
                      ? row.score.toLocaleString()
                      : row.points > 0
                        ? `${row.points} pts`
                        : '—'}
                  </span>
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="ev-b__empty">
            {t.status === 'ended'
              ? 'Nobody played it'
              : isBracket && t.status === 'upcoming'
                ? `Join — ${seatsLeft(t)} seats left`
                : t.playerCount > 0
                  ? 'No scores yet'
                  : `Nobody in yet — play ${gameName}`}
          </p>
        )}

        {t.yourPlace != null && !onPodium ? (
          <p className="ev-b__you">
            You {t.yourPlace}
            {t.yourPlace === 1 ? 'st' : t.yourPlace === 2 ? 'nd' : t.yourPlace === 3 ? 'rd' : 'th'}
            {t.yourPoints ? ` · ${t.yourPoints} pts` : ''}
          </p>
        ) : null}
      </span>
    </a>
  )
}
