import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { GamePanelBody } from '../../components/PauseControls'
import { useDeliberatePress } from '../../hooks/useDeliberatePress'
import { adminHref } from '../../hooks/useHashRoute'
import { fitCardToSpace } from '../../lib/cardFit'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import { courseDay, dayOfCourse, PLANNED_COURSES } from './daily'
import { courseRunHref } from './links'
import type { MarbleDay } from './runs'
import { formatRun } from './score'
import { LAB_PIECES, LAB_PIECES_IN_WORDS } from './sim'

/*
 * The cards of an admin's test run (/games/marblerun/play?day=YYYY-MM-DD for today's course or one still to
 * come, from the admin's Course Book): the one it opens on, and the one after a run. A test run is for
 * rolling a course before its day: its runs go on no board and aren't kept past the tab. Only an admin gets
 * one (MarbleRunGame); anyone else asking is sent to today's course. A past day's course is practice, on
 * its own cards (PracticeCards.tsx).
 */

const SLUG = 'marblerun'

const holdPress = (e: ReactPointerEvent) => e.stopPropagation()

/**
 * A card after a run takes presses itself: the overlay it's on lets them through to the course (marblerun.css),
 * as a past course's card does with its own rule. Without this, its buttons were under the course's canvas.
 */
const afterRunStyle = (): CSSProperties => ({ ...gameAccentStyle(SLUG), pointerEvents: 'auto' })

/** "Today's course", "Comes Thu, Oct 1". */
function whenWords(day: string) {
  if (day === courseDay()) return 'Today’s course'
  const date = new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
  return `Comes ${date}`
}

const fallWords = (falls: number) => (falls === 0 ? 'no falls' : falls === 1 ? '1 fall' : `${falls} falls`)

/** The courses either side, and the way back to the book. A tap here isn't a tap to start. */
function CourseNav({ n }: { n: number }) {
  return (
    <nav className="marblerun-test__nav" aria-label="Other courses">
      {n > 1 ? (
        <a href={courseRunHref(dayOfCourse(n - 1))} onPointerDown={holdPress}>
          ‹ #{n - 1}
        </a>
      ) : (
        <span />
      )}
      <a href={adminHref('courses')} onPointerDown={holdPress}>
        Course Book
      </a>
      {n < PLANNED_COURSES ? (
        <a href={courseRunHref(dayOfCourse(n + 1))} onPointerDown={holdPress}>
          #{n + 1} ›
        </a>
      ) : (
        <span />
      )}
    </nav>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="game-pause-meta__row">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  )
}

/** A test run's start card: like the game's own, it starts on a tap anywhere but its links. */
export function TestStartCard({ marble, best }: { marble: MarbleDay; best: number | null }) {
  return (
    <div ref={fitCardToSpace} className="game-card game-card--start marblerun-test" style={gameAccentStyle(SLUG)}>
      <div className="game-card__head">
        <span className="game-card__kicker">
          Test run · course {marble.n} of {PLANNED_COURSES}
        </span>
        <h2 className="game-card__title game-card__title--big">{marble.name}</h2>
        <p className="game-card__blurb">
          {whenWords(marble.day)}. Runs here aren’t saved: they go on no board, and your best here is gone when you close the tab.
        </p>
      </div>
      <GamePanelBody
        slug={SLUG}
        personalBest={0}
        hideBest
        hideRecord
        extraMeta={
          <>
            <Row label="Blue ball">{formatRun(marble.pace)}</Row>
            <Row label="Your best here">{best != null ? formatRun(best) : '–'}</Row>
          </>
        }
      />
      <button type="button" className="panel__btn game-card__start">
        Start
      </button>
      <CourseNav n={marble.n} />
    </div>
  )
}

/**
 * The test track's start card (?lab=1, an admin's, from the Course Book): every new kind of piece in one course,
 * to try before any goes into a day's course. Nothing here is saved, and there's no blue ball to race.
 */
export function LabStartCard({ best }: { best: number | null }) {
  return (
    <div ref={fitCardToSpace} className="game-card game-card--start marblerun-test" style={gameAccentStyle(SLUG)}>
      <div className="game-card__head">
        <span className="game-card__kicker">Test track · new pieces</span>
        <h2 className="game-card__title game-card__title--big">Test Track</h2>
        <p className="game-card__blurb">
          Every new kind of piece in one course: {LAB_PIECES_IN_WORDS}. A checkpoint before each, so a fall costs only that
          piece. Runs here aren’t saved anywhere.
        </p>
      </div>
      <GamePanelBody
        slug={SLUG}
        personalBest={0}
        hideBest
        hideRecord
        extraMeta={
          <>
            <Row label="Pieces">{LAB_PIECES.length}</Row>
            <Row label="Your best here">{best != null ? formatRun(best) : '–'}</Row>
          </>
        }
      />
      <button type="button" className="panel__btn game-card__start">
        Start
      </button>
      <nav className="marblerun-test__nav" aria-label="Back to the Course Book">
        <span />
        <a href={adminHref('courses')} onPointerDown={holdPress}>
          Course Book
        </a>
        <span />
      </nav>
    </div>
  )
}

/** After a run of the test track: its time and falls, and your best here. Not saved. */
export function LabResultCard({
  time,
  falls,
  best,
  improved,
  onAgain,
  onDone,
}: {
  time: number
  falls: number
  best: number
  improved: boolean
  onAgain: () => void
  onDone: () => void
}) {
  // It opens as the run ends: the run's last presses don't reach its buttons.
  const allow = useDeliberatePress()
  return (
    <div
      ref={fitCardToSpace}
      className="game-card marblerun-test"
      style={afterRunStyle()}
      role="dialog"
      aria-label={`Test track: ${formatRun(time)}`}
      onPointerDown={holdPress}
    >
      <div className="game-card__head">
        <span className="game-card__kicker">Test track · new pieces</span>
        <h2 className="game-card__title game-card__title--big">{formatRun(time)}</h2>
        <p className="game-card__blurb">All the way down the test track, with {fallWords(falls)}.</p>
      </div>
      <div className="game-pause-meta">
        <Row label="Your best here">{improved ? 'This run' : formatRun(best)}</Row>
      </div>
      <p className="game-card__hint">A test run: not saved.</p>
      <div className="game-card__actions">
        <button
          type="button"
          className="panel__btn"
          onClick={(e) => {
            if (allow(e)) onAgain()
          }}
        >
          Roll again
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

/** After a test run: its time, against your best here and the blue ball's. */
export function TestResultCard({
  marble,
  time,
  falls,
  best,
  improved,
  onAgain,
  onDone,
}: {
  marble: MarbleDay
  time: number
  falls: number
  best: number
  improved: boolean
  onAgain: () => void
  onDone: () => void
}) {
  // It opens as the run ends: the run's last presses don't reach its buttons.
  const allow = useDeliberatePress()
  const gap = time - marble.pace
  const against = Math.abs(gap) < 0.005 ? 'Tied with the blue ball' : gap < 0 ? `Beat the blue ball by ${(-gap).toFixed(2)}s` : `${gap.toFixed(2)}s behind the blue ball`
  return (
    <div
      ref={fitCardToSpace}
      className="game-card marblerun-test"
      style={afterRunStyle()}
      role="dialog"
      aria-label={`${marble.name}: ${formatRun(time)}`}
      onPointerDown={holdPress}
    >
      <div className="game-card__head">
        <span className="game-card__kicker">
          Test run · #{marble.n} {marble.name}
        </span>
        <h2 className="game-card__title game-card__title--big">{formatRun(time)}</h2>
        <p className="game-card__blurb">
          {against}, with {fallWords(falls)}.
        </p>
      </div>
      <div className="game-pause-meta">
        <Row label="Your best here">{improved ? 'This run' : formatRun(best)}</Row>
        <Row label="Blue ball">{formatRun(marble.pace)}</Row>
      </div>
      <p className="game-card__hint">A test run: not saved.</p>
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
      {/* On to the next one, or back, without going through the start card. */}
      <CourseNav n={marble.n} />
    </div>
  )
}
