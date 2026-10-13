import { useLayoutEffect } from 'react'
import { GameBoard } from '../components/GameBoard'
import { PageShell } from '../components/PageShell'
import { isDailyGame, isRankedGame } from '../data/games'
import { boardPlaceHref, dailyTabHref, navigate } from '../hooks/useHashRoute'
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
 * and records" canvas, 2026-10-11), so an old link to one (`/leaderboards/{game}/{period}`) goes there. A daily
 * just for fun has no board (data/games.ts Game.ranked): an old link to one goes to its page, or to that day's
 * row on its past days.
 */
export function GameLeaderboardPage({ game: gameSlug, period: periodFromRoute, day }: GameLeaderboardPageProps) {
  const period = isDailyGame(gameSlug)
    ? boardPeriodFor(gameSlug, periodFromRoute ?? 'daily')
    : coerceVisiblePeriod(periodFromRoute ?? defaultPeriod())
  // A game the site doesn't have, or has retired, never gets here (useHashRoute goneGameRoute): every board here
  // is a game's, and one with no day goes on to its page.
  const moved = !isRankedGame(gameSlug)
    ? day
      ? dailyTabHref(gameSlug, 'past', day)
      : dailyTabHref(gameSlug, 'today')
    : day
      ? null
      : boardPlaceHref(gameSlug, period)

  // Before the first paint, in place of the old address, so Back doesn't bounce here again.
  useLayoutEffect(() => {
    if (moved) navigate(moved, { replace: true })
  }, [moved])
  if (moved || !day) return null

  return (
    <PageShell innerClassName="lb-page__inner">
      <GameBoard slug={gameSlug} day={day} />
    </PageShell>
  )
}
