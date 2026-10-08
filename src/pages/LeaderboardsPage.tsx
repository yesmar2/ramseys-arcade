import { BoardsScoreboard, SeasonScoreboard } from '../components/BoardsScoreboard'
import { PageShell } from '../components/PageShell'
import { defaultPeriod } from '../lib/defaultPeriod'
import { coerceVisiblePeriod, type LeaderboardPeriod } from '../lib/leaderboard'

type LeaderboardsPageProps = {
  period?: LeaderboardPeriod
  /** The Season tab: the season's standings. */
  season?: boolean
}

/** The boards page: the period's scoreboard, every board on it, and the standings across all of them. */
export function LeaderboardsPage({ period = defaultPeriod(), season = false }: LeaderboardsPageProps) {
  return (
    <PageShell innerClassName="lb-page__inner">
      {season ? <SeasonScoreboard /> : <BoardsScoreboard period={coerceVisiblePeriod(period)} />}
    </PageShell>
  )
}
