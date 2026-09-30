import { testDriveDay } from '../games/hotlap/daily'
import { HotLapGame } from '../games/hotlap/HotLapGame'
import { useRoute } from '../hooks/useHashRoute'

/**
 * Hot Lap's page: today's track; or with ?track=<number or day> on the play page, a past track raced on its
 * own board (PastTrackCards.tsx). An admin may open any track that way, today's or one still to come, as a
 * test drive (TestCards.tsx): the Track Book links to those.
 */
export function HotLapPage() {
  const route = useRoute()
  const testDay = route.name === 'gamePlay' ? testDriveDay(route.track) : null
  return (
    <main className="game-page game-page--fullscreen">
      <HotLapGame testDay={testDay} />
    </main>
  )
}
