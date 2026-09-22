import { GameWall } from '../components/GameWall'
import { HomeBoards } from '../components/HomeBoards'
import { HomeYourEvents } from '../components/HomeYourEvents'
import { HomeHero } from '../components/HomeHero'
import { HomeOnNow } from '../components/HomeOnNow'
import { HomeSpotterStrip } from '../components/HomeSpotterStrip'
import { HomeIntro } from '../components/HomeIntro'
import { InstallPrompt } from '../components/InstallPrompt'
import { PageShell } from '../components/PageShell'
import { PendingInvitesStrip } from '../components/PendingInvitesStrip'

/**
 * The front door, at the width of the screen: a banner for the one game to
 * open now, what is on today (the daily, the weekly, last week's podium), the
 * wall of every game, and then the boards at a glance — standings, house
 * records and one game's record book.
 */
export function HomePage() {
  return (
    <>
      <PageShell variant="home">
        <div className="home-rail">
          <HomeHero />
          <PendingInvitesStrip />
          <HomeOnNow />
          <GameWall />
          <HomeBoards />
          <HomeSpotterStrip />
          <HomeYourEvents />
          <HomeIntro />
        </div>
      </PageShell>
      <InstallPrompt />
    </>
  )
}
