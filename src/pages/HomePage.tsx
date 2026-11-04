import { Suspense, type ReactElement } from 'react'
import { BugHuntStrip } from '../components/BugHunt'
import { GameWall } from '../components/GameWall'
import { HomeStandings } from '../components/HomeBoards'
import { HomeGroupsBand } from '../components/HomeGroupsBand'
import { HomeHero } from '../components/HomeHero'
import { HomeSeasonCard } from '../components/HomeSeasonCard'
import { HomeRacesSkeleton } from '../components/HomeTodaySkeleton'
import { InstallPrompt } from '../components/InstallPrompt'
import { PageShell } from '../components/PageShell'
import { PendingInvitesStrip } from '../components/PendingInvitesStrip'
import { PartErrorBoundary } from '../components/SiteErrorBoundary'
import { usePlayerName } from '../hooks/usePlayerName'
import { APP_NAME } from '../lib/brand'
import { useRecentGames } from '../lib/lastPlayed'
import { lazyPage } from '../lib/lazyPage'
import { normalizePlayerName } from '../lib/leaderboard'
import '../styles/homeToday.css'
import '../styles/homeSimple.css'

/**
 * Today's races (HomeToday.tsx HomeRaces), in a chunk of their own with the dailies' plans. They're asked for as
 * soon as the home page's own code is, not once the page has drawn, and until they come the row holds its place as
 * a skeleton of itself (its styles are here, not in its chunk, so the skeleton has them).
 */
const HomeRaces = lazyPage(() => import('../components/HomeToday').then((m) => m.HomeRaces))
void HomeRaces.preload()

type Part = 'races' | 'season' | 'standings' | 'wall' | 'hunt' | 'groups'

/*
 * 2 on the "Home: one games grid" canvas, with S1's Standings (Ramsey, 2026-11-04: "i like 2", then "s1"; a player
 * had told him the site was too busy). Today's races and the games, yours first, down the page; beside them a rail
 * with the season, the Standings, the bug hunt and groups and events. Up next, On now, the house records and the
 * record book went: the games are the page. Narrower, it's one column in this order: the races, the season and the
 * Standings, the games, then the bug hunt and groups. The same parts at every width, the columns folding into one
 * (homeSimple.css), so nothing starts again when the window crosses over.
 *
 * A first visit (no tag, nothing played on this device) gets the welcome first, what the arcade is.
 */
const MAIN: Part[] = ['races', 'wall']
const RAIL: Part[] = ['season', 'standings', 'hunt', 'groups']

/**
 * The front door: today's races, every game as a cabinet with yours first, and beside them the season, where you
 * stand, the day's bug hunt, and a way to a board of your own: groups and events.
 */
export function HomePage() {
  const name = normalizePlayerName(usePlayerName())
  const recent = useRecentGames()
  const firstVisit = !name && recent.length === 0
  const parts: Record<Part, ReactElement> = {
    races: (
      // A row that fails to come keeps its skeleton, Open Dailies and all, and the rest of the page stays.
      <PartErrorBoundary key="races" fallback={<HomeRacesSkeleton />}>
        <Suspense fallback={<HomeRacesSkeleton />}>
          <HomeRaces />
        </Suspense>
      </PartErrorBoundary>
    ),
    wall: <GameWall key="wall" simple />,
    season: <HomeSeasonCard key="season" />,
    standings: <HomeStandings key="standings" />,
    hunt: <BugHuntStrip key="hunt" compact />,
    groups: <HomeGroupsBand key="groups" compact />,
  }
  const part = (p: Part) => (
    <div key={p} className={`home-simple__part home-simple__part--${p}`}>
      {parts[p]}
    </div>
  )
  return (
    <>
      <PageShell variant="home" innerClassName="home-rail home-simple">
        {/* The page's heading, for a screen reader: each part has its own h2, and the site's name heads them. */}
        <h1 className="visually-hidden">{APP_NAME}</h1>
        {firstVisit ? <HomeHero /> : null}
        <PendingInvitesStrip />
        <div className="home-simple__grid">
          <div className="home-simple__main">{MAIN.map(part)}</div>
          <aside className="home-simple__side" aria-label="Your season and standings">
            {RAIL.map(part)}
          </aside>
        </div>
      </PageShell>
      <InstallPrompt />
    </>
  )
}
