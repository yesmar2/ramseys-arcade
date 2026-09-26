import { useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { ShareButton } from '../games/acechase/DailyCards'
import { drawHolePlan } from '../games/acechase/holePlan'
import { gameDailyHref } from '../hooks/useHashRoute'
import { inkOn } from '../lib/color'
import {
  PLACE_NAME,
  dailyDay,
  dailyServer,
  dayProgress,
  msUntilNextHole,
  subscribeDaily,
  syncDaily,
  todaysHole,
  type DailyServer,
  type DayProgress,
  type TodaysHole,
} from '../lib/dailyHole'
import { ordinal } from '../lib/profileMath'
import { resolveGameAccent } from '../lib/theme'
import { formatEventCountdown } from '../lib/tournaments'
import { PlayIcon } from './chromeIcons'
import '../styles/evp.css'

/*
 * Today's Hole, off the course: the day's Ace Chase hole drawn from above, how everyone's doing at it,
 * and the way in. It sits with the daily events on the Events page, and on Ace Chase's own page.
 */

const SLUG = 'acechase'

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)

/** Today's hole, what this device has done at it, and what the API says, kept fresh and rolled over at midnight. */
function useTodaysHole(): { hole: TodaysHole; progress: DayProgress | null; server: DailyServer | null } {
  const [day, setDay] = useState(dailyDay)
  const hole = useMemo(() => todaysHole(day), [day])
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  useEffect(() => subscribeDaily(refresh), [])
  useEffect(() => {
    void syncDaily()
  }, [day])
  useEffect(() => {
    const t = window.setInterval(() => {
      setDay(dailyDay())
      refresh()
    }, 30_000)
    return () => window.clearInterval(t)
  }, [])
  const server = dailyServer()
  return { hole, progress: dayProgress(day), server: server?.day === day ? server : null }
}

/** The hole from above, redrawn when its box changes size. */
function HolePlan({ hole }: { hole: TodaysHole }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const spot = hole.def.spots[0]
    if (!canvas || !spot) return
    let drawn = ''
    const draw = () => {
      const box = canvas.getBoundingClientRect()
      const w = Math.round(box.width)
      const h = Math.round(box.height)
      const dpr = Math.min(2.5, window.devicePixelRatio || 1)
      if (w < 2 || h < 2 || drawn === `${w}x${h}@${dpr}`) return
      drawn = `${w}x${h}@${dpr}`
      drawHolePlan(canvas, hole.def, spot, w, h, dpr)
    }
    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [hole])
  return <canvas ref={ref} className="thc-plan" aria-hidden="true" />
}

function standing(progress: DayProgress | null, server: DailyServer | null): string {
  const solved = progress?.solved
  if (solved) {
    const place = server?.you?.place
    const streak = server?.you?.streak ?? 0
    return `You got it in ${solved.tries}${place != null && server ? `, ${ordinal(place)} of ${server.solved}` : ''}.${
      streak > 1 ? ` That’s ${streak} days in a row.` : ''
    }`
  }
  const tries = progress?.tries ?? 0
  const leader = server?.top[0]
  const leads = leader ? ` ${leader.name} leads, in ${leader.tries} ${leader.tries === 1 ? 'try' : 'tries'}.` : ''
  if (tries > 0) return `You’re ${tries} ${tries === 1 ? 'try' : 'tries'} in.${leads}`
  if (!server) return ''
  if (server.solved === 0) return 'Nobody has got it yet.'
  return `${server.solved} ${server.solved === 1 ? 'player has' : 'have'} got it so far${
    server.average != null ? `, in ${server.average} ${server.average === 1 ? 'try' : 'tries'} on average` : ''
  }.${leads}`
}

/** Today's Hole as a card: the hole, how it's going, the clock to the next, and Play or Share. */
export function TodaysHoleCard() {
  const { hole, progress, server } = useTodaysHole()
  const href = gameDailyHref(SLUG)
  const solved = progress?.solved
  const tries = progress?.tries ?? 0
  const accent = resolveGameAccent(SLUG, getGame(SLUG)?.accent ?? '#2eb8a0')
  const style = { '--e': accent, '--e-ink': inkOn(accent) } as CSSProperties
  return (
    <section className="evp-card evp-daily thc" style={style} aria-labelledby="thc-title">
      <div className="evp-daily__screen">
        <a className="evp-screen thc__screen" href={href} aria-label={`Play Today’s Hole #${hole.n}, ${hole.def.name}`}>
          <HolePlan hole={hole} />
          <span className="evp-screen__play" aria-hidden="true">
            <PlayIcon />
            {solved ? 'Play again' : 'Play'}
          </span>
        </a>
        <span className="evp-tag evp-tag--today">
          <span className="evp-dot" aria-hidden="true" />
          Today&rsquo;s Hole #{hole.n}
        </span>
      </div>
      <div className="evp-daily__text">
        <h2 id="thc-title" className="evp-card__title">
          {hole.def.name}
        </h2>
        <p className="evp-card__copy">
          Ace Chase, on {PLACE_NAME[hole.pick.style]}. One hole for everyone today, every try counts, and the fewest to a
          bullseye top the list. {standing(progress, server)}
        </p>
      </div>
      <div className="evp-daily__foot">
        <span className="evp-meta">
          <ClockIcon />
          {formatEventCountdown(Date.now() + msUntilNextHole())}
        </span>
        {solved ? (
          <ShareButton hole={hole} tries={solved.tries} pattern={solved.pattern} className="evp-btn evp-btn--small" />
        ) : (
          <a className="evp-btn evp-btn--small" href={href}>
            {tries > 0 ? 'Carry on' : 'Play the hole'}
          </a>
        )}
      </div>
    </section>
  )
}
