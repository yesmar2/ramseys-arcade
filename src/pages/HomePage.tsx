import { GameWall } from '../components/GameWall'
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
 * open now with what is true today in a rail beside it, then the wall of
 * every game. On a narrow screen the rail becomes a strip under the banner.
 */
export function HomePage() {
  return (
    <>
      <PageShell variant="home">
        <div className="home-rail">
          <div className="home-top">
            <HomeHero />
            <HomePulse />
          </div>
          <PendingInvitesStrip />
          <GameWall />
          <HomeSpotterStrip />
          <HomeYourEvents />
          <HomeIntro />
        </div>
      </PageShell>
      <InstallPrompt />
    </>
  )
}
