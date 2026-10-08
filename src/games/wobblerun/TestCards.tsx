import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { GamePanelBody } from '../../components/PauseControls'
import { useDeliberatePress } from '../../hooks/useDeliberatePress'
import { adminHref } from '../../hooks/useHashRoute'
import { fitCardToSpace } from '../../lib/cardFit'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import { gauntletDay, PLANNED_GAUNTLETS } from './daily'
import { gauntletRunHref } from './links'
import type { WobbleDay } from './runs'
import { formatRun, splatWords } from './score'

/*
 * The cards of an admin's test run (/games/wobblerun/play?track=<n>, or ?day=YYYY-MM-DD, for today's gauntlet or
 * one still to come, from the admin's Gauntlet Book): the one it opens on, and the one after a run. A test run is
 * for running a gauntlet before its day: its runs go on no board and aren't kept past the tab. Only an admin gets
 * one (WobbleRunGame); anyone else asking is sent to today's gauntlet. A past day's gauntlet is practice, on its
 * own cards (PracticeCards.tsx). The test course (?lab=1) has cards of its own here too.
 */

const SLUG = 'wobblerun'

const holdPress = (e: ReactPointerEvent) => e.stopPropagation()

/**
 * A card after a run takes presses itself: the overlay it's on lets them through to the course (wobblerun.css),
 * as a past gauntlet's card does with its own rule. Without this, its buttons were under the course's canvas.
 */
const afterRunStyle = (): CSSProperties => ({ ...gameAccentStyle(SLUG), pointerEvents: 'auto' })

/** "Today's gauntlet", "Comes Thu, Oct 15". */
function whenWords(day: string) {
  if (day === gauntletDay()) return 'Today’s gauntlet'
  const date = new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
  return `Comes ${date}`
}

/** "Beat the blue bean by 1.20s", "Tied with the blue bean", "3.04s behind the blue bean". */
function againstBlue(time: number, pace: number) {
  const gap = time - pace
  return Math.abs(gap) < 0.005 ? 'Tied with the blue bean' : gap < 0 ? `Beat the blue bean by ${(-gap).toFixed(2)}s` : `${gap.toFixed(2)}s behind the blue bean`
}

/** The gauntlets either side, and the way back to the book. A tap here isn't a tap to start. */
function GauntletNav({ n }: { n: number }) {
  return (
    <nav className="wobblerun-test__nav" aria-label="Other gauntlets">
      {n > 1 ? (
        <a href={gauntletRunHref(n - 1)} onPointerDown={holdPress}>
          ‹ #{n - 1}
        </a>
      ) : (
        <span />
      )}
      <a href={adminHref('gauntlets')} onPointerDown={holdPress}>
        Gauntlet Book
      </a>
      {n < PLANNED_GAUNTLETS ? (
        <a href={gauntletRunHref(n + 1)} onPointerDown={holdPress}>
          #{n + 1} ›
        </a>
      ) : (
        <span />
      )}
    </nav>
  )
}

/** Under the test course's cards: the way back to the book. The course is the same each time, so there's no "next". */
function LabNav() {
  return (
    <nav className="wobblerun-test__nav" aria-label="Back to the Gauntlet Book">
      <span />
      <a href={adminHref('gauntlets')} onPointerDown={holdPress}>
        Gauntlet Book
      </a>
      <span />
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

/** A test run's start card: like the game's own, it starts on a tap anywhere but its links. `chips`, the gauntlet's rounds. */
export function TestStartCard({ wobble, best, chips }: { wobble: WobbleDay; best: number | null; chips: ReactNode }) {
  return (
    <div ref={fitCardToSpace} className="game-card game-card--start wobblerun-test" style={gameAccentStyle(SLUG)}>
      <div className="game-card__head">
        <span className="game-card__kicker">
          Test run · gauntlet {wobble.n} of {PLANNED_GAUNTLETS}
        </span>
        <h2 className="game-card__title game-card__title--big">{wobble.name}</h2>
        <p className="game-card__blurb">
          {whenWords(wobble.day)}. Runs here aren’t saved: they go on no board, and your best here is gone when you close the tab.
        </p>
      </div>
      <GamePanelBody
        slug={SLUG}
        personalBest={0}
        hideBest
        hideRecord
        extraMeta={
          <>
            {chips}
            <Row label="Blue bean">{formatRun(wobble.pace)}</Row>
            <Row label="Your best here">{best != null ? formatRun(best) : '–'}</Row>
          </>
        }
      />
      <button type="button" className="panel__btn game-card__start">
        Start
      </button>
      <GauntletNav n={wobble.n} />
    </div>
  )
}

/** After a test run: its time, against your best here and the blue bean's. */
export function TestResultCard({
  wobble,
  time,
  splats,
  best,
  improved,
  onAgain,
  onDone,
}: {
  wobble: WobbleDay
  time: number
  splats: number
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
      className="game-card wobblerun-test"
      style={afterRunStyle()}
      role="dialog"
      aria-label={`${wobble.name}: ${formatRun(time)}`}
      onPointerDown={holdPress}
    >
      <div className="game-card__head">
        <span className="game-card__kicker">
          Test run · #{wobble.n} {wobble.name}
        </span>
        <h2 className="game-card__title game-card__title--big">{formatRun(time)}</h2>
        <p className="game-card__blurb">
          {againstBlue(time, wobble.pace)}, with {splatWords(splats)}.
        </p>
      </div>
      <div className="game-pause-meta">
        <Row label="Your best here">{improved ? 'This run' : formatRun(best)}</Row>
        <Row label="Blue bean">{formatRun(wobble.pace)}</Row>
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
          Run it again
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
      <GauntletNav n={wobble.n} />
    </div>
  )
}

/**
 * The test course's start card (?lab=1, an admin's, from the Gauntlet Book): every built round at T1, T2 and T3 in
 * a row, to play on a phone before any goes into a day's gauntlet. Nothing here is saved, and there's no blue bean
 * to race.
 */
export function LabStartCard({ rounds, best }: { rounds: readonly string[]; best: number | null }) {
  const names = rounds.length > 1 ? `${rounds.slice(0, -1).join(', ')} and ${rounds[rounds.length - 1]}` : (rounds[0] ?? 'the rounds')
  return (
    <div ref={fitCardToSpace} className="game-card game-card--start wobblerun-test" style={gameAccentStyle(SLUG)}>
      <div className="game-card__head">
        <span className="game-card__kicker">Test course · every round</span>
        <h2 className="game-card__title game-card__title--big">Test Course</h2>
        <p className="game-card__blurb">
          {names}, each at all three tiers, gentle to spicy. A checkpoint before each, so a splat costs only that round. Runs here aren’t
          saved anywhere.
        </p>
      </div>
      <GamePanelBody
        slug={SLUG}
        personalBest={0}
        hideBest
        hideRecord
        extraMeta={
          <>
            <Row label="Rounds">{rounds.length}</Row>
            <Row label="Your best here">{best != null ? formatRun(best) : '–'}</Row>
          </>
        }
      />
      <button type="button" className="panel__btn game-card__start">
        Start
      </button>
      <LabNav />
    </div>
  )
}

/** After a run of the test course: its time and splats, and your best here. Not saved. */
export function LabResultCard({
  time,
  splats,
  best,
  improved,
  onAgain,
  onDone,
}: {
  time: number
  splats: number
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
      className="game-card wobblerun-test"
      style={afterRunStyle()}
      role="dialog"
      aria-label={`Test course: ${formatRun(time)}`}
      onPointerDown={holdPress}
    >
      <div className="game-card__head">
        <span className="game-card__kicker">Test course · every round</span>
        <h2 className="game-card__title game-card__title--big">{formatRun(time)}</h2>
        <p className="game-card__blurb">All the way to the crown, with {splatWords(splats)}.</p>
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
          Run it again
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
      <LabNav />
    </div>
  )
}
