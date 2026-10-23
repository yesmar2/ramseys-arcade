import { Suspense, useEffect, useState } from 'react'
import { lazyPart } from '../lib/lazyPage'
import { useRoute } from '../hooks/useHashRoute'
import { currentAccountId, subscribeAccountId } from '../lib/auth'
import { claimMoment, markMomentsSeen, momentSeen, panelOpen, releaseMoment } from '../lib/moments'
import { nextMilestone, subscribeToday, todayServer, type TodayServer } from '../lib/today'
import type { AvatarWear } from './AvatarStudio'
import { FlameIcon } from './chromeIcons'
import { openAvatarStudio } from './siteNav'
import type { SpotlightData } from './Spotlight'

// Loaded when there's one to show: the confetti it shares with the run report stays off the first page load.
const Spotlight = lazyPart(() => import('./Spotlight').then((m) => ({ default: m.Spotlight })))

/*
 * A Dailies streak milestone, the whole screen, once (Ramsey, 2026-10-11: "go with your picks", B · Spotlight
 * from the "More celebrations" canvas). The API pays a milestone the first time an account's best streak
 * reaches it and says when (GET /today's `reached`); while that's fresh and the streak still goes, the next
 * page off a game shows it. On a game's screen it waits, as LevelUpMoment does: the run has its report, and a
 * screen over a game takes taps meant for it. Over another panel it waits for that one to close. This device
 * remembers it was shown (lib/moments.ts).
 */

/** How long after it's paid a milestone is still news: a day and a half, so a visit the next day tells it. */
const FRESH_MS = 36 * 60 * 60 * 1000
/** A beat after a page opens before it shows, so a panel the page opens itself goes first. */
const SETTLE_MS = 1200
/** How often it looks again while another panel is up. */
const RETRY_MS = 1500
const GLOW = '#ff9a3d'
/** Its claim on the screen (lib/moments.ts): one whole-screen moment at a time. */
const MOMENT = 'streak'

const monthDay = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })

/** What each milestone earned (the API's TODAY_MILESTONES), and the look to put on, if it's one. */
const EARNED: Record<number, { chip: string; wear: AvatarWear | null }> = {
  3: { chip: '10 tickets for the prize counter', wear: null },
  7: { chip: 'The Dailies pin is yours', wear: { pin: 'today' } },
  14: { chip: '25 tickets for the prize counter', wear: null },
  30: { chip: 'The Gold avatar is yours', wear: { prize: 'gilded' } },
  // A foil since titles showed nowhere (2026-10-21): it was the Every Day title.
  100: { chip: 'The Every Day foil is yours', wear: { prize: 'fl-everyday' } },
}

function seenKey(account: string, day: number): string {
  return `streak:${account}:${day}`
}

/** The going streak's first day, and the days a freeze covered in it; null when it began before the days held. */
export function streakStart(server: Pick<TodayServer, 'week' | 'days'>): { day: string; frozen: number } | null {
  const days = server.days ?? server.week
  let i = days.length - 1
  // Today not kept yet doesn't end it: the streak runs to yesterday.
  if (i >= 0 && !days[i]!.kept && !days[i]!.frozen) i--
  let start: string | null = null
  let frozen = 0
  for (; i >= 0; i--) {
    const d = days[i]!
    if (d.kept) start = d.day
    else if (d.frozen) frozen++
    else return start ? { day: start, frozen } : null
  }
  return null
}

function lede(server: TodayServer, day: number): string {
  const start = streakStart(server)
  if (!start) return `That’s more than ${Math.floor(day / 7)} weeks of the Dailies, and still going.`
  const since = monthDay.format(new Date(`${start.day}T00:00:00Z`))
  if (!start.frozen) return `You’ve kept the Dailies every day since ${since}.`
  return `You’ve kept the Dailies since ${since}, with ${start.frozen === 1 ? 'one day' : `${start.frozen} days`} on a freeze.`
}

/** "Next, at 7 days: the Dailies pin for your badge." */
function nextLine(day: number): string | null {
  const next = nextMilestone(day)
  return next ? `Next, at ${next.day} days: ${next.prize.charAt(0).toLowerCase()}${next.prize.slice(1)}.` : null
}

export function milestoneSpotlight(server: TodayServer, day: number): SpotlightData {
  return {
    glow: GLOW,
    art: <FlameIcon />,
    kicker: 'Dailies streak',
    title: `${day} days in a row`,
    lede: lede(server, day),
    prize: EARNED[day]?.chip ?? null,
    note: nextLine(day),
  }
}

export function milestoneWear(day: number): AvatarWear | null {
  return EARNED[day]?.wear ?? null
}

/** The milestone to show: the highest paid lately that the going streak still holds, not shown here yet. */
function dueMilestone(server: TodayServer, account: string, now: number): { day: number; keys: string[] } | null {
  const fresh = (server.reached ?? []).filter(
    (r) => now - r.at < FRESH_MS && server.streak.current >= r.day && !momentSeen(seenKey(account, r.day)),
  )
  if (!fresh.length) return null
  // Two at once (paid together): the higher is told, and both are done with.
  return { day: Math.max(...fresh.map((r) => r.day)), keys: fresh.map((r) => seenKey(account, r.day)) }
}

type Showing = { data: SpotlightData; wear: AvatarWear | null; keys: string[] }

export function MilestoneMoment() {
  const route = useRoute()
  const [server, setServer] = useState(() => todayServer())
  const [account, setAccount] = useState(() => currentAccountId())
  const [showing, setShowing] = useState<Showing | null>(null)
  useEffect(() => subscribeToday(() => setServer(todayServer())), [])
  useEffect(() => subscribeAccountId(() => setAccount(currentAccountId())), [])
  useEffect(() => () => releaseMoment(MOMENT), [])

  // A challenge link's page only passes you on to the game, so it counts as the game.
  const inGame = route.name === 'gamePlay' || route.name === 'tournamentPlay' || route.name === 'challenge'
  const dueDay = !showing && !inGame && account && server ? (dueMilestone(server, account, Date.now())?.day ?? null) : null

  useEffect(() => {
    if (dueDay == null || !server || !account) return
    const open = () => {
      if (panelOpen()) return
      const due = dueMilestone(server, account, Date.now())
      if (due && claimMoment(MOMENT)) setShowing({ data: milestoneSpotlight(server, due.day), wear: milestoneWear(due.day), keys: due.keys })
    }
    const first = window.setTimeout(open, SETTLE_MS)
    const again = window.setInterval(open, RETRY_MS)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(again)
    }
  }, [dueDay, server, account])

  if (!showing || inGame) return null
  const done = () => {
    markMomentsSeen(showing.keys)
    setShowing(null)
    releaseMoment(MOMENT)
  }
  const wear = showing.wear
  const putOn = wear
    ? {
        label: 'Put it on',
        onClick: () => {
          done()
          openAvatarStudio(wear)
        },
      }
    : null
  return (
    <Suspense fallback={null}>
      <Spotlight data={showing.data} primary={putOn} onClose={done} />
    </Suspense>
  )
}
