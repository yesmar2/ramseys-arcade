import { Suspense, useEffect, useState, type ReactElement } from 'react'
import { GameWall } from '../components/GameWall'
import { HomeBoards } from '../components/HomeBoards'
import { HomeGroupsBand } from '../components/HomeGroupsBand'
import { HomeHero } from '../components/HomeHero'
import { HomeOnNow } from '../components/HomeOnNow'
import { HomeSpotterStrip } from '../components/HomeSpotterStrip'
import { HomeTodaySkeleton } from '../components/HomeTodaySkeleton'
import { HomeUpNext } from '../components/HomeUpNext'
import { InstallPrompt } from '../components/InstallPrompt'
import { PageShell } from '../components/PageShell'
import { PendingInvitesStrip } from '../components/PendingInvitesStrip'
import { PartErrorBoundary } from '../components/SiteErrorBoundary'
import { BugHuntStrip } from '../components/BugHunt'
import { usePlayerName } from '../hooks/usePlayerName'
import { APP_NAME } from '../lib/brand'
import { useRecentGames } from '../lib/lastPlayed'
import { lazyPage } from '../lib/lazyPage'
import { normalizePlayerName } from '../lib/leaderboard'
import '../styles/homeToday.css'
import '../styles/alsoToday.css'

/**
 * Today's ticket (lib/today.ts), the day's races and the way to the Dailies page, in a chunk of its own with the
 * dailies' plans. It's asked for as soon as the home page's own code is, not once the page has drawn, and until
 * it comes the ticket holds its place as a skeleton of itself (its styles are here, not in its chunk, so the
 * skeleton has them; the puzzles' are for the wall's tile).
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

type Part = 'hero' | 'today' | 'upnext' | 'invites' | 'onnow' | 'wall' | 'boards' | 'spotter' | 'foot'

/*
 * D on the "Home page redesign" canvas (Ramsey, 2026-10-15: "ok, let's impelment this"). Anyone who has played
 * opens on today's ticket, the day's races and the streak, then Up next for you, picked from their own games,
 * then the wall of every game with the day's puzzles in its last row, the boards, and the bug hunt and groups at
 * the foot. On a phone what's on comes after the games, and the boards and groups are cut to what a glance takes
 * in (home.css). The order is the page's own, not only how it looks, so a screen reader hears it the way it's
 * seen; each part keeps its key, so turning a phone sideways moves the parts rather than starting them again.
 *
 * A first visit (no tag, nothing played on this device) gets the welcome first, what the arcade is, then the
 * ticket and the games; the season and Blip's question come after the games (HomeUpNext's first-visit row).
 */
const WIDE: Part[] = ['today', 'upnext', 'invites', 'onnow', 'wall', 'boards', 'spotter', 'foot']
const NARROW: Part[] = ['today', 'upnext', 'invites', 'wall', 'onnow', 'boards', 'spotter', 'foot']
const FIRST: Part[] = ['hero', 'invites', 'today', 'wall', 'upnext', 'onnow', 'boards', 'spotter', 'foot']

/**
 * The front door, at the width of the screen: today's ticket (on a first visit, after what the arcade is), what's
 * up next for you, what is on today (the daily, the weekly, last week's podium), the wall of every game as a
 * cabinet, the boards at a glance — standings, house records and one game's record book — and a way to a board
 * of your own: groups and events.
 */
export function HomePage() {
  const phone = usePhone()
  const name = normalizePlayerName(usePlayerName())
  const recent = useRecentGames()
  const firstVisit = !name && recent.length === 0
  const parts: Record<Part, ReactElement> = {
    hero: <HomeHero key="hero" />,
    today: (
      // A row that fails to come keeps its skeleton, Open Dailies and all, and the rest of the page stays.
      <PartErrorBoundary key="today" fallback={<HomeTodaySkeleton />}>
        <Suspense fallback={<HomeTodaySkeleton />}>
          <HomeToday />
        </Suspense>
      </PartErrorBoundary>
    ),
    upnext: <HomeUpNext key="upnext" first={firstVisit} />,
    invites: <PendingInvitesStrip key="invites" />,
    onnow: <HomeOnNow key="onnow" />,
    wall: <GameWall key="wall" puzzles />,
    boards: <HomeBoards key="boards" />,
    spotter: <HomeSpotterStrip key="spotter" />,
    // The bug hunt and groups side by side at the foot (home.css .home-foot); one under the other when narrow.
    foot: (
      <div key="foot" className="home-foot">
        <BugHuntStrip />
        <HomeGroupsBand />
      </div>
    ),
  }
  return (
    <>
      <PageShell variant="home" innerClassName="home-rail">
        {/* The page's heading, for a screen reader: each part has its own h2, and the site's name heads them. */}
        <h1 className="visually-hidden">{APP_NAME}</h1>
        {(firstVisit ? FIRST : phone ? NARROW : WIDE).map((part) => parts[part])}
      </PageShell>
      <InstallPrompt />
    </>
  )
}
