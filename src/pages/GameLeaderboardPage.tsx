import { useLayoutEffect } from 'react'
import { GameBoard } from '../components/GameBoard'
import { PageShell } from '../components/PageShell'
import { getGame, isDailyGame, isRankedGame } from '../data/games'
import { dailyTabHref, gameBoardHref, navigate } from '../hooks/useHashRoute'
import { boardPeriodFor } from '../lib/allTime'
import { defaultPeriod } from '../lib/defaultPeriod'
import { coerceVisiblePeriod, type LeaderboardGame, type LeaderboardPeriod } from '../lib/leaderboard'

type GameLeaderboardPageProps = {
  game: LeaderboardGame
  period?: LeaderboardPeriod
  /** A daily's board on this past day, YYYY-MM-DD. */
  day?: string
}

/**
 * A daily's board on one past day, as it finished (`/leaderboards/{game}/day/{day}`). A game's board for a
 * period is on its own page now, its Board tab or a daily's Today tab (Ramsey picked B of the "Game page: board
 * and records" canvas, 2026-10-12), so an old link to one (`/leaderboards/{game}/{period}`) goes there. A daily
 * just for fun has no board (data/games.ts Game.ranked): an old link to one goes to its page, or to that day's
 * row on its past days.
 */
export function GameLeaderboardPage({ game: gameSlug, period: periodFromRoute, day }: GameLeaderboardPageProps) {
  const period = isDailyGame(gameSlug)
    ? boardPeriodFor(gameSlug, periodFromRoute ?? 'daily')
    : coerceVisiblePeriod(periodFromRoute ?? defaultPeriod())
  const moved = !getGame(gameSlug)
    ? null
    : !isRankedGame(gameSlug)
      ? day
        ? dailyTabHref(gameSlug, 'past', day)
        : dailyTabHref(gameSlug, 'today')
      : day
        ? null
        : gameBoardHref(gameSlug, period)

  // Before the first paint, in place of the old address, so Back doesn't bounce here again.
  useLayoutEffect(() => {
    if (moved) navigate(moved, { replace: true })
  }, [moved])
  if (moved) return null

  if (!getGame(gameSlug) || !day) {
    return (
      <PageShell>
        <p className="lb-empty">That game isn’t on the board.</p>
      </PageShell>
    )
  }

  return (
    <PageShell innerClassName="lb-page__inner">
      <GameBoard slug={gameSlug} day={day} />
    </PageShell>
  )
}
