import { useEffect, useState, type CSSProperties } from 'react'
import {
  BoardEmpty,
  BoardSkeleton,
} from './BoardChrome'
import { getGame } from '../data/games'
import { recordHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { normalizePlayerName } from '../lib/leaderboard'
import {
  fetchGameRecords,
  formatRecordScore,
  type RecordSummary,
} from '../lib/records'

function recordsEmptyDetail(game: string, gameName: string) {
  if (game === 'snake') {
    return 'Reach length milestones in-game and times will show up here.'
  }
  if (game === 'asteroids') {
    return 'Clear a wave in-game and the board will show up here.'
  }
  if (game === 'patriot') {
    return 'Land consecutive perfect hits in-game and the board will show up here.'
  }
  return `Set a record in ${gameName} to populate this page.`
}

type GameRecordsPanelProps = {
  game: string
  accent: string
}

/** Record books list for one game (`#/records/{game}` and hub tab). */
export function GameRecordsPanel({ game, accent }: GameRecordsPanelProps) {
  const gameMeta = getGame(game)
  const playerName = normalizePlayerName(usePlayerName())
  const [records, setRecords] = useState<RecordSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const gameTitle = gameMeta?.name ?? game

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchGameRecords(game)
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
  }, [game])

  return (
    <section className="lb-board" aria-label="Game records">
      {loading ? (
        <BoardSkeleton rows={5} />
      ) : error ? (
        <BoardEmpty
          title="Couldn’t load records"
          detail="Check your connection and try again."
        />
      ) : records.length === 0 ? (
        <BoardEmpty
          title="No records yet"
          detail={recordsEmptyDetail(game, gameTitle)}
        />
      ) : (
        <ol className="records-leaders">
          {records.map((row) => {
            const holder = row.top ? normalizePlayerName(row.top.name) : ''
            const isYou = Boolean(playerName && holder === playerName)
            return (
              <li key={row.id}>
                <a
                  className={`records-leaders__row${isYou ? ' records-leaders__row--you' : ''}`}
                  href={recordHref(game, row.id)}
                  style={{ '--tab-accent': accent } as CSSProperties}
                >
                  <span className="records-leaders__label">{row.label}</span>
                  <span className="records-leaders__holder" title={holder}>
                    <span className="records-leaders__name">
                      {holder || '—'}
                    </span>
                    {isYou ? (
                      <span className="lb-row__you-tag">You</span>
                    ) : null}
                  </span>
                  <span className="records-leaders__time">
                    {row.top
                      ? formatRecordScore(row.top.score, row.unit)
                      : '—'}
                  </span>
                </a>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
