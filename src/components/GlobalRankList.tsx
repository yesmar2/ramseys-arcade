import type { CSSProperties } from 'react'
import { rankHref } from '../hooks/useHashRoute'
import {
  normalizePlayerName,
  type GlobalBoardEntry,
} from '../lib/leaderboard'

function medalKind(rank: number): 'gold' | 'silver' | 'bronze' | null {
  if (rank === 1) return 'gold'
  if (rank === 2) return 'silver'
  if (rank === 3) return 'bronze'
  return null
}

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

  const renderRow = (entry: GlobalBoardEntry, isYou: boolean) => {
    const medal = medalKind(entry.rank)
    const name = normalizePlayerName(entry.name)
    const nameInner = (
      <>
        <span className="lb-row__name-text" title={name}>
          {name}
        </span>
        {isYou ? <span className="lb-row__you-tag">You</span> : null}
      </>
    )
    return (
      <li
        key={`${entry.rank}-${name}`}
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

  return (
    <ol className="lb-list">
      {youOffVisible && you ? (
        <>
          {renderRow(you, true)}
          {visible.length > 0 ? <li className="lb-you-split">Top {shown}</li> : null}
        </>
      ) : null}
      {visible.map((entry) =>
        renderRow(
          entry,
          Boolean(youName) && normalizePlayerName(entry.name) === youName,
        ),
      )}
    </ol>
  )
}
