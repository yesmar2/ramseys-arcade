import { BoardsScoreboard } from '../components/BoardsScoreboard'
import { PageShell } from '../components/PageShell'
import { defaultPeriod } from '../lib/defaultPeriod'
import { coerceVisiblePeriod, type LeaderboardPeriod } from '../lib/leaderboard'

type LeaderboardsPageProps = {
  period?: LeaderboardPeriod
}

/** The boards page: the period's scoreboard, every board on it, and the standings across all of them. */
export function LeaderboardsPage({ period = defaultPeriod() }: LeaderboardsPageProps) {
  return (
    <PageShell innerClassName="lb-page__inner">
      <BoardsScoreboard period={coerceVisiblePeriod(period)} />
    </PageShell>
  )
}
