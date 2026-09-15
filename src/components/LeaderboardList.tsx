import type { CSSProperties } from 'react'
import { DeviceIcon } from './DeviceIcon'
import { ListRow, ListRowEmpty, ListSplit } from './ListRow'
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

/** A score board: one soft row per place, the way every long list reads. */
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
    you && visible.some((entry) => normalizePlayerName(entry.name ?? '') === youName),
  )
  const youOffVisible = Boolean(you && !youOnVisible)

  const row = (entry: LeaderboardEntry, rank: number, isYou: boolean, pinned = false) => {
    const name = normalizePlayerName(entry.name ?? '')
    return (
      <ListRow
        key={`${entry.id}${pinned ? '-pin' : ''}`}
        id={isYou && (pinned || !youOffVisible) ? 'lb-you-row' : undefined}
        rank={rank}
        name={name}
        href={rankHref(name, period)}
        avatarId={entry.avatarId}
        sub={
          <>
            <DeviceIcon device={entry.device} />
            {formatDate(entry.at)}
          </>
        }
        score={formatScore(entry.score)}
        mine={isYou}
        pinned={pinned}
        period={period}
      />
    )
  }

  const padSlots = entries.length >= 1 && visible.length < TOP_SLOT_COUNT
  const slotCount = fillEmptySlots ? shown : padSlots ? TOP_SLOT_COUNT : visible.length

  return (
    <ol className="lst" style={{ '--event-accent': accent } as CSSProperties}>
      {youOffVisible && you ? (
        <>
          {row(you, you.rank, true, true)}
          {slotCount > 0 ? <ListSplit>Top {TOP_SLOT_COUNT}</ListSplit> : null}
        </>
      ) : null}
      {Array.from({ length: slotCount }, (_, index) => {
        const entry = visible[index]
        const rank = index + 1
        if (entry) {
          const isYou = Boolean(youName) && normalizePlayerName(entry.name ?? '') === youName
          return row(entry, rank, isYou)
        }
        return <ListRowEmpty key={`empty-${rank}`} rank={rank} />
      })}
    </ol>
  )
}
