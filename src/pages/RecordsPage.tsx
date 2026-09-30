import { useLayoutEffect } from 'react'
import { PageShell } from '../components/PageShell'
import { RecordBookView } from '../components/RecordBookView'
import { RecordView } from '../components/RecordView'
import { getGame } from '../data/games'
import { navigate } from '../hooks/useHashRoute'
import { coerceVisiblePeriod, type LeaderboardPeriod } from '../lib/leaderboard'
import { dailyRecordHref } from '../lib/recordBook'

type RecordsPageProps = {
  game: string
  recordId?: string
  period?: LeaderboardPeriod
}

/**
 * A game's record book (`/records/{game}`), or one record in it (`…/{id}/{period}`). A daily has no book
 * of its own: its records are on its page's Records tab, and a track's, hole's or day's on that course's
 * row of its past tab, so an old link to either goes there, in place of this address.
 */
export function RecordsPage({ game, recordId, period = 'all' }: RecordsPageProps) {
  const moved = getGame(game) ? dailyRecordHref(game, recordId) : null

  // Before the first paint, so the book never shows on its way to the tab; in place of the old address, so
  // Back doesn't bounce here again. A course's row keeps its #course- part.
  useLayoutEffect(() => {
    if (moved) navigate(moved, { replace: true })
  }, [moved])

  if (!getGame(game)) {
    return (
      <PageShell>
        <p className="lb-empty">That game isn’t on the board.</p>
      </PageShell>
    )
  }
  if (moved) return null

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
