import { useEffect, useState, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { HillsPostcard } from '../games/swoop/HillsPostcard'
import { hillsDay, nextHillsAt } from '../games/swoop/daily'
import { swoopDay } from '../games/swoop/runs'
import { gamePlayHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { inkOn } from '../lib/color'
import { normalizePlayerName } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { ordinal } from '../lib/profileMath'
import { resolveGameAccent } from '../lib/theme'
import { useTodaysBoard, type TodayBoard } from '../lib/todaysBoard'
import { PlayIcon } from './chromeIcons'
import { EventCountdown } from './EventCountdown'
import { PastTabButton, TodayCounts } from './TodaysCardParts'
import '../styles/evp.css'
import '../styles/todaysHills.css'

/*
 * Today's Hills, off the hills: Swoop's hills of the day drawn from the side, how the day's board stands, and
 * the way in. The card sits on Swoop's own page, as Today's Cave does for Lander. It comes in a chunk of its
 * own, with the hills' plan.
 */

const SLUG = 'swoop'

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)

/** The day on the boards' clock, moved on at midnight while the page is open. */
function useHillsDay(): string {
  const [day, setDay] = useState(hillsDay)
  useEffect(() => {
    const timer = window.setInterval(() => setDay(hillsDay()), 30_000)
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
  return 'Nobody has swooped them yet: the first run sets the bar.'
}

/** Today's Hills as a card: the hills, that they count, how the day stands, the clock to the next, Past hills and Swoop. */
export function TodaysHillsCard() {
  const day = useHillsDay()
  const swoop = swoopDay(day)
  const me = normalizePlayerName(usePlayerName())
  const board = useTodaysBoard(SLUG, day, me)
  const href = gamePlayHref(SLUG)
  const accent = resolveGameAccent(SLUG, getGame(SLUG)?.accent ?? '#e8564f')
  const style = { '--e': accent, '--e-ink': inkOn(accent) } as CSSProperties
  return (
    <section className="evp-card evp-daily tch" style={style} aria-labelledby="tch-title">
      <div className="evp-daily__screen">
        <a className="evp-screen tch__screen" href={href} aria-label={`Swoop Today’s Hills #${swoop.n}, ${swoop.name}`}>
          <HillsPostcard hills={swoop.hills} w={640} h={360} className="tch-plan" />
          <span className="evp-screen__play" aria-hidden="true">
            <PlayIcon />
            Swoop
          </span>
        </a>
        <span className="evp-tag evp-tag--today">
          <span className="evp-dot" aria-hidden="true" />
          Today&rsquo;s Hills #{swoop.n}
        </span>
      </div>
      <div className="evp-daily__text">
        <h2 id="tch-title" className="evp-card__title">
          {swoop.name}
        </h2>
        <TodayCounts slug={SLUG} />
        <p className="evp-card__copy">
          Swoop, over new hills every day. Hold to dive down the slopes, let go to fly off the tops, and land along the
          far side to keep your speed, against the clock, the same hills for everyone, and the fastest run tops the day.{' '}
          {standingWords(board)}
        </p>
      </div>
      <div className="evp-daily__foot evp-daily__foot--wrap">
        <span className="evp-meta">
          <ClockIcon />
          <EventCountdown endsAt={nextHillsAt()} />
        </span>
        <span className="evp-daily__go">
          <PastTabButton slug={SLUG} />
          <a className="evp-btn evp-btn--small" href={href}>
            {board?.you ? 'Beat your run' : 'Swoop the hills'}
          </a>
        </span>
      </div>
    </section>
  )
}
