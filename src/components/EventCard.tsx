import type { CSSProperties, ReactNode } from 'react'
import { getGame } from '../data/games'
import { tournamentHref } from '../hooks/useHashRoute'
import { resolveGameAccent } from '../lib/theme'
import {
  cadenceLabel,
  eventKind,
  formatEventCountdown,
  isUnlimitedDuration,
  joinedRosterLabel,
  seatsLeft,
  type PodiumEntry,
  type TournamentFormat,
  type TournamentSummary,
} from '../lib/tournaments'
import { EventCountdown } from './EventCountdown'
import { GameThumbArt } from './GameThumbArt'
import { medalKind, PodiumMedal } from './PodiumMedal'

export function eventAccent(games: string[]) {
  const slug = games[0] ?? ''
  const fallback = getGame(slug)?.accent ?? '#2eb8a0'
  return resolveGameAccent(slug, fallback)
}

export function ordinal(n: number): string {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

/**
 * The day a finished event ran: "Sep 12".
 *
 * Taken from when it started, not when it ended — a daily closes at midnight,
 * so its end lands on the next day's date and every daily reads a day late.
 */
export function eventDay(t: Pick<TournamentSummary, 'startsAt'>): string {
  try {
    return new Date(t.startsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

/** Compact label for the scoring format, short enough to sit in a caption. */
export function formatWord(format: TournamentFormat): string {
  switch (format) {
    case 'place-points':
      return 'Place points'
    case 'attempt-limited':
      return 'Limited tries'
    case 'single-run':
      return 'One run'
    case 'cumulative':
      return 'Total score'
    default:
      return 'Best score'
  }
}

export type EventPhase = 'live' | 'filling' | 'upcoming' | 'ended'

type PhaseSource = Pick<TournamentSummary, 'status' | 'kind'>

/** A bracket reads "upcoming" until its roster fills — call that filling. */
export function eventPhase(t: PhaseSource): EventPhase {
  if (t.status === 'ended') return 'ended'
  if (t.status === 'upcoming') return eventKind(t) === 'bracket' ? 'filling' : 'upcoming'
  return 'live'
}

const PHASE_LABEL: Record<EventPhase, string> = {
  live: 'Live',
  filling: 'Filling',
  upcoming: 'Soon',
  ended: 'Ended',
}

/* ---------- art ---------- */

/**
 * The event's artwork: its game's thumb, or a tinted cluster of up to four
 * when there are several. Size comes from the parent via --ev-art-size.
 */
export function EventArt({ games, className }: { games: string[]; className?: string }) {
  const shown = games.slice(0, 4)
  const accent = eventAccent(games)
  const cls = className ? ` ${className}` : ''

  if (shown.length <= 1) {
    return (
      <span className={`ev-art ev-art--solo${cls}`} aria-hidden="true">
        <GameThumbArt slug={shown[0] ?? ''} accent={accent} />
      </span>
    )
  }

  return (
    <span
      className={`ev-art ev-art--cluster ev-art--n${shown.length}${cls}`}
      aria-hidden="true"
      style={{ '--thumb-accent': accent } as CSSProperties}
    >
      {shown.map((slug) => {
        const g = getGame(slug)
        const a = resolveGameAccent(slug, g?.accent ?? accent)
        return (
          <span key={slug} className="ev-art__cell">
            <GameThumbArt slug={slug} accent={a} />
          </span>
        )
      })}
    </span>
  )
}

/* ---------- kicker ---------- */

type KickerSource = Pick<
  TournamentSummary,
  'status' | 'kind' | 'cadence' | 'official' | 'private' | 'format' | 'rules'
>

/**
 * One caption line that says what kind of thing this is and where it is up
 * to: "● Live · Daily · Best score". Replaces the old row of pills.
 */
export function EventKicker({
  t,
  joined = false,
  className,
}: {
  t: KickerSource
  joined?: boolean
  className?: string
}) {
  const phase = eventPhase(t)
  const bracket = eventKind(t) === 'bracket'
  const bits: ReactNode[] = [
    <span key="status" className={`ev-kicker__status ev-kicker__status--${phase}`}>
      {phase === 'live' ? <span className="ev-live-dot" aria-hidden="true" /> : null}
      {PHASE_LABEL[phase]}
    </span>,
  ]

  const cadence = cadenceLabel(t.cadence)
  if (cadence) bits.push(cadence)
  else if (t.private) bits.push('Invite only')
  else if (t.official) bits.push('Official')

  if (bracket) bits.push(t.rules.elimination === 'double' ? 'Double-elim bracket' : 'Bracket')
  else bits.push(formatWord(t.format))

  if (joined) {
    bits.push(
      <span key="joined" className="ev-kicker__joined">
        Joined
      </span>,
    )
  }

  return (
    <p className={`ev-kicker${className ? ` ${className}` : ''}`}>
      {bits.map((bit, i) => (
        <span key={i} className="ev-kicker__bit">
          {bit}
        </span>
      ))}
    </p>
  )
}

/* ---------- list: live card ---------- */

function podiumValue(row: PodiumEntry): string {
  if (row.score != null) return row.score.toLocaleString()
  if (row.points > 0) return `${row.points} pts`
  return '—'
}

function cardClock(t: TournamentSummary): ReactNode {
  const bracket = eventKind(t) === 'bracket'
  if (t.status === 'ended') return 'Ended'
  if (bracket) {
    if (t.status === 'upcoming') {
      const left = seatsLeft(t)
      if (left != null && left > 0) return `${left} ${left === 1 ? 'seat' : 'seats'} left`
      return 'Drawing the bracket'
    }
    if (t.nextDeadlineAt != null && t.nextDeadlineAt > 0) {
      return (
        <>
          Round · <EventCountdown endsAt={t.nextDeadlineAt} />
        </>
      )
    }
    return 'Matches in play'
  }
  if (t.status === 'upcoming') {
    return `Starts in ${formatEventCountdown(t.startsAt).replace(/ left$/, '')}`
  }
  return <EventCountdown endsAt={t.endsAt} unlimitedDuration={isUnlimitedDuration(t.rules)} />
}

function emptyLine(t: TournamentSummary): string {
  const bracket = eventKind(t) === 'bracket'
  if (bracket && t.status === 'upcoming') {
    const left = seatsLeft(t)
    return left != null && left > 0 ? `Waiting for ${left} more` : 'Bracket is drawing'
  }
  if (bracket) return 'Matches in play'
  if (t.playerCount > 0) return 'No scores yet'
  return 'Be first on the board'
}

/**
 * A running event, as a tinted card led by its artwork.
 *
 * The leaders sit inside the card so the week can be read without opening
 * anything; the clock and a way in sit along the bottom.
 */
export function EventLiveCard({
  t,
  href,
  joined = false,
}: {
  t: TournamentSummary
  href?: string
  joined?: boolean
}) {
  const accent = eventAccent(t.games)
  const bracket = eventKind(t) === 'bracket'
  const filling = bracket && t.status === 'upcoming'
  const podium = t.podium ?? []
  const onPodium = t.yourPlace != null && t.yourPlace <= podium.length
  const players = bracket
    ? `${joinedRosterLabel(t)} in`
    : t.playerCount === 1
      ? '1 playing'
      : `${t.playerCount} playing`
  const go = joined ? (filling ? 'Open' : 'Play') : bracket ? 'Join' : 'Play'

  return (
    <a
      className={`evc${filling ? ' evc--filling' : ''}`}
      href={href ?? tournamentHref(t.id)}
      style={{ '--event-accent': accent } as CSSProperties}
    >
      <EventArt games={t.games} className="evc__art" />
      <span className="evc__body">
        <EventKicker t={t} joined={joined} className="evc__kicker" />
        <span className="evc__title">{t.title}</span>
        {podium.length > 0 ? (
          <ol className="evc__leaders">
            {podium.slice(0, 3).map((row) => {
              const medal = medalKind(row.place)
              return (
                <li key={row.name} className={`evc__leader evc__leader--${row.place}`}>
                  <span className="evc__pos">
                    {medal ? <PodiumMedal kind={medal} size="sm" /> : row.place}
                  </span>
                  <span className="evc__who">{row.name}</span>
                  <span className="evc__val">{podiumValue(row)}</span>
                </li>
              )
            })}
          </ol>
        ) : (
          <span className="evc__empty">{emptyLine(t)}</span>
        )}
        {t.yourPlace != null && !onPodium ? (
          <span className="evc__you">
            You {ordinal(t.yourPlace)}
            {t.yourPoints ? ` · ${t.yourPoints} pts` : ''}
          </span>
        ) : null}
      </span>
      <span className="evc__foot">
        <span className="evc__clock">{cardClock(t)}</span>
        <span className="evc__players">{players}</span>
        <span className="evc__go">{go}</span>
      </span>
    </a>
  )
}

/* ---------- list: result row ---------- */

/** A finished event: one quiet line, led by who won it. */
export function EventResultRow({ t, href }: { t: TournamentSummary; href?: string }) {
  const accent = eventAccent(t.games)
  const podium = t.podium ?? []
  const top = podium[0]
  const winner = t.winner ?? top?.name ?? null
  const value = top ? podiumValue(top) : null
  const cadence = cadenceLabel(t.cadence)
  const meta = [
    eventDay(t),
    cadence ?? (eventKind(t) === 'bracket' ? 'Bracket' : t.private ? 'Invite only' : null),
    t.playerCount > 0 ? `${t.playerCount} played` : null,
  ].filter(Boolean)

  return (
    <a
      className="evr"
      href={href ?? tournamentHref(t.id)}
      style={{ '--event-accent': accent } as CSSProperties}
    >
      <EventArt games={t.games} className="evr__art" />
      <span className="evr__main">
        <span className="evr__title">{t.title}</span>
        <span className="evr__meta">{meta.join(' · ')}</span>
      </span>
      {winner ? (
        <span className="evr__winner">
          <PodiumMedal kind="gold" size="sm" />
          <span className="evr__name">{winner}</span>
          {value && value !== '—' ? <span className="evr__val">{value}</span> : null}
        </span>
      ) : (
        <span className="evr__none">Nobody played</span>
      )}
      {t.yourPlace != null ? (
        <span className={`evr__you${t.yourPlace === 1 ? ' evr__you--won' : ''}`}>
          {t.yourPlace === 1 ? 'You won' : `You ${ordinal(t.yourPlace)}`}
        </span>
      ) : null}
    </a>
  )
}
