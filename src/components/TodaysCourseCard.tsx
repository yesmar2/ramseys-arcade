import { useEffect, useState, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { CourseDrawing } from '../games/marblerun/CourseDrawing'
import { courseDay, nextCourseAt } from '../games/marblerun/daily'
import { marbleDay } from '../games/marblerun/runs'
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
import '../styles/todaysCourse.css'

/*
 * Today's Course, off the course: Marble Run's course of the day drawn from above, how the day's board
 * stands, and the way in. The card sits with the daily events on the Events page and on Marble Run's own
 * page, as Today's Track does for Hot Lap. It comes in a chunk of its own, with the course's plan.
 */

const SLUG = 'marblerun'

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)

/** The day on the boards' clock, moved on at midnight while the page is open. */
function useCourseDay(): string {
  const [day, setDay] = useState(courseDay)
  useEffect(() => {
    const timer = window.setInterval(() => setDay(courseDay()), 30_000)
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
  return 'Nobody has rolled it yet: the first run sets the bar.'
}

/** Today's Course as a card: the course, that it counts, how the day stands, the clock to the next, Past courses and Roll. */
export function TodaysCourseCard() {
  const day = useCourseDay()
  const marble = marbleDay(day)
  const me = normalizePlayerName(usePlayerName())
  const board = useTodaysBoard(SLUG, day, me)
  const href = gamePlayHref(SLUG)
  const accent = resolveGameAccent(SLUG, getGame(SLUG)?.accent ?? '#ff5ce1')
  const style = { '--e': accent, '--e-ink': inkOn(accent) } as CSSProperties
  return (
    <section className="evp-card evp-daily tcc" style={style} aria-labelledby="tcc-title">
      <div className="evp-daily__screen">
        <a className="evp-screen tcc__screen" href={href} aria-label={`Roll Today’s Course #${marble.n}, ${marble.name}`}>
          <CourseDrawing course={marble.course} className="tcc-plan" />
          <span className="evp-screen__play" aria-hidden="true">
            <PlayIcon />
            Roll
          </span>
        </a>
        <span className="evp-tag evp-tag--today">
          <span className="evp-dot" aria-hidden="true" />
          Today&rsquo;s Course #{marble.n}
        </span>
      </div>
      <div className="evp-daily__text">
        <h2 id="tcc-title" className="evp-card__title">
          {marble.name}
        </h2>
        <TodayCounts slug={SLUG} />
        <p className="evp-card__copy">
          Marble Run, on a new course every day. Tilt the world to roll the marble down it against the clock, the same
          course for everyone, and the fastest run tops the day. {standingWords(board)}
        </p>
      </div>
      <div className="evp-daily__foot evp-daily__foot--wrap">
        <span className="evp-meta">
          <ClockIcon />
          <EventCountdown endsAt={nextCourseAt()} />
        </span>
        <span className="evp-daily__go">
          <PastTabButton slug={SLUG} />
          <a className="evp-btn evp-btn--small" href={href}>
            {board?.you ? 'Beat your run' : 'Roll the course'}
          </a>
        </span>
      </div>
    </section>
  )
}
