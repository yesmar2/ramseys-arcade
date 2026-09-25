import { useEffect, useState, type ReactElement } from 'react'
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

type Part = 'hero' | 'hunt' | 'invites' | 'onnow' | 'wall' | 'boards' | 'spotter' | 'groups'

/*
 * On a phone the games come straight after the banner. The page used to run
 * six screens there, and the wall began below the first; now what's on and
 * the bug hunt follow the games, slimmer, and the boards and groups are cut
 * to what a glance takes in (home.css). A wider screen keeps the page as it
 * was. The order is the page's own, not only how it looks, so a screen reader
 * hears it the way it's seen; each part keeps its key, so turning a phone
 * sideways moves the parts rather than starting them again.
 */
const WIDE: Part[] = ['hero', 'hunt', 'invites', 'onnow', 'wall', 'boards', 'spotter', 'groups']
const NARROW: Part[] = ['hero', 'invites', 'wall', 'onnow', 'hunt', 'boards', 'spotter', 'groups']

/**
 * The front door, at the width of the screen: a banner for the one game to
 * open now (or, on a first visit, for what the arcade is), what is on today
 * (the daily, the weekly, last week's podium), the wall of every game as a
 * cabinet, the boards at a glance — standings, house records and one game's
 * record book — and a way to a board of your own: groups and events.
 */
export function HomePage() {
  const phone = usePhone()
  const parts: Record<Part, ReactElement> = {
    hero: <HomeHero key="hero" />,
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
        <div className="home-rail">{(phone ? NARROW : WIDE).map((part) => parts[part])}</div>
      </PageShell>
      <InstallPrompt />
    </>
  )
}
