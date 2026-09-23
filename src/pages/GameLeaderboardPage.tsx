import { GameBoard } from '../components/GameBoard'
import { PageShell } from '../components/PageShell'
import { getGame } from '../data/games'
import { defaultPeriod } from '../lib/defaultPeriod'
import { coerceVisiblePeriod, type LeaderboardGame, type LeaderboardPeriod } from '../lib/leaderboard'

type GameLeaderboardPageProps = {
  game: LeaderboardGame
  period?: LeaderboardPeriod
}

/** One game's own board: its players at their best runs, and what each place pays. */
export function GameLeaderboardPage({ game: gameSlug, period: periodFromRoute }: GameLeaderboardPageProps) {
  const period = coerceVisiblePeriod(periodFromRoute ?? defaultPeriod())

  if (!getGame(gameSlug)) {
    return (
      <PageShell>
        <p className="lb-empty">That game isn’t on the board.</p>
      </PageShell>
    )
  }

  return (
    <PageShell innerClassName="lb-page__inner">
      <GameBoard slug={gameSlug} period={period} />
    </PageShell>
  )
}
