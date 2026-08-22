import type { CSSProperties } from 'react'
import { rankHref } from '../hooks/useHashRoute'
import {
  normalizePlayerName,
  type GlobalBoardEntry,
} from '../lib/leaderboard'
import { PlayerAvatar } from './PlayerAvatar'
import { PodiumMedal, medalKind } from './PodiumMedal'

const TOP_SLOT_COUNT = 10

export function GlobalRankList({
  entries,
  you,
  playerName,
  shown,
}: {
  entries: GlobalBoardEntry[]
  you: GlobalBoardEntry | null
  playerName: string
  shown: number
}) {
  const visible = entries.slice(0, shown)
  const youName = normalizePlayerName(playerName)
  const youOnVisible = Boolean(
    you && visible.some((entry) => normalizePlayerName(entry.name) === youName),
  )
  const youOffVisible = Boolean(you && !youOnVisible)
  const youStyle = { '--lb-you-accent': 'var(--accent)' } as CSSProperties

  const renderRow = (
    entry: GlobalBoardEntry,
    isYou: boolean,
    opts?: { markYouId?: boolean },
  ) => {
    const medal = medalKind(entry.rank)
    const name = normalizePlayerName(entry.name)
    const nameInner = (
      <>
        <PlayerAvatar avatarId={entry.avatarId} name={name} size="sm" />
        <span className="lb-row__name-text" title={name}>
          {name}
        </span>
        {isYou ? <span className="lb-row__you-tag">You</span> : null}
      </>
    )
    return (
      <li
        key={`${entry.rank}-${name}${opts?.markYouId ? '-you' : ''}`}
        id={opts?.markYouId ? 'lb-you-row' : undefined}
        className={`lb-row${isYou ? ' lb-row--you' : ''}${medal ? ' lb-row--medal' : ''}`}
        style={isYou ? youStyle : undefined}
        aria-current={isYou ? 'true' : undefined}
      >
        <span className="lb-row__rank">
          {medal ? <PodiumMedal kind={medal} /> : null}
          #{entry.rank}
        </span>
        {isYou ? (
          <span className="lb-row__name">{nameInner}</span>
        ) : (
          <a className="lb-row__name lb-row__name--link" href={rankHref(name)}>
            {nameInner}
          </a>
        )}
        <span className="lb-row__score">{entry.score}</span>
        <span className="lb-row__date lb-row__games">
          {entry.games} {entry.games === 1 ? 'game' : 'games'}
        </span>
      </li>
    )
  }

  const renderEmptyRow = (rank: number) => (
    <li
      key={`empty-${rank}`}
      className="lb-row lb-row--empty"
      aria-hidden="true"
    >
      <span className="lb-row__rank">#{rank}</span>
      <span className="lb-row__name">
        <span className="lb-row__name-text lb-row__placeholder">Open</span>
      </span>
      <span className="lb-row__score lb-row__placeholder">—</span>
      <span className="lb-row__date lb-row__placeholder">—</span>
    </li>
  )

  const padSlots = entries.length >= 1 && visible.length < TOP_SLOT_COUNT
  const slotCount = padSlots ? TOP_SLOT_COUNT : visible.length

  return (
    <ol className="lb-list">
      {youOffVisible && you ? (
        <>
          {renderRow(you, true, { markYouId: true })}
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
            Boolean(youName) && normalizePlayerName(entry.name) === youName
          return renderRow(entry, isYou, { markYouId: isYou && !youOffVisible })
        }
        return renderEmptyRow(rank)
      })}
    </ol>
  )
}
