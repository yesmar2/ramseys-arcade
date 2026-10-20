import { useEffect, useState, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { TowerPostcard } from '../games/sling/TowerPostcard'
import { towerDay, nextTowerAt } from '../games/sling/daily'
import { slingDay } from '../games/sling/runs'
import { keptRun } from '../games/sling/runStore'
import { formatRun } from '../games/sling/score'
import { useAccountId } from '../hooks/useAccountId'
import { gamePlayHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { inkOn, readableFill } from '../lib/color'
import { normalizePlayerName } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { ordinal } from '../lib/profileMath'
import { resolveGameAccent } from '../lib/theme'
import { useTodaysBoard, type TodayBoard } from '../lib/todaysBoard'
import { PlayIcon } from './chromeIcons'
import { EventCountdown } from './EventCountdown'
import { DeviceRunNote, PastTabButton, TodayCounts } from './TodaysCardParts'
import '../styles/evp.css'
import '../styles/todaysTower.css'

/*
 * Today's Tower: Sling's tower of the day, a stretch of it at dusk, how the day's board stands, and
 * the way in. The card sits on Sling's own page, as Today's Cave does for Lander. It comes in a chunk of its
 * own, with the towers' plan.
 */

const SLUG = 'sling'

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)

/** The day on the boards' clock, moved on at midnight while the page is open. */
function useTowerDay(): string {
  const [day, setDay] = useState(towerDay)
  useEffect(() => {
    const timer = window.setInterval(() => setDay(towerDay()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  return day
}

const run = (score: number) => formatLeaderboardScore(SLUG, score)

/** Where the day's board stands, and where you are on it. */
function standingWords(board: TodayBoard | null): string {
  if (!board) return ''
  const { count, leader, you } = board
  if (you && you.place === 1) {
    return count > 1 ? `You lead today with ${run(you.score)}, of ${count} players.` : `You lead today with ${run(you.score)}.`
  }
  if (you) {
    const leads = leader ? ` ${leader.name} leads with ${run(leader.score)}.` : ''
    return `You’re ${ordinal(you.place)} of ${count} today, on ${run(you.score)}.${leads}`
  }
  if (leader) {
    return `${leader.name} leads with ${run(leader.score)}${count > 1 ? `, of ${count} players so far` : ''}.`
  }
  return 'Nobody has climbed it yet: the first run sets the bar.'
}

/** Today's Tower as a card: the tower, that it counts, how the day stands, the clock to the next, Past towers and Sling. */
export function TodaysTowerCard() {
  const day = useTowerDay()
  const sling = slingDay(day)
  const me = normalizePlayerName(usePlayerName())
  const board = useTodaysBoard(SLUG, day, me)
  // Signed out, the best run today this device keeps: on no board.
  const viewer = useAccountId()
  const kept = viewer === null ? keptRun(day, null) : null
  const href = gamePlayHref(SLUG)
  const accent = resolveGameAccent(SLUG, getGame(SLUG)?.accent ?? '#34c6a8')
  const style = { '--e': accent, '--e-ink': inkOn(accent), '--e-fill': readableFill(accent) } as CSSProperties
  return (
    <section className="evp-card evp-daily tct" style={style} aria-labelledby="tct-title">
      <div className="evp-daily__screen">
        <a className="evp-screen tct__screen" href={href} aria-label={`Sling Today’s Tower #${sling.n}, ${sling.name}`}>
          <TowerPostcard tower={sling.tower} w={640} h={360} className="tct-plan" />
          <span className="evp-screen__play" aria-hidden="true">
            <PlayIcon />
            Sling
          </span>
        </a>
        <span className="evp-tag evp-tag--today">
          <span className="evp-dot" aria-hidden="true" />
          Today&rsquo;s Tower #{sling.n}
        </span>
      </div>
      <div className="evp-daily__text">
        <h2 id="tct-title" className="evp-card__title">
          {sling.name}
        </h2>
        <TodayCounts slug={SLUG} />
        {/* Only today's part: how to play is the page's own, just above it (launch review, 2026-10-15). The space
            holds the line while the board is asked for. */}
        <p className="evp-card__copy">{standingWords(board) || ' '}</p>
        {kept ? <DeviceRunNote time={formatRun(kept.time)} /> : null}
      </div>
      <div className="evp-daily__foot evp-daily__foot--wrap">
        <span className="evp-meta">
          <ClockIcon />
          <EventCountdown endsAt={nextTowerAt()} />
        </span>
        <span className="evp-daily__go">
          <PastTabButton slug={SLUG} />
          <a className="evp-btn evp-btn--small" href={href}>
            {board?.you || kept ? 'Beat your run' : 'Climb the tower'}
          </a>
        </span>
      </div>
    </section>
  )
}
