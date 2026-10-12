import { lazy, Suspense, useEffect, useState } from 'react'
import { useRoute } from '../hooks/useHashRoute'
import { currentAccountId, subscribeAccountId } from '../lib/auth'
import { fetchFriendsWeek, wonFriendsWeek, type FriendsWeek } from '../lib/friendsWeek'
import { claimMoment, markMomentsSeen, momentSeen, panelOpen, releaseMoment } from '../lib/moments'
import { addDays, boardDay, weekStart } from '../lib/rankHow'

// Loaded when there's a week won to show: the takeover and its confetti stay off the first page load.
const FriendsWeekTakeover = lazy(() => import('./FriendsWeekTakeover').then((m) => ({ default: m.FriendsWeekTakeover })))

/*
 * Won last week among your friends: the whole screen, once (Ramsey, 2026-10-11: "go with your picks", A ·
 * Takeover from the "More celebrations" canvas). Few will top the arcade's standings, but plenty can top their
 * friends'. Signed in, the API is asked once a week how last week's standings came out among you and your
 * friends (GET /friends/week); first of three or more, and the next page off a game shows it. Asked once a
 * week on a device, won or not (lib/moments.ts). On a game's screen it waits, and over another panel.
 */

/** A beat after a page opens before it shows, so a panel the page opens itself, or a streak's moment, goes first. */
const SETTLE_MS = 1600
/** How often it looks again while another panel is up. */
const RETRY_MS = 1500
/** Its claim on the screen (lib/moments.ts): one whole-screen moment at a time. */
const MOMENT = 'friends-week'

function seenKey(account: string, week: string): string {
  return `friendsweek:${account}:${week}`
}

/** Asked once a visit for each account and week. */
const asked = new Map<string, Promise<FriendsWeek | null>>()

export function FriendsWeekMoment() {
  const route = useRoute()
  const [account, setAccount] = useState(() => currentAccountId())
  const [won, setWon] = useState<{ week: FriendsWeek; keys: string[] } | null>(null)
  const [showing, setShowing] = useState(false)
  useEffect(() => subscribeAccountId(() => setAccount(currentAccountId())), [])
  useEffect(() => () => releaseMoment(MOMENT), [])

  // A challenge link's page only passes you on to the game, so it counts as the game.
  const inGame = route.name === 'gamePlay' || route.name === 'tournamentPlay' || route.name === 'challenge'

  useEffect(() => {
    setWon(null)
    setShowing(false)
    releaseMoment(MOMENT)
    if (!account) return
    // Last week's Monday on the boards' clock: once it's been asked about here, it isn't again.
    const key = seenKey(account, weekStart(addDays(boardDay(), -7)))
    if (momentSeen(key)) return
    let live = true
    let reply = asked.get(key)
    if (!reply) {
      reply = fetchFriendsWeek().catch(() => null)
      asked.set(key, reply)
    }
    void reply.then((week) => {
      if (!live || !week) return
      // The API's week is the word, should this device's clock be a day out.
      const keys = [...new Set([key, seenKey(account, week.week)])]
      if (!wonFriendsWeek(week)) markMomentsSeen(keys)
      else if (!keys.some(momentSeen)) setWon({ week, keys })
    })
    return () => {
      live = false
    }
  }, [account])

  useEffect(() => {
    if (!won || showing || inGame) return
    const open = () => {
      if (!panelOpen() && claimMoment(MOMENT)) setShowing(true)
    }
    const first = window.setTimeout(open, SETTLE_MS)
    const again = window.setInterval(open, RETRY_MS)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(again)
    }
  }, [won, showing, inGame])

  if (!won || !showing || inGame) return null
  const done = () => {
    markMomentsSeen(won.keys)
    setWon(null)
    setShowing(false)
    releaseMoment(MOMENT)
  }
  return (
    <Suspense fallback={null}>
      <FriendsWeekTakeover week={won.week} onClose={done} />
    </Suspense>
  )
}
