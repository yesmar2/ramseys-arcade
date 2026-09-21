import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { BoardEmpty, BoardSkeleton } from './BoardChrome'
import { getGame } from '../data/games'
import { rankHref, recordHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { groupBoardEmptyTitle, useActiveGroup } from '../lib/groups'
import { normalizePlayerName, type LeaderboardPeriod } from '../lib/leaderboard'
import {
  fetchGameRecords,
  formatRecordScore,
  type RecordSummary,
} from '../lib/records'
import { PlayerMark } from './PlayerMark'

function recordsEmptyDetail(game: string, gameName: string) {
  if (game === 'snake') {
    return 'Reach length milestones in-game and times will show up here. Daily play and strong-score streaks count too.'
  }
  if (game === 'asteroids') {
    return 'Clear a wave in-game and the board will show up here. Daily play and strong-score streaks count too.'
  }
  if (game === 'patriot') {
    return 'Land consecutive perfect hits in-game and the board will show up here. Daily play and strong-score streaks count too.'
  }
  if (game === 'crumbtrail') {
    return 'Climb, and string crumbs together on the way — your furthest run and your longest streak both show up here. Daily play and strong-score streaks count too.'
  }
  if (game === 'pellets') {
    return 'String crumbs together without doubling back and your longest run shows up here. Daily play and strong-score streaks count too.'
  }
  if (game === 'stacker') {
    return 'Stack perfect drops in a row in-game and the board will show up here. Daily play and strong-score streaks count too.'
  }
  return `Play ${gameName} on consecutive days or string together strong scores to fill this book.`
}

type GameRecordsPanelProps = {
  game: string
  accent: string
  period: LeaderboardPeriod
  /** Sits in the label row, e.g. the period chips. */
  tools?: ReactNode
}

/**
 * Record books list for one game: the same soft rows as every other list,
 * with the record as the headline, its holder's mark beside it, and the
 * value on the right.
 */
export function GameRecordsPanel({ game, accent, period, tools }: GameRecordsPanelProps) {
  const gameMeta = getGame(game)
  const playerName = normalizePlayerName(usePlayerName())
  const groupId = useActiveGroup()
  const [records, setRecords] = useState<RecordSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const gameTitle = gameMeta?.name ?? game

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchGameRecords(game, period)
      .then((data) => {
        if (cancelled) return
        setRecords(data.records)
      })
      .catch((err) => {
        if (cancelled) return
        setRecords([])
        setError(err instanceof Error ? err.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [game, period, groupId])

  const held = records.filter((r) => r.top).length

  return (
    <section
      className="lst-block"
      aria-label="Game records"
      style={{ '--event-accent': accent } as CSSProperties}
    >
      <div className="lst-block__head">
        <h2 className="lst-block__title">Records</h2>
        {!loading && !error && records.length > 0 ? (
          <p className="lst-block__note">
            {held} of {records.length} held
          </p>
        ) : null}
        {tools ? <div className="lst-block__tools">{tools}</div> : null}
      </div>
      {loading ? (
        <BoardSkeleton rows={5} />
      ) : error ? (
        <BoardEmpty
          title="Couldn’t load records"
          detail="Check your connection and try again."
        />
      ) : records.length === 0 ? (
        <BoardEmpty
          title={groupBoardEmptyTitle('No records yet')}
          detail={groupId ? undefined : recordsEmptyDetail(game, gameTitle)}
        />
      ) : (
        <ol className="lst lst--records">
          {records.map((row) => {
            const holder = row.top ? normalizePlayerName(row.top.name) : ''
            const isYou = Boolean(playerName && holder === playerName)
            const href = recordHref(game, row.id, period)
            return (
              <li
                key={row.id}
                className={`lst__row${isYou ? ' lst__row--you' : ''}${holder ? '' : ' lst__row--empty'}`}
                aria-current={isYou ? 'true' : undefined}
              >
                <div className="lst__main lst__main--norank">
                  {holder ? (
                    <PlayerMark name={holder} avatarId={row.top?.avatarId} className="lst__mark" />
                  ) : (
                    <span className="pmark pmark--empty lst__mark" aria-hidden="true" />
                  )}
                  <span className="lst__text">
                    <a className="lst__name" href={href} title={row.label}>
                      <span className="lst__name-text">{row.label}</span>
                    </a>
                    {holder ? (
                      <a className="lst__sub lst__sub--link" href={rankHref(holder, period)}>
                        Held by {holder}
                        {isYou ? <span className="lst__you">You</span> : null}
                      </a>
                    ) : (
                      <span className="lst__sub">Nobody yet</span>
                    )}
                  </span>
                  <a className="lst__score lst__score--link" href={href}>
                    {row.top ? formatRecordScore(row.top.score, row.unit, row.id) : '—'}
                  </a>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
