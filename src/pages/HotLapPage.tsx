import { ArchiveGate } from '../components/archive/ArchiveGate'
import { testDriveDay, trackNumber } from '../games/hotlap/daily'
import { HotLapGame } from '../games/hotlap/HotLapGame'
import { useRoute } from '../hooks/useHashRoute'

/**
 * Hot Lap's page: today's track; or with ?track=<number or day> on the play page, a past track raced on its
 * own board (PastTrackCards.tsx). An admin may open any track that way, today's or one still to come, as a
 * test drive (TestCards.tsx): the Track Book links to those. A past track older than a week is Plus's
 * (components/archive/ArchiveGate.tsx).
 */
export function HotLapPage() {
  const route = useRoute()
  const testDay = route.name === 'gamePlay' ? testDriveDay(route.track) : null
  // ?test=1: an admin's test drive on a past track too, rather than its practice (Set platinum).
  const forced = route.name === 'gamePlay' && route.test === true
  return (
    <main className="game-page game-page--fullscreen">
      <ArchiveGate slug="hotlap" day={forced ? null : testDay} course={testDay && !forced ? trackNumber(testDay) : undefined}>
        <HotLapGame testDay={testDay} forceTest={forced} />
      </ArchiveGate>
    </main>
  )
}
