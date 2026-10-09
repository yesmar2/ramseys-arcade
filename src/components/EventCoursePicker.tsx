import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { getGame } from '../data/games'
import { plusHref } from '../hooks/useHashRoute'
import { courseOpenToAll, EVENT_COURSES, eventCourseDays } from '../lib/eventCourses'
import { resolveGameAccent } from '../lib/theme'
import { LISTED_RACE_EVENT_GAMES, type RaceEventGame } from '../lib/tournaments'
import { GameThumbArt } from './GameThumbArt'
import '../styles/eventCourses.css'

/*
 * The event maker's racing dailies, each raced on one course (Ramsey picked A, a strip of track cards, from the
 * "Events on past courses" canvas, 2026-10-09): a row of the racing dailies under the other games, and once one
 * is picked, a strip of its courses, today's first, each with its picture, name and day. Today's is anyone's;
 * with Plus (PlanLimits.anyCourse) every past course back to the game's first is there too, and without it a
 * card after today's says so.
 */

/** "Wed, Oct 7", on the course's own day. */
function dayWords(day: string) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** A course's picture, drawn once its card comes near the strip's view: a Plus member's strip can run to hundreds. */
function LazyArt({ children }: { children: () => ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || near) return
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true)
      return
    }
    const io = new IntersectionObserver((seen) => {
      if (seen.some((e) => e.isIntersecting)) setNear(true)
    }, { rootMargin: '0px 400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [near])
  return (
    <span ref={ref} className="evc-card__art" aria-hidden="true">
      {near ? children() : null}
    </span>
  )
}

export function EventCoursePicker({
  picked,
  day,
  anyCourse,
  onPickGame,
  onPickDay,
}: {
  /** The racing daily picked, if one is. */
  picked: RaceEventGame | null
  /** The picked course's day. */
  day: string | null
  /** The host may pick any past course (Plus). */
  anyCourse: boolean
  onPickGame: (slug: RaceEventGame) => void
  onPickDay: (day: string) => void
}) {
  if (!LISTED_RACE_EVENT_GAMES.length) return null
  const src = picked ? EVENT_COURSES[picked] : null
  const all = picked ? eventCourseDays(picked) : []
  const open = picked ? all.filter((d) => courseOpenToAll(picked, d)) : []
  const shown = anyCourse ? all : open
  const locked = all.length - open.length
  const name = picked ? (getGame(picked)?.name ?? picked) : ''
  return (
    <div className="evc">
      <div className="evc__head">
        <h3 className="evc__label">Racing dailies · on one course</h3>
        <span className="evc__note">Everyone races the same track for the whole event</span>
      </div>
      <div className="ev-games evc__games">
        {LISTED_RACE_EVENT_GAMES.map((slug) => {
          const g = getGame(slug)
          const accent = resolveGameAccent(slug, g?.accent ?? '#2eb8a0')
          const on = picked === slug
          return (
            <button
              key={slug}
              type="button"
              className={`ev-game${on ? ' ev-game--on' : ''}`}
              style={{ '--game-accent': accent } as CSSProperties}
              aria-pressed={on}
              onClick={() => onPickGame(slug)}
            >
              <GameThumbArt slug={slug} accent={accent} />
              <span className="ev-game__name">{g?.name ?? slug}</span>
              {on ? (
                <span className="ev-game__check" aria-hidden="true">
                  ✓
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      {picked && src ? (
        <div className="evc__courses">
          <div className="evc__head">
            <h3 className="evc__title">Which {name} course?</h3>
            <span className="evc__note">
              {all.length} {all.length === 1 ? 'course' : 'courses'} so far
            </span>
          </div>
          <ul className="evc__strip" aria-label={`${name} courses`}>
            {shown.map((d) => {
              const on = d === day
              const today = d === src.today()
              return (
                <li key={d}>
                  <button type="button" className={`evc-card${on ? ' evc-card--on' : ''}`} aria-pressed={on} onClick={() => onPickDay(d)}>
                    <LazyArt>{() => src.art(d)}</LazyArt>
                    <b className="evc-card__name">{src.title(d)}</b>
                    <span className="evc-card__day">{today ? 'Today' : dayWords(d)}</span>
                  </button>
                </li>
              )
            })}
            {!anyCourse && locked > 0 ? (
              <li>
                <a className="evc-card evc-card--plus" href={plusHref()}>
                  <b className="evc-card__name">
                    {locked} past {locked === 1 ? 'course' : 'courses'}
                  </b>
                  <span className="evc-card__day">Host on any past course with Plus</span>
                </a>
              </li>
            ) : null}
          </ul>
          <p className="evc__foot">
            {anyCourse ? 'Any course, with Plus.' : 'Today’s course is free to host on; any past one is Plus.'} Joining is always free.
          </p>
        </div>
      ) : null}
    </div>
  )
}
