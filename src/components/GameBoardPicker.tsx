import { useMemo, useState, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { leaderboardHref } from '../hooks/useHashRoute'
import { GameThumbArt } from './GameThumbArt'
import { LEADERBOARD_GAMES, type LeaderboardGame } from '../lib/leaderboard'

export type GameBoardSummary = {
  slug: LeaderboardGame
  top: { name: string; score: number } | null
  you: { rank: number; score: number } | null
}

type GameBoardPickerProps = {
  summaries: GameBoardSummary[]
  loading?: boolean
  activeSlug?: LeaderboardGame
}

export function GameBoardPicker({
  summaries,
  loading,
  activeSlug,
}: GameBoardPickerProps) {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()

  const rows = useMemo(() => {
    const sorted = [...summaries].sort((a, b) => {
      const nameA = getGame(a.slug)?.name ?? a.slug
      const nameB = getGame(b.slug)?.name ?? b.slug
      return nameA.localeCompare(nameB)
    })
    if (!normalizedQuery) return sorted
    return sorted.filter((row) => {
      const game = getGame(row.slug)
      const haystack = `${game?.name ?? ''} ${row.slug}`.toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [summaries, normalizedQuery])

  return (
    <section className="lb-picker" aria-labelledby="lb-picker-heading">
      <div className="lb-picker__head">
        <h2 id="lb-picker-heading" className="lb-picker__title">
          Game boards
        </h2>
        <label className="lb-picker__search">
          <span className="visually-hidden">Search games</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search games…"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
      </div>

      {loading ? (
        <ul className="lb-picker__list" aria-busy="true">
          {LEADERBOARD_GAMES.map((slug) => (
            <li key={slug} className="lb-picker__row lb-picker__row--skeleton" />
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <p className="lb-picker__empty">No games match “{query.trim()}”.</p>
      ) : (
        <ul className="lb-picker__list">
          {rows.map((row) => {
            const game = getGame(row.slug)
            if (!game) return null
            const active = row.slug === activeSlug
            const topName = row.top?.name ?? '—'
            const topScore = row.top?.score ?? 0
            return (
              <li key={row.slug}>
                <a
                  className={`lb-picker__row${active ? ' lb-picker__row--active' : ''}`}
                  href={leaderboardHref(row.slug, 'daily')}
                  style={{ '--tab-accent': game.accent } as CSSProperties}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="lb-picker__art" aria-hidden="true">
                    <GameThumbArt slug={row.slug} accent={game.accent} />
                  </span>
                  <span className="lb-picker__main">
                    <span className="lb-picker__name">{game.name}</span>
                    {row.you ? (
                      <span className="lb-picker__you">
                        You · #{row.you.rank} · {row.you.score}
                      </span>
                    ) : (
                      <span className="lb-picker__you lb-picker__you--empty">
                        Play to rank
                      </span>
                    )}
                  </span>
                  <span className="lb-picker__top">
                    <span className="lb-picker__top-label">Top</span>
                    <strong className="lb-picker__top-score">
                      {topScore > 0 ? topScore : '—'}
                    </strong>
                    <span className="lb-picker__top-name" title={topName}>
                      {topScore > 0 ? topName : 'Open'}
                    </span>
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
