import { PageShell } from '../components/PageShell'
import { RecordBookView } from '../components/RecordBookView'
import { RecordView } from '../components/RecordView'
import { getGame } from '../data/games'
import { coerceVisiblePeriod, type LeaderboardPeriod } from '../lib/leaderboard'

type RecordsPageProps = {
  game: string
  recordId?: string
  period?: LeaderboardPeriod
}

/** A game's record book (`/records/{game}`), or one record in it (`…/{id}/{period}`). */
export function RecordsPage({ game, recordId, period = 'all' }: RecordsPageProps) {
  if (!getGame(game)) {
    return (
      <PageShell>
        <p className="lb-empty">That game isn’t on the board.</p>
      </PageShell>
    )
  }

  return (
    <PageShell innerClassName="lb-page__inner">
      {recordId ? (
        <RecordView game={game} recordId={recordId} period={coerceVisiblePeriod(period)} />
      ) : (
        <RecordBookView game={game} period={coerceVisiblePeriod(period)} />
      )}
    </PageShell>
  )
}
