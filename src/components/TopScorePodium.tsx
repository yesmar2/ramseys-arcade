import type { CSSProperties } from 'react'
import { formatLeaderboardScore } from '../games/spotter/score'
import { rankHref } from '../hooks/useHashRoute'
import { defaultPeriod } from '../lib/defaultPeriod'
import {
  normalizePlayerName,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { PlayerAvatar } from './PlayerAvatar'
import { PodiumMedal, medalKind } from './PodiumMedal'

type TopScorePodiumProps = {
  entries: LeaderboardEntry[]
  playerName: string
  accent: string
  slug: string
  rows?: number
  className?: string
  period?: LeaderboardPeriod
}

/** Top N scores as medal podium cards (empty slots stay open). */
export function TopScorePodium({
  entries,
  playerName,
  accent,
  slug,
  rows = 3,
  className = 'game-lobby__podium',
  period = defaultPeriod(),
}: TopScorePodiumProps) {
  const slots = Array.from({ length: rows }, (_, index) => entries[index] ?? null)

  return (
    <ol
      className={className}
      style={{ '--board-accent': accent, '--lb-you-accent': accent } as CSSProperties}
    >
      {slots.map((entry, index) => {
        const rank = index + 1
        const medal = medalKind(rank)
        if (!entry) {
          return (
            <li
              key={`open-${rank}`}
              className={`game-lobby__podium-card game-lobby__podium-card--open${medal ? ` game-lobby__podium-card--${medal}` : ''}`}
            >
              {medal ? <PodiumMedal kind={medal} /> : (
                <span className="game-lobby__podium-rank">#{rank}</span>
              )}
              <span className="game-lobby__podium-name game-lobby__podium-name--muted">Open</span>
              <strong className="game-lobby__podium-score game-lobby__podium-score--muted">—</strong>
            </li>
          )
        }
        const name = normalizePlayerName(entry.name ?? '')
        const isYou = Boolean(playerName) && name === playerName
        return (
          <li
            key={entry.id ?? `${rank}-${name}`}
            className={`game-lobby__podium-card${isYou ? ' game-lobby__podium-card--you' : ''}${medal ? ` game-lobby__podium-card--${medal}` : ''}`}
            aria-current={isYou ? 'true' : undefined}
          >
            {medal ? <PodiumMedal kind={medal} /> : (
              <span className="game-lobby__podium-rank">#{rank}</span>
            )}
            <PlayerAvatar avatarId={entry.avatarId} name={name} size="sm" />
            <a
              className="game-lobby__podium-name game-lobby__podium-name--link"
              href={rankHref(name, period)}
              title={name}
            >
              {name}
              {isYou ? <span className="lb-row__you-tag">You</span> : null}
            </a>
            <strong className="game-lobby__podium-score">
              {formatLeaderboardScore(slug, entry.score)}
            </strong>
          </li>
        )
      })}
    </ol>
  )
}
