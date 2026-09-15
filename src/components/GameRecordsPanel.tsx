import { useEffect, useState } from 'react'
import { BoardEmpty, BoardSkeleton } from './BoardChrome'
import { getGame } from '../data/games'
import { rankHref, recordHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { groupBoardEmptyTitle, useActiveGroup } from '../lib/groups'
import { normalizePlayerName, PERIOD_LABELS, type LeaderboardPeriod } from '../lib/leaderboard'
import {
  fetchGameRecords,
  formatRecordScore,
  type RecordSummary,
} from '../lib/records'

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
}

/** Record books list for one game (`#/records/{game}` and hub tab). */
export function GameRecordsPanel({ game, accent, period }: GameRecordsPanelProps) {
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
      className="ev-card rbl"
      aria-label="Game records"
      style={{ '--event-accent': accent } as React.CSSProperties}
    >
      <div className="ev-card__head">
        <h2 className="ev-card__title">Records</h2>
        {!loading && !error && records.length > 0 ? (
          <p className="ev-card__note">
            {PERIOD_LABELS[period]} · {held} of {records.length} held
          </p>
        ) : null}
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
        <ol className="rbl__list">
          {records.map((row) => {
            const holder = row.top ? normalizePlayerName(row.top.name) : ''
            const isYou = Boolean(playerName && holder === playerName)
            const href = recordHref(game, row.id, period)
            return (
              <li
                key={row.id}
                className={`rbl__row${isYou ? ' rbl__row--you' : ''}${holder ? '' : ' rbl__row--open'}`}
              >
                <a className="rbl__label" href={href}>
                  {row.label}
                </a>
                {holder ? (
                  <a className="rbl__holder" href={rankHref(holder, period)} title={holder}>
                    <span className="rbl__name">{holder}</span>
                    {isYou ? <span className="ev-row__you-tag">You</span> : null}
                  </a>
                ) : (
                  <span className="rbl__holder rbl__holder--open">Open</span>
                )}
                <a className="rbl__val" href={href}>
                  {row.top ? formatRecordScore(row.top.score, row.unit, row.id) : '—'}
                </a>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
