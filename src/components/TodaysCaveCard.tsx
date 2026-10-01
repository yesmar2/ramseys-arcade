import { useEffect, useState, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { CaveDrawing } from '../games/lander/CaveDrawing'
import { caveDay, nextCaveAt } from '../games/lander/daily'
import { landerDay } from '../games/lander/runs'
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
import '../styles/todaysCave.css'

/*
 * Today's Cave, off the cave: Lander's cave of the day drawn from the side, how the day's board stands, and
 * the way in. The card sits with the daily events on the Events page and on Lander's own page, as Today's
 * Course does for Marble Run. It comes in a chunk of its own, with the cave's plan.
 */

const SLUG = 'lander'

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)

/** The day on the boards' clock, moved on at midnight while the page is open. */
function useCaveDay(): string {
  const [day, setDay] = useState(caveDay)
  useEffect(() => {
    const timer = window.setInterval(() => setDay(caveDay()), 30_000)
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
  return 'Nobody has flown it yet: the first run sets the bar.'
}

/** Today's Cave as a card: the cave, that it counts, how the day stands, the clock to the next, Past caves and Fly. */
export function TodaysCaveCard() {
  const day = useCaveDay()
  const lander = landerDay(day)
  const me = normalizePlayerName(usePlayerName())
  const board = useTodaysBoard(SLUG, day, me)
  const href = gamePlayHref(SLUG)
  const accent = resolveGameAccent(SLUG, getGame(SLUG)?.accent ?? '#8a6ad4')
  const style = { '--e': accent, '--e-ink': inkOn(accent) } as CSSProperties
  return (
    <section className="evp-card evp-daily tcv" style={style} aria-labelledby="tcv-title">
      <div className="evp-daily__screen">
        <a className="evp-screen tcv__screen" href={href} aria-label={`Fly Today’s Cave #${lander.n}, ${lander.name}`}>
          <CaveDrawing cave={lander.cave} className="tcv-plan" />
          <span className="evp-screen__play" aria-hidden="true">
            <PlayIcon />
            Fly
          </span>
        </a>
        <span className="evp-tag evp-tag--today">
          <span className="evp-dot" aria-hidden="true" />
          Today&rsquo;s Cave #{lander.n}
        </span>
      </div>
      <div className="evp-daily__text">
        <h2 id="tcv-title" className="evp-card__title">
          {lander.name}
        </h2>
        <TodayCounts slug={SLUG} />
        <p className="evp-card__copy">
          Lander, in a new cave every day. Fly the ship down it and set it down on the pad at the bottom against the
          clock, the same cave for everyone, and the fastest run tops the day. {standingWords(board)}
        </p>
      </div>
      <div className="evp-daily__foot evp-daily__foot--wrap">
        <span className="evp-meta">
          <ClockIcon />
          <EventCountdown endsAt={nextCaveAt()} />
        </span>
        <span className="evp-daily__go">
          <PastTabButton slug={SLUG} />
          <a className="evp-btn evp-btn--small" href={href}>
            {board?.you ? 'Beat your run' : 'Fly the cave'}
          </a>
        </span>
      </div>
    </section>
  )
}
