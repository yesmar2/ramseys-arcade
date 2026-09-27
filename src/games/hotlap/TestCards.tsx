import type { PointerEvent as ReactPointerEvent } from 'react'
import { GamePanelBody } from '../../components/PauseControls'
import { useDeliberatePress } from '../../hooks/useDeliberatePress'
import { gamePlayHref } from '../../hooks/useHashRoute'
import { fitCardToSpace } from '../../lib/cardFit'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import { dayWords, PLANNED_TRACKS, trackDay } from './daily'
import type { Course } from './lap'
import { formatLap } from './score'

/*
 * A test drive's two cards (/games/hotlap/play?track=<n>): the one it opens on, and the one after a lap.
 * A test drive is any day's track from the plan, driven ahead of its day to look it over; its laps go on
 * no board and aren't kept past the tab. The Track Book lists every track with its link.
 */

const SLUG = 'hotlap'

/** A track's test drive, by its number. */
function testDriveHref(n: number) {
  return `${gamePlayHref(SLUG)}?track=${n}`
}

/** When a track is the day's track, in words. */
function whenWords(day: string) {
  const today = trackDay()
  if (day === today) return 'Today’s track'
  return day > today ? `Comes ${dayWords(day)}` : `Was the track ${dayWords(day)}`
}

const holdPress = (e: ReactPointerEvent) => e.stopPropagation()

/** The tracks either side, and back to today's. A tap here isn't a tap to start. */
function TrackNav({ n }: { n: number }) {
  return (
    <nav className="hotlap-test__nav" aria-label="Other tracks">
      {n > 1 ? (
        <a href={testDriveHref(n - 1)} onPointerDown={holdPress}>
          ‹ #{n - 1}
        </a>
      ) : (
        <span />
      )}
      <a href={gamePlayHref(SLUG)} onPointerDown={holdPress}>
        Today’s track
      </a>
      {n < PLANNED_TRACKS ? (
        <a href={testDriveHref(n + 1)} onPointerDown={holdPress}>
          #{n + 1} ›
        </a>
      ) : (
        <span />
      )}
    </nav>
  )
}

/** A test drive's start card: like the game's own, it starts on a tap anywhere but its links. */
export function TestStartCard({ course, ghost }: { course: Course; ghost: number }) {
  const rows = (
    <>
      <div className="game-pause-meta__row">
        <span>Blue car</span>
        <strong>{formatLap(ghost)}</strong>
      </div>
      <div className="game-pause-meta__row">
        <span>Pace car</span>
        <strong>{formatLap(course.paceLap.time)}</strong>
      </div>
    </>
  )
  return (
    <div ref={fitCardToSpace} className="game-card game-card--start hotlap-test" style={gameAccentStyle(SLUG)}>
      <div className="game-card__head">
        <span className="game-card__kicker">
          Test drive · track {course.n} of {PLANNED_TRACKS}
        </span>
        <h2 className="game-card__title game-card__title--big">{course.name}</h2>
        <p className="game-card__blurb">
          {whenWords(course.day)}. Laps here aren’t saved: they go on no board, and your best here is gone when you close the tab.
        </p>
      </div>
      <GamePanelBody slug={SLUG} personalBest={0} hideBest hideRecord extraMeta={rows} />
      <button type="button" className="panel__btn game-card__start">
        Start
      </button>
      <TrackNav n={course.n} />
    </div>
  )
}

/** After a test lap: its time, against your best here and the pace car's. */
export function TestResultCard({
  course,
  time,
  splits,
  best,
  improved,
  onAgain,
  onDone,
}: {
  course: Course
  time: number
  splits: number[]
  best: number
  improved: boolean
  onAgain: () => void
  onDone: () => void
}) {
  // It opens as the lap ends: the lap's last presses don't reach its buttons.
  const allow = useDeliberatePress()
  const sectors = splits.map((at, k) => (at - (k === 0 ? 0 : splits[k - 1]!)).toFixed(2)).join(' · ')
  return (
    <div
      ref={fitCardToSpace}
      className="game-card hotlap-test"
      style={gameAccentStyle(SLUG)}
      role="dialog"
      aria-label={`${course.name}: ${formatLap(time)}`}
      onPointerDown={holdPress}
    >
      <div className="game-card__head">
        <span className="game-card__kicker">
          Test drive · #{course.n} {course.name}
        </span>
        <h2 className="game-card__title game-card__title--big">{formatLap(time)}</h2>
        <p className="game-card__blurb">Sectors {sectors}</p>
      </div>
      <div className="game-pause-meta">
        <div className="game-pause-meta__row">
          <span>Your best here</span>
          <strong>{improved ? 'This lap' : formatLap(best)}</strong>
        </div>
        <div className="game-pause-meta__row">
          <span>Pace car</span>
          <strong>{formatLap(course.paceLap.time)}</strong>
        </div>
      </div>
      <p className="game-card__hint">A test lap: not saved.</p>
      <div className="game-card__actions">
        <button
          type="button"
          className="panel__btn"
          onClick={(e) => {
            if (allow(e)) onAgain()
          }}
        >
          Drive it again
        </button>
        <button
          type="button"
          className="panel__btn panel__btn--ghost"
          onClick={(e) => {
            if (allow(e)) onDone()
          }}
        >
          Done
        </button>
      </div>
    </div>
  )
}
