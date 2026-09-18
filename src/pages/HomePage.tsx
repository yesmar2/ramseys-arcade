import { GameWall } from '../components/GameWall'
import { HomeAboutBand } from '../components/HomeAboutBand'
import { HomeYourEvents } from '../components/HomeYourEvents'
import { HomeHero } from '../components/HomeHero'
import { HomePulse } from '../components/HomePulse'
import { HomeSpotterStrip } from '../components/HomeSpotterStrip'
import { HomeIntro } from '../components/HomeIntro'
import { InstallPrompt } from '../components/InstallPrompt'
import { PageShell } from '../components/PageShell'
import { PendingInvitesStrip } from '../components/PendingInvitesStrip'

/**
 * The front door, at the width of the screen: a banner for the one game to
 * open now, a strip of what is true today, then the wall of every game.
 */
export function HomePage() {
  return (
    <>
      <PageShell variant="home">
        <div className="home-rail">
          <HomeHero />
          <HomePulse />
          <PendingInvitesStrip />
          <GameWall />
          <HomeSpotterStrip />
          <HomeYourEvents />
          <HomeIntro />
          <HomeAboutBand />
        </div>
      </PageShell>
      <InstallPrompt />
    </>
  )
}
