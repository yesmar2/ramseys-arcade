import { useMemo, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { gameBoardHref } from '../hooks/useHashRoute'
import {
  VISIBLE_LEADERBOARD_GAMES,
  type GameBoardPreview,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { GameThumbArt } from './GameThumbArt'
import { TopScorePodium } from './TopScorePodium'

type BoardsGameIndexProps = {
  games: GameBoardPreview[]
  loading?: boolean
  playerName?: string
  period: LeaderboardPeriod
}

export function BoardsGameIndex({
  games,
  loading,
  playerName = '',
  period,
}: BoardsGameIndexProps) {
  const sorted = useMemo(
    () =>
      [...games].sort((a, b) => {
        const nameA = getGame(a.slug)?.name ?? a.slug
        const nameB = getGame(b.slug)?.name ?? b.slug
        return nameA.localeCompare(nameB)
      }),
    [games],
  )

  if (loading) {
    return (
      <div className="lb-boards-index" aria-busy="true">
        {VISIBLE_LEADERBOARD_GAMES.map((slug) => (
          <article
            key={slug}
            className="lb-boards-index__game lb-boards-index__game--skeleton"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="lb-boards-index">
      {sorted.map(({ slug, entries }) => {
        const game = getGame(slug)
        if (!game || game.hidden) return null
        const boardHref = gameBoardHref(slug, period)
        return (
          <article
            key={slug}
            className="lb-boards-index__game"
            style={{ '--tab-accent': game.accent } as CSSProperties}
          >
            <header className="lb-boards-index__head">
              <a className="lb-boards-index__game-link" href={boardHref}>
                <GameThumbArt slug={slug} accent={game.accent} />
                <span className="lb-boards-index__game-name">{game.name}</span>
              </a>
              <a className="lb-boards-index__board-link" href={boardHref}>
                Full board
              </a>
            </header>
            <div className="lb-boards-index__podium">
              <TopScorePodium
                entries={entries}
                playerName={playerName}
                accent={game.accent}
                slug={slug}
              />
            </div>
          </article>
        )
      })}
    </div>
  )
}
