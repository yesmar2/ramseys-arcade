import { rankHref } from '../hooks/useHashRoute'
import {
  normalizePlayerName,
  type GlobalBoardEntry,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { ListRow, ListRowEmpty, ListSplit } from './ListRow'
import { TrophyMark } from './TrophyMark'
import type { TrophyCount } from '../lib/trophies'

const TOP_SLOT_COUNT = 10

/** The global rankings, one soft row per place. */
export function GlobalRankList({
  entries,
  you,
  playerName,
  shown,
  period = 'all',
  trophyCounts = {},
}: {
  entries: GlobalBoardEntry[]
  you: GlobalBoardEntry | null
  playerName: string
  shown: number
  period?: LeaderboardPeriod
  trophyCounts?: Record<string, TrophyCount>
}) {
  const visible = entries.slice(0, shown)
  const youName = normalizePlayerName(playerName)
  const youOnVisible = Boolean(
    you && visible.some((entry) => normalizePlayerName(entry.name) === youName),
  )
  const youOffVisible = Boolean(you && !youOnVisible)

  const row = (entry: GlobalBoardEntry, isYou: boolean, pinned = false) => {
    const name = normalizePlayerName(entry.name)
    const trophies = trophyCounts[name]
    return (
      <ListRow
        key={`${entry.rank}-${name}${pinned ? '-pin' : ''}`}
        id={isYou && (pinned || !youOffVisible) ? 'lb-you-row' : undefined}
        rank={entry.rank}
        name={name}
        href={rankHref(name, period)}
        avatarId={entry.avatarId}
        sub={
          <>
            {entry.games} {entry.games === 1 ? 'game' : 'games'}
            {trophies?.total ? (
              <TrophyMark count={trophies.total} podium={trophies.podium} size="sm" />
            ) : null}
          </>
        }
        score={entry.score}
        unit="pts"
        mine={isYou}
        pinned={pinned}
        period={period}
      />
    )
  }

  const padSlots = entries.length >= 1 && visible.length < TOP_SLOT_COUNT
  const slotCount = padSlots ? TOP_SLOT_COUNT : visible.length

  return (
    <ol className="lst">
      {youOffVisible && you ? (
        <>
          {row(you, true, true)}
          {slotCount > 0 ? <ListSplit>Top {TOP_SLOT_COUNT}</ListSplit> : null}
        </>
      ) : null}
      {Array.from({ length: slotCount }, (_, index) => {
        const entry = visible[index]
        const rank = index + 1
        if (entry) {
          const isYou = Boolean(youName) && normalizePlayerName(entry.name) === youName
          return row(entry, isYou)
        }
        return <ListRowEmpty key={`empty-${rank}`} rank={rank} />
      })}
    </ol>
  )
}
