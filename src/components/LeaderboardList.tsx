import type { CSSProperties } from 'react'
import { DeviceIcon } from './DeviceIcon'
import { PlayerAvatar } from './PlayerAvatar'
import {
  normalizePlayerName,
  type LeaderboardEntry,
  type YouEntry,
} from '../lib/leaderboard'

function formatDate(at: number) {
  try {
    return new Date(at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return ''
  }
}

function medalKind(rank: number): 'gold' | 'silver' | 'bronze' | null {
  if (rank === 1) return 'gold'
  if (rank === 2) return 'silver'
  if (rank === 3) return 'bronze'
  return null
}

export function LeaderboardList({
  entries,
  you,
  playerName,
  accent,
  shown,
}: {
  entries: LeaderboardEntry[]
  you: YouEntry | null
  playerName: string
  accent: string
  shown: number
}) {
  const visible = entries.slice(0, shown)
  const youOnVisible = Boolean(you && visible.some((entry) => entry.id === you.id))
  const youOffVisible = Boolean(you && !youOnVisible)
  const youStyle = { '--lb-you-accent': accent } as CSSProperties
  const youName = normalizePlayerName(playerName)

  const renderRow = (entry: LeaderboardEntry, rank: number, isYou: boolean) => {
    const medal = medalKind(rank)
    const name = normalizePlayerName(entry.name ?? '')
    return (
      <li
        key={entry.id}
        className={`lb-row${isYou ? ' lb-row--you' : ''}`}
        style={isYou ? youStyle : undefined}
        aria-current={isYou ? 'true' : undefined}
      >
        <span className="lb-row__rank">
          {medal ? (
            <span
              className={`lb-medal lb-medal--${medal}`}
              title={medal}
              aria-hidden="true"
            />
          ) : null}
          #{rank}
        </span>
        <span className="lb-row__name">
          <PlayerAvatar avatarId={entry.avatarId} name={name} size="sm" />
          <DeviceIcon device={entry.device} />
          <span className="lb-row__name-text" title={name}>
            {name}
          </span>
          {isYou ? <span className="lb-row__you-tag">You</span> : null}
        </span>
        <span className="lb-row__score">{entry.score}</span>
        <span className="lb-row__date">{formatDate(entry.at)}</span>
      </li>
    )
  }

  return (
    <ol className="lb-list">
      {youOffVisible && you ? (
        <>
          {renderRow(you, you.rank, true)}
          {visible.length > 0 ? <li className="lb-you-split">Top {shown}</li> : null}
        </>
      ) : null}
      {visible.map((entry, index) =>
        renderRow(
          entry,
          index + 1,
          Boolean(youName) && normalizePlayerName(entry.name ?? '') === youName,
        ),
      )}
    </ol>
  )
}
