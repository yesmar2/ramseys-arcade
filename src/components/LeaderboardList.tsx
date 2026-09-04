import type { CSSProperties } from 'react'
import { DeviceIcon } from './DeviceIcon'
import { PlayerAvatar } from './PlayerAvatar'
import { PodiumMedal, medalKind } from './PodiumMedal'
import { rankHref } from '../hooks/useHashRoute'
import { defaultPeriod } from '../lib/defaultPeriod'
import {
  normalizePlayerName,
  type LeaderboardEntry,
  type LeaderboardPeriod,
  type YouEntry,
} from '../lib/leaderboard'

const TOP_SLOT_COUNT = 10

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
  fillEmptySlots = false,
  period = defaultPeriod(),
}: {
  entries: LeaderboardEntry[]
  you: YouEntry | null
  playerName: string
  accent: string
  shown: number
  formatScore?: (score: number) => string
  /** Pad with open rows up to `shown` (e.g. hub aside). */
  fillEmptySlots?: boolean
  period?: LeaderboardPeriod
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
          <span className="lb-row__rank-num">#{rank}</span>
          {medal ? <PodiumMedal kind={medal} /> : null}
        </span>
        <a className="lb-row__name lb-row__name--link" href={rankHref(name, period)}>
          <PlayerAvatar avatarId={entry.avatarId} name={name} size="sm" />
          <DeviceIcon device={entry.device} />
          <span className="lb-row__name-text" title={name}>
            {name}
          </span>
          {isYou ? <span className="lb-row__you-tag">You</span> : null}
        </a>
        <span className="lb-row__score">{formatScore(entry.score)}</span>
        <span className="lb-row__date">{formatDate(entry.at)}</span>
      </li>
    )
  }

  const renderEmptyRow = (rank: number) => (
    <li
      key={`empty-${rank}`}
      className="lb-row lb-row--empty"
      aria-hidden="true"
    >
      <span className="lb-row__rank">
        <span className="lb-row__rank-num">#{rank}</span>
      </span>
      <span className="lb-row__name">
        <span className="lb-row__name-text lb-row__placeholder">Open</span>
      </span>
      <span className="lb-row__score lb-row__placeholder">—</span>
      <span className="lb-row__date lb-row__placeholder">—</span>
    </li>
  )

  const padSlots = entries.length >= 1 && visible.length < TOP_SLOT_COUNT
  const slotCount = fillEmptySlots
    ? shown
    : padSlots
      ? TOP_SLOT_COUNT
      : visible.length

  return (
    <ol className="lb-list">
      {youOffVisible && you ? (
        <>
          {renderRow(you, you.rank, true, { markYouId: true, pinned: true })}
          {slotCount > 0 ? (
            <li className="lb-you-split">Top {TOP_SLOT_COUNT}</li>
          ) : null}
        </>
      ) : null}
      {Array.from({ length: slotCount }, (_, index) => {
        const entry = visible[index]
        const rank = index + 1
        if (entry) {
          const isYou =
            Boolean(youName) && normalizePlayerName(entry.name ?? '') === youName
          return renderRow(entry, rank, isYou, {
            markYouId: isYou && !youOffVisible,
          })
        }
        return renderEmptyRow(rank)
      })}
    </ol>
  )
}
