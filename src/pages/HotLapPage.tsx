import { testDriveDay } from '../games/hotlap/daily'
import { HotLapGame } from '../games/hotlap/HotLapGame'
import { useRoute } from '../hooks/useHashRoute'

/**
 * Hot Lap's page: today's track; or with ?track=<number or day> on the play page, a test drive of any
 * track in the plan, ahead of its day (see TestCards.tsx). The Track Book links to those.
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
