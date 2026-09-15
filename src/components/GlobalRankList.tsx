import { rankHref } from '../hooks/useHashRoute'
import {
  normalizePlayerName,
  type GlobalBoardEntry,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { PlayerAvatar } from './PlayerAvatar'
import { PodiumMedal, medalKind } from './PodiumMedal'
import { TrophyMark } from './TrophyMark'
import type { TrophyCount } from '../lib/trophies'

const TOP_SLOT_COUNT = 10

/** The global rankings, in the same rows an event's standings use. */
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

  const renderRow = (
    entry: GlobalBoardEntry,
    isYou: boolean,
    opts?: { markYouId?: boolean; pinned?: boolean },
  ) => {
    const medal = medalKind(entry.rank)
    const name = normalizePlayerName(entry.name)
    const trophies = trophyCounts[name]
    const cls = [
      'ev-row',
      entry.rank <= 3 ? `ev-row--${entry.rank}` : '',
      isYou ? 'ev-row--you' : '',
      opts?.pinned ? 'ev-row--pinned' : '',
    ]
      .filter(Boolean)
      .join(' ')
    return (
      <li
        key={`${entry.rank}-${name}${opts?.markYouId ? '-you' : ''}`}
        id={opts?.markYouId ? 'lb-you-row' : undefined}
        className={cls}
        aria-current={isYou ? 'true' : undefined}
      >
        <div className="ev-row__main ev-row__main--meta">
          <span className="ev-row__rank" aria-label={`Place ${entry.rank}`}>
            {medal ? <PodiumMedal kind={medal} period={period} size="sm" /> : entry.rank}
          </span>
          <a className="ev-row__who" href={rankHref(name, period)} title={name}>
            <PlayerAvatar avatarId={entry.avatarId} name={name} size="sm" />
            <span className="ev-row__name">{name}</span>
            {trophies?.total ? (
              <TrophyMark count={trophies.total} podium={trophies.podium} size="sm" />
            ) : null}
            {isYou ? <span className="ev-row__you-tag">You</span> : null}
          </a>
          <span className="ev-row__score">
            {entry.score}
            <span className="ev-row__score-unit">pts</span>
          </span>
          <span className="ev-row__meta">
            {entry.games} {entry.games === 1 ? 'game' : 'games'}
          </span>
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
  const slotCount = padSlots ? TOP_SLOT_COUNT : visible.length

  return (
    <ol className="ev-board">
      {youOffVisible && you ? (
        <>
          {renderRow(you, true, { markYouId: true, pinned: true })}
          {slotCount > 0 ? <li className="ev-split">Top {TOP_SLOT_COUNT}</li> : null}
        </>
      ) : null}
      {Array.from({ length: slotCount }, (_, index) => {
        const entry = visible[index]
        const rank = index + 1
        if (entry) {
          const isYou = Boolean(youName) && normalizePlayerName(entry.name) === youName
          return renderRow(entry, isYou, { markYouId: isYou && !youOffVisible })
        }
        return renderEmptyRow(rank)
      })}
    </ol>
  )
}
