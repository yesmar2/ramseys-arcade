import { GameBoard } from '../components/GameBoard'
import { PageShell } from '../components/PageShell'
import { getGame, isDailyGame } from '../data/games'
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
 * with a `day`, it's that day's board as it finished.
 */
export function GameLeaderboardPage({ game: gameSlug, period: periodFromRoute, day }: GameLeaderboardPageProps) {
  const period = isDailyGame(gameSlug) ? (periodFromRoute ?? 'daily') : coerceVisiblePeriod(periodFromRoute ?? defaultPeriod())

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
