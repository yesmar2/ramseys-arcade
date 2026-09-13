import { ArcadeAttendant } from '../components/ArcadeAttendant'
import { GameGrid } from '../components/GameGrid'
import { HomeAboutBand } from '../components/HomeAboutBand'
import { HomeEventsStrip } from '../components/HomeEventsStrip'
import { HomePlayBand } from '../components/HomePlayBand'
import { HomeSpotterStrip } from '../components/HomeSpotterStrip'
import { HomeYou } from '../components/HomeYou'
import { InstallPrompt } from '../components/InstallPrompt'
import { PageShell } from '../components/PageShell'
import { ATTENDANT_ENABLED } from '../lib/attendant'

export function HomePage() {
  return (
    <>
      <PageShell variant="home">
        <div className="home-rail">
          <HomePlayBand />
          <HomeEventsStrip />
          <HomeSpotterStrip />
          <GameGrid />
          <HomeYou />
          <HomeAboutBand />
        </div>
      </PageShell>
      <InstallPrompt />
      {ATTENDANT_ENABLED ? <ArcadeAttendant /> : null}
    </>
  )
}
