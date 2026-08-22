import { ArcadeAttendant } from '../components/ArcadeAttendant'
import { GameGrid } from '../components/GameGrid'
import { PageShell } from '../components/PageShell'
import { ATTENDANT_ENABLED } from '../lib/attendant'

export function HomePage() {
  return (
    <>
      <PageShell variant="home">
        <GameGrid />
      </PageShell>
      {ATTENDANT_ENABLED ? <ArcadeAttendant /> : null}
    </>
  )
}
