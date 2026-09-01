import type { CSSProperties } from 'react'
import { gameBoardHref, rankHref } from '../hooks/useHashRoute'
import { formatLeaderboardScore } from '../games/spotter/score'
import {
  PERIOD_LABELS,
  normalizePlayerName,
  type LeaderboardEntry,
  type LeaderboardGame,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { PlayerAvatar } from './PlayerAvatar'
import { PodiumMedal, medalKind } from './PodiumMedal'

const PODIUM_SLOTS = 3

export function PeriodMiniBoard({
  slug,
  period,
  entries,
  accent,
  playerName,
}: {
  slug: LeaderboardGame
  period: LeaderboardPeriod
  entries: LeaderboardEntry[]
  accent: string
  playerName: string
}) {
  const label = PERIOD_LABELS[period]
  const slots = Array.from({ length: PODIUM_SLOTS }, (_, i) => entries[i] ?? null)

  return (
    <div
      className="lb-summary__period"
      style={{ '--tab-accent': accent } as CSSProperties}
    >
      <a
        className="lb-summary__period-head"
        href={gameBoardHref(slug, period)}
        aria-label={`${label} board`}
      >
        <span className="lb-summary__period-label">{label}</span>
        <span className="lb-summary__period-go" aria-hidden="true">
          →
        </span>
      </a>
      <ol className="lb-summary__rows">
        {slots.map((entry, i) => {
          const rank = i + 1
          const medal = medalKind(rank)
          if (!entry) {
            return (
              <li key={`empty-${rank}`} className="lb-summary__row lb-summary__row--empty">
                <span className="lb-summary__rank">
                  <span className="lb-summary__rank-num">#{rank}</span>
                  {medal ? <PodiumMedal kind={medal} /> : null}
                </span>
                <span className="lb-summary__name lb-summary__placeholder">Open</span>
                <span className="lb-summary__score lb-summary__placeholder">—</span>
              </li>
            )
          }
          const name = normalizePlayerName(entry.name ?? '')
          const isYou = Boolean(playerName) && name === playerName
          return (
            <li
              key={entry.id ?? `${period}-${rank}`}
              className={`lb-summary__row${isYou ? ' lb-summary__row--you' : ''}${medal ? ' lb-summary__row--medal' : ''}`}
            >
              <span className="lb-summary__rank">
                <span className="lb-summary__rank-num">#{rank}</span>
                {medal ? <PodiumMedal kind={medal} /> : null}
              </span>
              <a className="lb-summary__player" href={rankHref(name, period)} title={name}>
                <PlayerAvatar avatarId={entry.avatarId} name={name} size="sm" />
                <span className="lb-summary__name">{name}</span>
                {isYou ? <span className="lb-summary__you">You</span> : null}
              </a>
              <span className="lb-summary__score">
                {formatLeaderboardScore(slug, entry.score)}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
