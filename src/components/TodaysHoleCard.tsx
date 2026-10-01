import { useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { ShareButton } from '../games/acechase/DailyCards'
import { drawHolePlan } from '../games/acechase/holePlan'
import { formatTries } from '../games/acechase/score'
import { useAccountId } from '../hooks/useAccountId'
import { gamePlayHref } from '../hooks/useHashRoute'
import { inkOn } from '../lib/color'
import {
  PLACE_NAME,
  dailyDay,
  dailyServer,
  dayProgress,
  dayResult,
  msUntilNextHole,
  patternOf,
  subscribeDaily,
  syncDaily,
  todaysHole,
  type DailyServer,
  type DayProgress,
  type TodaysHole,
} from '../lib/dailyHole'
import { resolveGameAccent } from '../lib/theme'
import { formatEventCountdown } from '../lib/tournaments'
import { PlayIcon } from './chromeIcons'
import { PastTabButton, TodayCounts } from './TodaysCardParts'
import { YourCard, YourRow } from './YourDays'
import '../styles/evp.css'

/*
 * Today's Hole, off the course: the day's Ace Chase hole drawn from above, how you and everyone are doing at
 * it (a count and an average, never a name), and the way in. It sits with the daily events on the Events page,
 * and on Ace Chase's own page; with it, for Ace Chase's page, your tries today (TodaysHoleByTry). Ace Chase is
 * just for fun (data/games.ts Game.ranked): nobody's tries are weighed against anyone else's.
 */

const SLUG = 'acechase'

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)

/**
 * Today's hole, what the player has done at it on this device (their own run only: lib/deviceRuns.ts),
 * and what the API says, kept fresh and rolled over at midnight.
 */
function useTodaysHole(): { hole: TodaysHole; progress: DayProgress | null; server: DailyServer | null } {
  const [day, setDay] = useState(dailyDay)
  const hole = useMemo(() => todaysHole(day), [day])
  const viewer = useAccountId()
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
  return { hole, progress: dayProgress(day, viewer), server: server?.day === day ? server : null }
}

/** The hole from above, redrawn when its box changes size. */
export function HolePlan({ hole }: { hole: TodaysHole }) {
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

/** How everyone's doing today, in a count and an average: no names. */
function everyoneWords(server: DailyServer | null): string {
  if (!server) return ''
  if (server.solved === 0) return 'Nobody has got it yet.'
  return `${server.solved} ${server.solved === 1 ? 'player has' : 'have'} got it so far${
    server.average != null ? `, in ${server.average} ${server.average === 1 ? 'try' : 'tries'} on average` : ''
  }.`
}

function standing(progress: DayProgress | null, server: DailyServer | null): string {
  const result = dayResult(progress, server?.you)
  if (result) {
    const streak = server?.you?.streak ?? 0
    return `You got it in ${result.tries}.${streak > 1 ? ` That’s ${streak} days in a row.` : ''}`
  }
  const tries = progress?.tries ?? 0
  if (tries > 0) return `You’re ${tries} ${tries === 1 ? 'try' : 'tries'} in.`
  return everyoneWords(server)
}

/** Today's Hole as a card: the hole, that it counts, how it's going, the clock to the next, Past holes, and Play or Share. */
export function TodaysHoleCard() {
  const { hole, progress, server } = useTodaysHole()
  const href = gamePlayHref(SLUG)
  // Their result, on the board or their own bullseye here: shared only with its tries' pattern, which only their own run here has.
  const solved = dayResult(progress, server?.you)
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
        <TodayCounts slug={SLUG} />
        <p className="evp-card__copy">
          Ace Chase, on {PLACE_NAME[hole.pick.style]}. One hole for everyone today, and every try counts.{' '}
          {standing(progress, server)}
        </p>
      </div>
      <div className="evp-daily__foot evp-daily__foot--wrap">
        <span className="evp-meta">
          <ClockIcon />
          {formatEventCountdown(Date.now() + msUntilNextHole())}
        </span>
        <span className="evp-daily__go">
          <PastTabButton slug={SLUG} />
          {solved?.pattern ? (
            <ShareButton hole={hole} tries={solved.tries} pattern={solved.pattern} className="evp-btn evp-btn--small" />
          ) : (
            <a className="evp-btn evp-btn--small" href={href}>
              {solved ? 'Play again' : tries > 0 ? 'Carry on' : 'Play the hole'}
            </a>
          )}
        </span>
      </div>
    </section>
  )
}

/** Where a try ended, in words and in the colour its mark has (yourDays.css .yd-try). */
const ENDS: { code: string; name: string; colour: string }[] = [
  { code: 'b', name: 'Bullseye', colour: 'var(--gh-accent, #2eb8a0)' },
  { code: 'i', name: 'Inner ring', colour: '#3ecf8e' },
  { code: 'o', name: 'Outer ring', colour: '#4aa8e8' },
  { code: 'x', name: 'Off the rings', colour: 'rgba(var(--ink-rgb), 0.35)' },
  { code: 'l', name: 'Lost', colour: '#1f5577' },
]

/** A day's tries as dots, one a try, where each ended. */
function TryMarks({ pattern }: { pattern: string }) {
  const marks = [...pattern]
  const shown = marks.length > 40 ? [...marks.slice(0, 39), '…', marks[marks.length - 1]!] : marks
  return (
    <div className="yd-tries" aria-label={marks.map((c) => ENDS.find((e) => e.code === c)?.name ?? '').join(', ')}>
      {shown.map((c, i) => (
        <span key={i} className={`yd-try yd-try--${c === '…' ? 'more' : c}`} aria-hidden="true">
          {c === '…' ? '…' : null}
        </span>
      ))}
    </div>
  )
}

/**
 * Your tries at today's hole, for Ace Chase's Today tab beside your days (YourDays.tsx): a dot a try, where
 * each ended, and how many ended where; under them, how everyone's doing, in a count and an average. Only
 * your own: a result from another device shows its tries.
 */
export function TodaysHoleByTry() {
  const { progress, server } = useTodaysHole()
  const href = gamePlayHref(SLUG)
  const result = dayResult(progress, server?.you)
  const inPlay = !result && progress && progress.tries > 0 ? patternOf(progress.shots) : null
  const pattern = result?.pattern ?? inPlay
  let body
  if (pattern) {
    const counts = ENDS.map((end) => ({ ...end, n: [...pattern].filter((c) => c === end.code).length })).filter((e) => e.n > 0)
    body = (
      <>
        <p className="yd-headline">{result ? `Bullseye in ${formatTries(result.tries)}` : `${formatTries(pattern.length)} so far`}</p>
        <TryMarks pattern={pattern} />
        <ul className="yd-rows">
          {counts.map((e) => (
            <YourRow key={e.code} name={e.name} color={e.colour} fill={(100 * e.n) / pattern.length} value={String(e.n)} />
          ))}
        </ul>
        {result ? null : (
          <a className="evp-btn evp-btn--small yd__go" href={href}>
            Carry on
          </a>
        )}
        <p className="yd__foot">{everyoneWords(server) || 'A new hole comes at midnight.'}</p>
      </>
    )
  } else if (result) {
    // A result from another device: its tries are all that's known here.
    body = <p className="yd__note">You got it in {formatTries(result.tries)} today, on another device. Its tries are there.</p>
  } else {
    body = (
      <>
        <p className="yd__note">Not played yet today. One hole, and every try counts: stop the ball dead on the bullseye.</p>
        <a className="evp-btn evp-btn--small yd__go" href={href}>
          Play the hole
        </a>
        {server ? <p className="yd__foot">{everyoneWords(server)}</p> : null}
      </>
    )
  }
  return (
    <YourCard title="Today, try by try" labelledBy="yd-today-acechase" hunt={`g-stand-${SLUG}`}>
      {body}
    </YourCard>
  )
}
