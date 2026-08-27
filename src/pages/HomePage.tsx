import { ArcadeAttendant } from '../components/ArcadeAttendant'
import { GameGrid } from '../components/GameGrid'
import { HomeEventsStrip } from '../components/HomeEventsStrip'
import { InstallPrompt } from '../components/InstallPrompt'
import { PageShell } from '../components/PageShell'
import { ATTENDANT_ENABLED } from '../lib/attendant'

export function HomePage() {
  return (
    <>
      <PageShell variant="home">
        <div className="home-rail">
          <HomeEventsStrip />
          <GameGrid />
        </div>
      </PageShell>
      <InstallPrompt />
      {ATTENDANT_ENABLED ? <ArcadeAttendant /> : null}
    </>
  )
}
