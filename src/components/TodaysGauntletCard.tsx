import { useEffect, useState, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { GauntletDrawing } from '../games/wobblerun/GauntletDrawing'
import { dailyGauntlet, gauntletDay, nextGauntletAt } from '../games/wobblerun/daily'
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
import '../styles/todaysGauntlet.css'

/*
 * Today's Gauntlet, off the gauntlet: Wobble Run's rounds of the day as a trail of badges to the Blip star, how the
 * day's board stands, and the way in. The card sits on Wobble Run's own page, as Today's Hills does for Swoop.
 * It comes in a chunk of its own, with the gauntlets' plan.
 */

const SLUG = 'wobblerun'

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)

/** The day on the boards' clock, moved on at midnight while the page is open. */
function useGauntletDay(): string {
  const [day, setDay] = useState(gauntletDay)
  useEffect(() => {
    const timer = window.setInterval(() => setDay(gauntletDay()), 30_000)
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
  return 'Nobody has run it yet: the first run sets the bar.'
}

/** Today's Gauntlet as a card: its rounds, that it counts, how the day stands, the clock to the next, Past gauntlets and Run. */
export function TodaysGauntletCard() {
  const day = useGauntletDay()
  const gauntlet = dailyGauntlet(day)
  const me = normalizePlayerName(usePlayerName())
  const board = useTodaysBoard(SLUG, day, me)
  const href = gamePlayHref(SLUG)
  const accent = resolveGameAccent(SLUG, getGame(SLUG)?.accent ?? '#e85d9a')
  const style = { '--e': accent, '--e-ink': inkOn(accent) } as CSSProperties
  return (
    <section className="evp-card evp-daily tcg" style={style} aria-labelledby="tcg-title">
      <div className="evp-daily__screen">
        <a className="evp-screen tcg__screen" href={href} aria-label={`Run Today’s Gauntlet #${gauntlet.n}, ${gauntlet.name}`}>
          <GauntletDrawing gauntlet={gauntlet} name={gauntlet.name} w={640} h={360} className="tcg-plan" />
          <span className="evp-screen__play" aria-hidden="true">
            <PlayIcon />
            Run
          </span>
        </a>
        <span className="evp-tag evp-tag--today">
          <span className="evp-dot" aria-hidden="true" />
          Today&rsquo;s Gauntlet #{gauntlet.n}
        </span>
      </div>
      <div className="evp-daily__text">
        <h2 id="tcg-title" className="evp-card__title">
          {gauntlet.name}
        </h2>
        <TodayCounts slug={SLUG} />
        <p className="evp-card__copy">
          Run, jump and dive Blip through a new gauntlet every day: four rounds and a climb to the star, against
          the clock, the same gauntlet for everyone, and the fastest run tops the day. {standingWords(board)}
        </p>
      </div>
      <div className="evp-daily__foot evp-daily__foot--wrap">
        <span className="evp-meta">
          <ClockIcon />
          <EventCountdown endsAt={nextGauntletAt()} />
        </span>
        <span className="evp-daily__go">
          <PastTabButton slug={SLUG} />
          <a className="evp-btn evp-btn--small" href={href}>
            {board?.you ? 'Beat your run' : 'Run the gauntlet'}
          </a>
        </span>
      </div>
    </section>
  )
}
