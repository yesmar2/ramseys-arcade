import { ArcadeAttendant } from '../components/ArcadeAttendant'
import { GameGrid } from '../components/GameGrid'
import { HomeAboutBand } from '../components/HomeAboutBand'
import { HomeOfficialEvents } from '../components/HomeOfficialEvents'
import { HomeYourEvents } from '../components/HomeYourEvents'
import { HomeHero } from '../components/HomeHero'
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
          <div className="home-top">
            <HomeHero />
            <HomeOfficialEvents />
          </div>
          <GameGrid />
          <HomeSpotterStrip />
          <HomeYourEvents />
          <HomeYou />
          <HomeAboutBand />
        </div>
      </PageShell>
      <InstallPrompt />
      {ATTENDANT_ENABLED ? <ArcadeAttendant /> : null}
    </>
  )
}
