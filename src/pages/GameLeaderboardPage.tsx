import { useLayoutEffect } from 'react'
import { GameBoard } from '../components/GameBoard'
import { PageShell } from '../components/PageShell'
import { getGame, isDailyGame, isRankedGame } from '../data/games'
import { dailyTabHref, navigate } from '../hooks/useHashRoute'
import { defaultPeriod } from '../lib/defaultPeriod'
import { coerceVisiblePeriod, type LeaderboardGame, type LeaderboardPeriod } from '../lib/leaderboard'

type GameLeaderboardPageProps = {
  game: LeaderboardGame
  period?: LeaderboardPeriod
  /** A daily's board on this past day, YYYY-MM-DD. */
  day?: string
}

/**
 * One game's own board: its players at their best runs, and what each place pays. A daily's opens on
 * today's, and its week, month and all time are its day points (leaderboardFormat isDayPointsBoard);
 * with a `day`, it's that day's board as it finished. A daily just for fun has no board (data/games.ts
 * Game.ranked): an old link to one goes to its page, or to that day's row on its past days.
 */
export function GameLeaderboardPage({ game: gameSlug, period: periodFromRoute, day }: GameLeaderboardPageProps) {
  const period = isDailyGame(gameSlug) ? (periodFromRoute ?? 'daily') : coerceVisiblePeriod(periodFromRoute ?? defaultPeriod())
  const moved = getGame(gameSlug) && !isRankedGame(gameSlug) ? (day ? dailyTabHref(gameSlug, 'past', day) : dailyTabHref(gameSlug, 'today')) : null

  // Before the first paint, in place of the old address, so Back doesn't bounce here again.
  useLayoutEffect(() => {
    if (moved) navigate(moved, { replace: true })
  }, [moved])
  if (moved) return null

  if (!getGame(gameSlug)) {
    return (
      <PageShell>
        <p className="lb-empty">That game isn’t on the board.</p>
      </PageShell>
    )
  }

  return (
    <PageShell innerClassName="lb-page__inner">
      <GameBoard slug={gameSlug} period={period} day={isDailyGame(gameSlug) ? day : undefined} />
    </PageShell>
  )
}
