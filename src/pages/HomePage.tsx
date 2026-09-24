import { GameWall } from '../components/GameWall'
import { HomeBoards } from '../components/HomeBoards'
import { HomeGroupsBand } from '../components/HomeGroupsBand'
import { HomeHero } from '../components/HomeHero'
import { HomeOnNow } from '../components/HomeOnNow'
import { HomeSpotterStrip } from '../components/HomeSpotterStrip'
import { InstallPrompt } from '../components/InstallPrompt'
import { PageShell } from '../components/PageShell'
import { PendingInvitesStrip } from '../components/PendingInvitesStrip'
import { BugHuntStrip } from '../components/BugHunt'

/**
 * The front door, at the width of the screen: a banner for the one game to
 * open now (or, on a first visit, for what the arcade is), what is on today
 * (the daily, the weekly, last week's podium), the wall of every game as a
 * cabinet, the boards at a glance — standings, house records and one game's
 * record book — and a way to a board of your own: groups and events.
 */
export function HomePage() {
  return (
    <>
      <PageShell variant="home">
        <div className="home-rail">
          <HomeHero />
          <BugHuntStrip />
          <PendingInvitesStrip />
          <HomeOnNow />
          <GameWall />
          <HomeBoards />
          <HomeSpotterStrip />
          <HomeGroupsBand />
        </div>
      </PageShell>
      <InstallPrompt />
    </>
  )
}
