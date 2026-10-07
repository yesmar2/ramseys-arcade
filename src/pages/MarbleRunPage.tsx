import { ArchiveGate } from '../components/archive/ArchiveGate'
import { courseDay, FIRST_DAY, testRunDay } from '../games/marblerun/daily'
import { MarbleRunGame } from '../games/marblerun/MarbleRunGame'
import { useRoute } from '../hooks/useHashRoute'

const isDay = (day: string | undefined): day is string => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)

/**
 * Marble Run's page: today's course. With ?day=YYYY-MM-DD, a past day's from the Past tab, rolled again as
 * practice, where nothing is kept; or today's or one still to come, from the admin's Course Book, as an
 * admin's test run (MarbleRunGame sends anyone else to today's). A day before the first isn't shown, and
 * one older than a week is Plus's (components/archive/ArchiveGate.tsx). With ?lab=1, the test track, an
 * admin's: every new kind of piece in one course (sim.ts labCourse).
 */
export function MarbleRunPage() {
  const route = useRoute()
  const asked = route.name === 'gamePlay' ? route.day : undefined
  const day = isDay(asked) && asked >= FIRST_DAY && asked < courseDay() ? asked : null
  const test = testRunDay(asked)
  const lab = !day && !test && route.name === 'gamePlay' && route.lab === true
  return (
    <main className="game-page game-page--fullscreen">
      <ArchiveGate slug="marblerun" day={day}>
        <MarbleRunGame key={day ?? 'today'} practiceDay={day} testDay={test} lab={lab} />
      </ArchiveGate>
    </main>
  )
}
