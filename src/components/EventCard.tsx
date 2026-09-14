import type { CSSProperties, ReactNode } from 'react'
import { getGame } from '../data/games'
import {
  attemptsPerGameMax,
  cadenceLabel,
  eventDurationLabel,
  eventKind,
  formatRulesSummary,
  isUnlimitedDuration,
  joinedRosterLabel,
  playerCountLabel,
  type TournamentStatus,
  type TournamentSummary,
} from '../lib/tournaments'
import { EventCountdown } from './EventCountdown'
import { medalKind, PodiumMedal } from './PodiumMedal'
import { resolveGameAccent } from '../lib/theme'
import { GameThumbArt } from './GameThumbArt'

function statusLabel(status: TournamentStatus) {
  if (status === 'active') return 'Live'
  if (status === 'upcoming') return 'Soon'
  return 'Ended'
}

export function eventAccent(games: string[]) {
  const slug = games[0] ?? ''
  const fallback = getGame(slug)?.accent ?? '#2eb8a0'
  return resolveGameAccent(slug, fallback)
}

type ChipSource = Pick<
  TournamentSummary,
  'status' | 'official' | 'cadence' | 'format' | 'formatLabel' | 'private' | 'kind'
>

function EventMetaChips({ t, joined = false }: { t: ChipSource; joined?: boolean }) {
  const cadence = cadenceLabel(t.cadence)
  return (
    <>
      <span className={`tour-pill tour-pill--${t.status}`}>{statusLabel(t.status)}</span>
      {cadence ? <span className="tour-pill tour-pill--cadence">{cadence}</span> : null}
      {t.private ? <span className="tour-pill tour-pill--private">Invite only</span> : null}
      {eventKind(t) === 'bracket' ? (
        <span className="tour-pill tour-pill--format">Bracket</span>
      ) : null}
      {!cadence && t.official && !t.private ? (
        <span className="tour-pill tour-pill--official">Official</span>
      ) : null}
      {!cadence && !t.official && !t.private && eventKind(t) !== 'bracket' ? (
        <span className="tour-pill tour-pill--format">{t.formatLabel}</span>
      ) : null}
      {joined ? <span className="tour-pill tour-pill--joined">Joined</span> : null}
    </>
  )
}

export function EventStatusChips({
  t,
  joined = false,
  className = 'event-chips',
}: {
  t: ChipSource
  /** Show a Joined chip when the current player is in this event. */
  joined?: boolean
  className?: string
}) {
  return (
    <div className={className}>
      <EventMetaChips t={t} joined={joined} />
    </div>
  )
}

type SummarySource = Pick<
  TournamentSummary,
  | 'status'
  | 'official'
  | 'cadence'
  | 'format'
  | 'formatLabel'
  | 'private'
  | 'kind'
  | 'endsAt'
  | 'startsAt'
  | 'playerCount'
  | 'games'
  | 'rules'
  | 'nextDeadlineAt'
  | 'winner'
>

function attemptsValue(t: SummarySource): string {
  const n = attemptsPerGameMax(t)
  if (n == null) return 'Unlimited'
  if (eventKind(t) === 'bracket') return n === 1 ? '1 per match' : `${n} per match`
  return n === 1 ? '1 per game' : `${n} per game`
}

type SummaryStat = {
  key: string
  label: string
  value: ReactNode
  clock?: boolean
  live?: boolean
}

/**
 * One card of evenly divided stat cells across the top of an event page.
 * Replaces the old free-floating tiles so every value lines up on one
 * baseline and the card reads the same on phone and desktop.
 */
export function EventSummary({
  t,
  joined = false,
  yourPlace = null,
  matchLine = null,
}: {
  t: SummarySource
  joined?: boolean
  /** Current player's rank in the event standings, if they have one. */
  yourPlace?: number | null
  /** Bracket match line, e.g. "You vs BOB" or "Waiting for 2 more". */
  matchLine?: string | null
}) {
  const live = t.status === 'active'
  const upcoming = t.status === 'upcoming'
  const isBracket = eventKind(t) === 'bracket'
  const unlimited = isUnlimitedDuration(t.rules)
  const fillingBracket = upcoming && isBracket
  const roundDeadline =
    isBracket && live && t.nextDeadlineAt != null && t.nextDeadlineAt > 0
      ? t.nextDeadlineAt
      : null
  const ticking = fillingBracket
    ? false
    : isBracket
      ? roundDeadline != null
      : (live || upcoming) && !unlimited
  const target = isBracket ? (roundDeadline ?? 0) : upcoming ? t.startsAt : t.endsAt
  const clockLabel = fillingBracket
    ? 'Starts'
    : isBracket && live
      ? roundDeadline
        ? 'Round ends'
        : 'Rounds'
      : unlimited && live
        ? 'Runs'
        : upcoming
          ? 'Starts in'
          : live
            ? 'Time left'
            : 'Window'
  const clockValue: ReactNode = fillingBracket ? (
    'When full'
  ) : ticking ? (
    <EventCountdown endsAt={target} precise />
  ) : isBracket && live ? (
    'Open matches'
  ) : unlimited && live ? (
    'Till all done'
  ) : (
    eventDurationLabel(t)
  )

  const won = t.status === 'ended' ? (t.winner ?? null) : null
  const medal = yourPlace != null ? medalKind(yourPlace) : null
  /*
   * A finished event leads with its result. The window it ran in is the least
   * useful thing on the page once it is over, and the winner was previously
   * not stated anywhere at all.
   */
  const stats: SummaryStat[] = won
    ? [
        {
          key: 'winner',
          label: 'Winner',
          value: (
            <>
              <PodiumMedal kind="gold" size="sm" />
              {won}
            </>
          ),
        },
      ]
    : [{ key: 'clock', label: clockLabel, value: clockValue, clock: true, live }]

  if (isBracket) {
    stats.push({ key: 'match', label: 'Your match', value: matchLine ?? 'Not seeded' })
  } else if (joined) {
    stats.push({
      key: 'place',
      label: 'Your place',
      value:
        yourPlace != null ? (
          <>
            {medal ? <PodiumMedal kind={medal} size="sm" /> : null}
            {`#${yourPlace}`}
          </>
        ) : (
          'No score yet'
        ),
    })
  }

  stats.push({
    key: 'players',
    label: 'Players',
    value: isBracket ? joinedRosterLabel(t) : playerCountLabel(t.playerCount),
  })
  stats.push({ key: 'attempts', label: 'Tries', value: attemptsValue(t) })

  return (
    <section className="ev-card ev-summary" aria-label="Event status">
      <dl
        className="ev-summary__stats"
        style={{ '--ev-stat-count': stats.length } as CSSProperties}
      >
        {stats.map((stat) => (
          <div
            key={stat.key}
            className={`ev-stat${stat.clock ? ' ev-stat--clock' : ''}${
              stat.live && stat.clock ? ' ev-stat--live' : ''
            }`}
          >
            <dt className="ev-stat__label">
              {stat.clock && stat.live ? (
                <span className="ev-stat__dot" aria-hidden="true" />
              ) : null}
              {stat.label}
            </dt>
            <dd className="ev-stat__value">{stat.value}</dd>
          </div>
        ))}
      </dl>
      <p className="ev-summary__rules">{formatRulesSummary(t)}</p>
    </section>
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
        const accent = resolveGameAccent(slug, g?.accent ?? '#2eb8a0')
        return (
          <span
            key={slug}
            className="event-thumbs__item"
            style={
              {
                '--thumb-accent': accent,
                zIndex: shown.length - i,
              } as CSSProperties
            }
          >
            <GameThumbArt slug={slug} accent={accent} />
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

/** Shared list tile — Events list and the home strip. */
export function EventCard({ t, compact = false, href }: EventCardProps) {
  const accent = eventAccent(t.games)
  const gameNames = t.games.map((g) => getGame(g)?.name ?? g).join(' · ')
  const link = href ?? `#/tournaments/${t.id}`
  const isBracket = eventKind(t) === 'bracket'

  const clock: ReactNode =
    t.status === 'active' && isBracket ? (
      t.nextDeadlineAt != null && t.nextDeadlineAt > 0 ? (
        <EventCountdown endsAt={t.nextDeadlineAt} />
      ) : (
        eventDurationLabel(t)
      )
    ) : t.status === 'active' ? (
      <EventCountdown endsAt={t.endsAt} unlimitedDuration={isUnlimitedDuration(t.rules)} />
    ) : t.status === 'upcoming' && isBracket ? (
      'Starts when full'
    ) : (
      eventDurationLabel(t)
    )

  return (
    <a
      className={`ev-tile${t.status === 'ended' ? ' ev-tile--ended' : ''}`}
      href={link}
      style={{ '--event-accent': accent } as CSSProperties}
    >
      <EventThumbs games={t.games} size={compact ? 'md' : 'lg'} />
      <div className="ev-tile__body">
        <div className="ev-tile__top">
          <h3 className="ev-tile__title">{t.title}</h3>
          <EventStatusChips t={t} />
        </div>
        <p className="ev-tile__games">{gameNames}</p>
        <div className="ev-tile__foot">
          {t.winner ? (
            <span className="ev-tile__winner">
              <PodiumMedal kind="gold" size="sm" />
              {t.winner} won
            </span>
          ) : (
            <span className="ev-tile__clock">{clock}</span>
          )}
          <span className="ev-tile__players">
            {isBracket ? joinedRosterLabel(t) : t.playerCount} joined
          </span>
        </div>
      </div>
    </a>
  )
}
