import type { CSSProperties } from 'react'
import { DeviceIcon } from './DeviceIcon'
import { PlayerAvatar } from './PlayerAvatar'
import { PodiumMedal, medalKind } from './PodiumMedal'
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

export function LeaderboardList({
  entries,
  you,
  playerName,
  accent,
  shown,
  formatScore = (n: number) => String(n),
}: {
  entries: LeaderboardEntry[]
  you: YouEntry | null
  playerName: string
  accent: string
  shown: number
  formatScore?: (score: number) => string
}) {
  const visible = entries.slice(0, shown)
  const youName = normalizePlayerName(playerName)
  const youOnVisible = Boolean(
    you &&
      visible.some(
        (entry) => normalizePlayerName(entry.name ?? '') === youName,
      ),
  )
  const youOffVisible = Boolean(you && !youOnVisible)
  const youStyle = { '--lb-you-accent': accent } as CSSProperties

  const renderRow = (
    entry: LeaderboardEntry,
    rank: number,
    isYou: boolean,
    opts?: { markYouId?: boolean; pinned?: boolean },
  ) => {
    const medal = medalKind(rank)
    const name = normalizePlayerName(entry.name ?? '')
    return (
      <li
        key={`${entry.id}${opts?.markYouId ? '-you' : ''}${opts?.pinned ? '-pin' : ''}`}
        id={opts?.markYouId ? 'lb-you-row' : undefined}
        className={`lb-row${isYou ? ' lb-row--you' : ''}${medal ? ' lb-row--medal' : ''}${opts?.pinned ? ' lb-row--pinned' : ''}`}
        style={isYou ? youStyle : undefined}
        aria-current={isYou ? 'true' : undefined}
      >
        <span className="lb-row__rank">
          {medal ? <PodiumMedal kind={medal} /> : null}
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
        <span className="lb-row__score">{formatScore(entry.score)}</span>
        <span className="lb-row__date">{formatDate(entry.at)}</span>
      </li>
    )
  }

  return (
    <ol className="lb-list">
      {youOffVisible && you ? (
        <>
          {renderRow(you, you.rank, true, { markYouId: true, pinned: true })}
          {visible.length > 0 ? (
            <li className="lb-you-split">Top {shown}</li>
          ) : null}
        </>
      ) : null}
      {visible.map((entry, index) => {
        const isYou =
          Boolean(youName) && normalizePlayerName(entry.name ?? '') === youName
        return renderRow(entry, index + 1, isYou, {
          markYouId: isYou && !youOffVisible,
        })
      })}
    </ol>
  )
}
