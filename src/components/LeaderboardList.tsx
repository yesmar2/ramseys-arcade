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

/**
 * A score board, in the same rows an event's standings use: a medal or
 * place, who, the score, and when — with the top three on their bands.
 */
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
  const style = { '--event-accent': accent } as CSSProperties

  const renderRow = (
    entry: LeaderboardEntry,
    rank: number,
    isYou: boolean,
    opts?: { markYouId?: boolean; pinned?: boolean },
  ) => {
    const medal = medalKind(rank)
    const name = normalizePlayerName(entry.name ?? '')
    const cls = [
      'ev-row',
      rank <= 3 ? `ev-row--${rank}` : '',
      isYou ? 'ev-row--you' : '',
      opts?.pinned ? 'ev-row--pinned' : '',
    ]
      .filter(Boolean)
      .join(' ')
    return (
      <li
        key={`${entry.id}${opts?.markYouId ? '-you' : ''}${opts?.pinned ? '-pin' : ''}`}
        id={opts?.markYouId ? 'lb-you-row' : undefined}
        className={cls}
        aria-current={isYou ? 'true' : undefined}
      >
        <div className="ev-row__main ev-row__main--meta">
          <span className="ev-row__rank" aria-label={`Place ${rank}`}>
            {medal ? <PodiumMedal kind={medal} period={period} size="sm" /> : rank}
          </span>
          <a className="ev-row__who" href={rankHref(name, period)} title={name}>
            <PlayerAvatar avatarId={entry.avatarId} name={name} size="sm" />
            <DeviceIcon device={entry.device} />
            <span className="ev-row__name">{name}</span>
            {isYou ? <span className="ev-row__you-tag">You</span> : null}
          </a>
          <span className="ev-row__score">{formatScore(entry.score)}</span>
          <span className="ev-row__meta">{formatDate(entry.at)}</span>
        </div>
      </li>
    )
  }

  const renderEmptyRow = (rank: number) => (
    <li key={`empty-${rank}`} className="ev-row ev-row--empty" aria-hidden="true">
      <div className="ev-row__main ev-row__main--meta">
        <span className="ev-row__rank">{rank}</span>
        <span className="ev-row__who">
          <span className="ev-row__name ev-row__name--open">Open</span>
        </span>
        <span className="ev-row__score">—</span>
        <span className="ev-row__meta" />
      </div>
    </li>
  )

  const padSlots = entries.length >= 1 && visible.length < TOP_SLOT_COUNT
  const slotCount = fillEmptySlots
    ? shown
    : padSlots
      ? TOP_SLOT_COUNT
      : visible.length

  return (
    <ol className="ev-board" style={style}>
      {youOffVisible && you ? (
        <>
          {renderRow(you, you.rank, true, { markYouId: true, pinned: true })}
          {slotCount > 0 ? <li className="ev-split">Top {TOP_SLOT_COUNT}</li> : null}
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
