import { Suspense, useEffect, useState, type ReactElement } from 'react'
import { GameWall } from '../components/GameWall'
import { HomeBoards } from '../components/HomeBoards'
import { HomeGroupsBand } from '../components/HomeGroupsBand'
import { HomeHero } from '../components/HomeHero'
import { HomeOnNow } from '../components/HomeOnNow'
import { HomeSpotterStrip } from '../components/HomeSpotterStrip'
import { HomeTodaySkeleton } from '../components/HomeTodaySkeleton'
import { InstallPrompt } from '../components/InstallPrompt'
import { PageShell } from '../components/PageShell'
import { PendingInvitesStrip } from '../components/PendingInvitesStrip'
import { BugHuntStrip } from '../components/BugHunt'
import { usePlayerName } from '../hooks/usePlayerName'
import { useRecentGames } from '../lib/lastPlayed'
import { lazyPage } from '../lib/lazyPage'
import { normalizePlayerName } from '../lib/leaderboard'
import '../styles/homeToday.css'

/**
 * Today's row (lib/today.ts), the day's dailies as cards and the way to the Today page, in a chunk of its own
 * with the dailies' plans. It's asked for as soon as the home page's own code is, not once the page has
 * drawn, and until it comes the row holds its place as a skeleton of itself (its styles are here, not in
 * its chunk, so the skeleton has them).
 */
const HomeToday = lazyPage(() => import('../components/HomeToday').then((m) => m.HomeToday))
void HomeToday.preload()

/** A phone, where the home page runs lighter (the rules in home.css under the same width). */
const PHONE = '(max-width: 36rem)'

function usePhone(): boolean {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(PHONE).matches)
  useEffect(() => {
    const query = window.matchMedia(PHONE)
    const sync = () => setPhone(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  return phone
}

type Part = 'hero' | 'today' | 'hunt' | 'invites' | 'onnow' | 'wall' | 'boards' | 'spotter' | 'groups'

/*
 * On a phone the games come straight after the banner. The page used to run
 * six screens there, and the wall began below the first; now what's on and
 * the bug hunt follow the games, slimmer, and the boards and groups are cut
 * to what a glance takes in (home.css). A wider screen keeps the page as it
 * was. The order is the page's own, not only how it looks, so a screen reader
 * hears it the way it's seen; each part keeps its key, so turning a phone
 * sideways moves the parts rather than starting them again.
 *
 * Today's row, the day's dailies and the streak with the way to the Today
 * page (where the ticket, your days, the rewards and your friends are), comes
 * straight after the banner for anyone who has played, phone or not.
 *
 * A first visit (no tag, nothing played on this device, as the banner has it)
 * gets the games right after the banner at any width, and today's row, what's
 * on and the bug hunt, which only mean something once you've played, after
 * them.
 */
const WIDE: Part[] = ['hero', 'today', 'hunt', 'invites', 'onnow', 'wall', 'boards', 'spotter', 'groups']
const NARROW: Part[] = ['hero', 'today', 'invites', 'wall', 'onnow', 'hunt', 'boards', 'spotter', 'groups']
const FIRST: Part[] = ['hero', 'invites', 'wall', 'today', 'onnow', 'hunt', 'boards', 'spotter', 'groups']

/**
 * The front door, at the width of the screen: a banner for the one game to
 * open now (or, on a first visit, for what the arcade is), what is on today
 * (the daily, the weekly, last week's podium), the wall of every game as a
 * cabinet, the boards at a glance — standings, house records and one game's
 * record book — and a way to a board of your own: groups and events.
 */
export function HomePage() {
  const phone = usePhone()
  const name = normalizePlayerName(usePlayerName())
  const recent = useRecentGames()
  const firstVisit = !name && recent.length === 0
  const parts: Record<Part, ReactElement> = {
    hero: <HomeHero key="hero" />,
    today: (
      <Suspense key="today" fallback={<HomeTodaySkeleton />}>
        <HomeToday />
      </Suspense>
    ),
    hunt: <BugHuntStrip key="hunt" />,
    invites: <PendingInvitesStrip key="invites" />,
    onnow: <HomeOnNow key="onnow" />,
    wall: <GameWall key="wall" />,
    boards: <HomeBoards key="boards" />,
    spotter: <HomeSpotterStrip key="spotter" />,
    groups: <HomeGroupsBand key="groups" />,
  }
  return (
    <>
      <PageShell variant="home">
        <div className="home-rail">{(firstVisit ? FIRST : phone ? NARROW : WIDE).map((part) => parts[part])}</div>
      </PageShell>
      <InstallPrompt />
    </>
  )
}
