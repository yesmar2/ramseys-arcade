import type { CSSProperties } from 'react'
import { getGame } from '../data/games'
import { gamePlayHref } from '../hooks/useHashRoute'
import { buildDailyPuzzle } from '../games/spotter/puzzle'
import { spotterDayKey } from '../games/spotter/dayKey'
import { isSpotterSolvedToday } from '../games/spotter/storage'
import { GameThumbArt } from './GameThumbArt'

/** Daily Spotter teaser above the home game grid. */
export function HomeSpotterStrip() {
  const game = getGame('spotter')
  if (!game) return null

  const puzzle = buildDailyPuzzle(spotterDayKey())
  const solved = isSpotterSolvedToday()
  const variant =
    puzzle.variant === 'poster'
      ? 'Poster wall'
      : puzzle.variant === 'cabinet'
        ? 'Cabinet row'
        : 'Leaderboard'

  return (
    <section className="home-spotter" aria-label="Today's Spotter hunt">
      <a className="home-spotter__card" href={gamePlayHref('spotter')}>
        <span className="home-spotter__thumb" style={{ '--thumb-accent': game.accent } as CSSProperties}>
          <GameThumbArt slug="spotter" accent={game.accent} />
        </span>
        <span className="home-spotter__body">
          <span className="home-spotter__chips">
            <span className="home-spotter__chip home-spotter__chip--live">Daily</span>
            {solved ? (
              <span className="home-spotter__chip home-spotter__chip--done">Found</span>
            ) : (
              <span className="home-spotter__chip">Spotter</span>
            )}
          </span>
          <span className="home-spotter__title">
            Spotter #{puzzle.huntNumber} · {variant}
          </span>
          <span className="home-spotter__meta">
            {solved ? 'Practice again anytime' : 'Find the wrong tile — new hunt today'}
          </span>
        </span>
      </a>
    </section>
  )
}
