import { ArchiveGate } from '../components/archive/ArchiveGate'
import { FIRST_DAY, gauntletDay, testRunDay, trackDay } from '../games/wobblerun/daily'
import { WobbleRunGame } from '../games/wobblerun/WobbleRunGame'
import { useRoute } from '../hooks/useHashRoute'

const isDay = (day: string | undefined): day is string => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)

/**
 * Wobble Run's page: today's gauntlet. With ?day=YYYY-MM-DD, a past day's from the Past tab, run again onto its
 * All time board; or today's or one still to come, from the admin's Gauntlet Book, as an admin's test run
 * (WobbleRunGame sends anyone else to today's). ?track=<n> names a gauntlet by its number the same way, as the
 * Gauntlet Book links them. A day before the first isn't shown, and one older than a week is Plus's
 * (components/archive/ArchiveGate.tsx).
 */
export function WobbleRunPage() {
  const route = useRoute()
  const asked = route.name === 'gamePlay' ? (route.day ?? trackDay(route.track)) : undefined
  const day = isDay(asked) && asked >= FIRST_DAY && asked < gauntletDay() ? asked : null
  const test = testRunDay(asked)
  // ?lab=1: the test course, every round at every tier, an admin's (runs.ts LAB_DAY).
  const lab = !day && !test && route.name === 'gamePlay' && route.lab === true
  return (
    <main className="game-page game-page--fullscreen">
      <ArchiveGate slug="wobblerun" day={day}>
        {/* Keyed by the day only: WobbleRunGame keys the test course and a test run itself, so the gauntlet a
            non-admin is sent to from ?lab=1 stays mounted through the redirect, with its word about why. */}
        <WobbleRunGame key={day ?? 'today'} practiceDay={day} testDay={test} lab={lab} />
      </ArchiveGate>
    </main>
  )
}
