import type { CSSProperties } from 'react'
import { rankHref } from '../hooks/useHashRoute'
import { rowDeltaLabel } from '../lib/boardGap'
import {
  normalizePlayerName,
  type GlobalBoardEntry,
} from '../lib/leaderboard'
import { PlayerAvatar } from './PlayerAvatar'
import { PodiumMedal, medalKind } from './PodiumMedal'

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
    const delta = rowDeltaLabel({
      rank: entry.rank,
      score: entry.score,
      entries,
      formatDelta: (n) => String(n),
    })
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
        <span className="lb-row__score">
          <span className="lb-row__score-val">{entry.score}</span>
          {delta ? <span className="lb-row__delta">{delta}</span> : null}
        </span>
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
          {renderRow(you, true, { markYouId: true })}
          {visible.length > 0 ? <li className="lb-you-split">Top {shown}</li> : null}
        </>
      ) : null}
      {visible.map((entry) => {
        const isYou =
          Boolean(youName) && normalizePlayerName(entry.name) === youName
        return renderRow(entry, isYou, { markYouId: isYou && !youOffVisible })
      })}
    </ol>
  )
}
