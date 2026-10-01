import { useLayoutEffect } from 'react'
import { PageShell } from '../components/PageShell'
import { RecordBookView } from '../components/RecordBookView'
import { RecordView } from '../components/RecordView'
import { getGame, isRankedGame } from '../data/games'
import { dailyTabHref, dayBoardHref, navigate } from '../hooks/useHashRoute'
import { coerceVisiblePeriod, type LeaderboardPeriod } from '../lib/leaderboard'
import { courseKey, courseNumber, courseToday, dailyRecordHref } from '../lib/recordBook'

type RecordsPageProps = {
  game: string
  recordId?: string
  period?: LeaderboardPeriod
}

/**
 * A past day's own record of Find the Bug or Half Full (day-N, pour-N) was that day's first results, best
 * first: the day's final board, so an old link to one opens that day's board. Null for any other record.
 */
function dayRecordBoardHref(game: string, recordId: string | undefined, now = Date.now()): string | null {
  if (game !== 'findbug' && game !== 'halffull') return null
  const n = recordId ? courseNumber({ id: recordId }) : null
  const today = courseToday(game, now)
  if (n == null || today == null || n >= today) return null
  const day = courseKey(game, n)
  return typeof day === 'string' ? dayBoardHref(game, day) : null
}

/**
 * A game's record book (`/records/{game}`), or one record in it (`…/{id}/{period}`). A daily has no book
 * of its own: its records are on its page's Records tab, a track's or hole's on that course's row of its
 * past tab, and a past day's of Find the Bug or Half Full on that day's board, so an old link to any of
 * them goes there, in place of this address.
 */
export function RecordsPage({ game, recordId, period = 'all' }: RecordsPageProps) {
  // A daily just for fun keeps no records (data/games.ts Game.ranked): an old link to one goes to its page.
  const moved = !getGame(game)
    ? null
    : !isRankedGame(game)
      ? dailyTabHref(game, 'today')
      : (dayRecordBoardHref(game, recordId) ?? dailyRecordHref(game, recordId))

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
