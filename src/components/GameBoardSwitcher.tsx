import type { CSSProperties } from 'react'
import { gameBoardHref, recordsHref } from '../hooks/useHashRoute'
import { gameHasRecords } from '../lib/records'
import type { LeaderboardGame, LeaderboardPeriod } from '../lib/leaderboard'

type GameBoardSwitcherProps = {
  slug: string
  accent: string
  active: 'scores' | 'records'
  /** Override Scores destination (defaults to the game leaderboard page). */
  scoresHref?: string
  scoresPeriod?: LeaderboardPeriod
}

/** Peer destinations: Scores board vs Record books (only when the game has records). */
export function GameBoardSwitcher({
  slug,
  accent,
  active,
  scoresHref,
  scoresPeriod = 'daily',
}: GameBoardSwitcherProps) {
  if (!gameHasRecords(slug)) return null

  const scoresLink =
    scoresHref ?? gameBoardHref(slug as LeaderboardGame, scoresPeriod)
  const recordsLink = recordsHref(slug)

  return (
    <nav
      className="lb-board-switcher"
      aria-label="Board type"
      style={{ '--board-accent': accent } as CSSProperties}
    >
      {active === 'scores' ? (
        <span className="lb-board-switcher__item lb-board-switcher__item--active" aria-current="page">
          Scores
        </span>
      ) : (
        <a className="lb-board-switcher__item" href={scoresLink}>
          Scores
        </a>
      )}
      <span className="lb-board-switcher__sep" aria-hidden="true">
        |
      </span>
      {active === 'records' ? (
        <span className="lb-board-switcher__item lb-board-switcher__item--active" aria-current="page">
          Record books
        </span>
      ) : (
        <a className="lb-board-switcher__item" href={recordsLink}>
          Record books
        </a>
      )}
    </nav>
  )
}
