import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { GamePanelBody } from '../../components/PauseControls'
import { useDeliberatePress } from '../../hooks/useDeliberatePress'
import { gameArchiveHref, gamePlayHref } from '../../hooks/useHashRoute'
import { fitCardToSpace } from '../../lib/cardFit'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import { courseDay, courseNumber, FIRST_DAY } from './daily'
import type { MarbleDay } from './runs'
import { formatRun } from './score'

/*
 * The cards of a past day's course rolled again from the archive (/games/marblerun/play?day=YYYY-MM-DD):
 * the one it opens on, and the one after a run. It's practice: its runs go on no board and pay nothing, and
 * your best here lasts only while the tab is open.
 */

const SLUG = 'marblerun'

/** A past day's course, by its day. */
const practiceHref = (day: string) => `${gamePlayHref(SLUG)}?day=${day}`
const shiftDay = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10)
}
const holdPress = (e: ReactPointerEvent) => e.stopPropagation()

/** "Mon, Sep 28": a course's day, in words. */
function dayWords(day: string) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="game-pause-meta__row">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  )
}

/** The courses either side of a past day's, and back to today's. A tap here isn't a tap to start. */
function CourseNav({ day }: { day: string }) {
  const before = shiftDay(day, -1)
  const after = shiftDay(day, 1)
  const today = courseDay()
  return (
    <nav className="marblerun-practice__nav" aria-label="Other courses">
      {before >= FIRST_DAY ? (
        <a href={practiceHref(before)} onPointerDown={holdPress}>
          ‹ #{courseNumber(before)}
        </a>
      ) : (
        <span />
      )}
      <a href={gameArchiveHref(SLUG)} onPointerDown={holdPress}>
        All courses
      </a>
      {after < today ? (
        <a href={practiceHref(after)} onPointerDown={holdPress}>
          #{courseNumber(after)} ›
        </a>
      ) : (
        <a href={gamePlayHref(SLUG)} onPointerDown={holdPress}>
          Today’s ›
        </a>
      )}
    </nav>
  )
}

/** A past course's start card: which day it was, the blue ball's run, and your best here. */
export function PracticeStartCard({ marble, pace, best }: { marble: MarbleDay; pace: number; best: number | null }) {
  return (
    <div ref={fitCardToSpace} className="game-card game-card--start marblerun-practice" style={gameAccentStyle(SLUG)}>
      <div className="game-card__head">
        <span className="game-card__kicker">Practice · #{marble.n}</span>
        <h2 className="game-card__title game-card__title--big">{marble.name}</h2>
        <p className="game-card__blurb">
          Was the course {dayWords(marble.day)}. Runs here are practice: they go on no board, and your best here is gone when you close the tab.
        </p>
      </div>
      <GamePanelBody
        slug={SLUG}
        personalBest={0}
        hideBest
        hideRecord
        extraMeta={
          <>
            <Row label="Blue ball">{formatRun(pace)}</Row>
            <Row label="Your best here">{best != null ? formatRun(best) : '–'}</Row>
          </>
        }
      />
      <button type="button" className="panel__btn game-card__start">
        Start
      </button>
      <CourseNav day={marble.day} />
    </div>
  )
}

/** After a practice run: its time, against your best here and the blue ball's. */
export function PracticeResultCard({
  marble,
  time,
  falls,
  best,
  improved,
  pace,
  onAgain,
  onDone,
}: {
  marble: MarbleDay
  time: number
  falls: number
  best: number
  improved: boolean
  pace: number
  onAgain: () => void
  onDone: () => void
}) {
  // It opens as the run ends: the run's last presses don't reach its buttons.
  const allow = useDeliberatePress()
  const gap = time - pace
  return (
    <div
      ref={fitCardToSpace}
      className="game-card marblerun-practice"
      style={gameAccentStyle(SLUG)}
      role="dialog"
      aria-label={`${marble.name}: ${formatRun(time)}`}
      onPointerDown={holdPress}
    >
      <div className="game-card__head">
        <span className="game-card__kicker">
          Practice · #{marble.n} {marble.name}
        </span>
        <h2 className="game-card__title game-card__title--big">{formatRun(time)}</h2>
        <p className="game-card__blurb">
          {Math.abs(gap) < 0.005 ? 'Tied with the blue ball' : gap < 0 ? `Beat the blue ball by ${(-gap).toFixed(2)}s` : `${gap.toFixed(2)}s behind the blue ball`}
          {' · '}
          {falls === 0 ? 'no falls' : falls === 1 ? '1 fall' : `${falls} falls`}
        </p>
      </div>
      <div className="game-pause-meta">
        <Row label="Your best here">{improved ? 'This run' : formatRun(best)}</Row>
        <Row label="Blue ball">{formatRun(pace)}</Row>
      </div>
      <p className="game-card__hint">A practice run: not saved.</p>
      <div className="game-card__actions">
        <button
          type="button"
          className="panel__btn"
          onClick={(e) => {
            if (allow(e)) onAgain()
          }}
        >
          Roll it again
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
