import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { GamePanelBody } from '../../components/PauseControls'
import { useDeliberatePress } from '../../hooks/useDeliberatePress'
import { adminHref } from '../../hooks/useHashRoute'
import { fitCardToSpace } from '../../lib/cardFit'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import { caveDay, dayOfCave, PLANNED_CAVES } from './daily'
import { caveRunHref } from './links'
import type { LanderDay } from './runs'
import { crashWords, formatRun } from './score'

/*
 * The cards of an admin's test flight (/games/lander/play?day=YYYY-MM-DD for today's cave or one still to
 * come, from the admin's Cave Book): the one it opens on, and the one after a run. A test flight is for flying
 * a cave before its day: its runs go on no board and aren't kept past the tab. Only an admin gets one
 * (LanderGame); anyone else asking is sent to today's cave. A past day's cave is practice, on its own cards
 * (PracticeCards.tsx).
 */

const SLUG = 'lander'

const holdPress = (e: ReactPointerEvent) => e.stopPropagation()

/** "Today's cave", "Comes Thu, Oct 1". */
function whenWords(day: string) {
  if (day === caveDay()) return 'Today’s cave'
  const date = new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
  return `Comes ${date}`
}

/** The caves either side, and the way back to the book. A tap here isn't a tap to start. */
function CaveNav({ n }: { n: number }) {
  return (
    <nav className="lander-test__nav" aria-label="Other caves">
      {n > 1 ? (
        <a href={caveRunHref(dayOfCave(n - 1))} onPointerDown={holdPress}>
          ‹ #{n - 1}
        </a>
      ) : (
        <span />
      )}
      <a href={adminHref('caves')} onPointerDown={holdPress}>
        Cave Book
      </a>
      {n < PLANNED_CAVES ? (
        <a href={caveRunHref(dayOfCave(n + 1))} onPointerDown={holdPress}>
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

/** A test flight's start card: like the game's own, it starts on a tap anywhere but its links. */
export function TestStartCard({ lander, best }: { lander: LanderDay; best: number | null }) {
  return (
    <div ref={fitCardToSpace} className="game-card game-card--start lander-test" style={gameAccentStyle(SLUG)}>
      <div className="game-card__head">
        <span className="game-card__kicker">
          Test flight · cave {lander.n} of {PLANNED_CAVES}
        </span>
        <h2 className="game-card__title game-card__title--big">{lander.name}</h2>
        <p className="game-card__blurb">
          {whenWords(lander.day)}. Runs here aren’t saved: they go on no board, and your best here is gone when you close the tab.
        </p>
      </div>
      <GamePanelBody
        slug={SLUG}
        personalBest={0}
        hideBest
        hideRecord
        extraMeta={
          <>
            <Row label="Blue ship">{formatRun(lander.pace)}</Row>
            <Row label="Your best here">{best != null ? formatRun(best) : '–'}</Row>
          </>
        }
      />
      <button type="button" className="panel__btn game-card__start">
        Start
      </button>
      <CaveNav n={lander.n} />
    </div>
  )
}

/** The things in the test cave, top to bottom, as its start card lists them. */
const LAB_THINGS = [
  'Steam vents: a cushion down the first shaft, a lift up the chimney, when they’re blowing',
  'Crushers: two slam the corridor shut, out of step',
  'A turning bar in the tall chamber',
  'Water in the dip: you float and drag, so dive under',
  'Low gravity in the hall',
  'A lava floor under a hanging rock: touch it and you crash',
  'A fork: the long way round, or the narrow crooked shaft',
  'The landing pad rides a lift',
]

/** The test cave's start card: what's in it, and that nothing here is kept. It starts on a tap anywhere but its links. */
export function LabStartCard({ best }: { best: number | null }) {
  return (
    <div ref={fitCardToSpace} className="game-card game-card--start lander-test" style={gameAccentStyle(SLUG)}>
      <div className="game-card__head">
        <span className="game-card__kicker">Test cave · new obstacles</span>
        <h2 className="game-card__title game-card__title--big">Test Cave</h2>
        <p className="game-card__blurb">Every new thing, in order, a gate before each. Runs here aren’t saved.</p>
      </div>
      <ul className="lander-test__list">
        {LAB_THINGS.map((thing) => (
          <li key={thing}>{thing}</li>
        ))}
      </ul>
      <div className="game-pause-meta">
        <Row label="Your best here">{best != null ? formatRun(best) : '–'}</Row>
      </div>
      <button type="button" className="panel__btn game-card__start">
        Start
      </button>
      <nav className="lander-test__nav" aria-label="Back">
        <span />
        <a href={adminHref('caves')} onPointerDown={holdPress}>
          Cave Book
        </a>
        <span />
      </nav>
    </div>
  )
}

/** After a flight down the test cave: its time and crashes, against your best here. */
export function LabResultCard({
  time,
  crashes,
  best,
  improved,
  onAgain,
  onDone,
}: {
  time: number
  crashes: number
  best: number
  improved: boolean
  onAgain: () => void
  onDone: () => void
}) {
  const allow = useDeliberatePress()
  return (
    <div ref={fitCardToSpace} className="game-card lander-test" style={gameAccentStyle(SLUG)} role="dialog" aria-label={`Test Cave: ${formatRun(time)}`} onPointerDown={holdPress}>
      <div className="game-card__head">
        <span className="game-card__kicker">Test cave · new obstacles</span>
        <h2 className="game-card__title game-card__title--big">{formatRun(time)}</h2>
        <p className="game-card__blurb">Down, with {crashWords(crashes)}.</p>
      </div>
      <div className="game-pause-meta">
        <Row label="Your best here">{improved ? 'This run' : formatRun(best)}</Row>
      </div>
      <p className="game-card__hint">The test cave: not saved.</p>
      <div className="game-card__actions">
        <button
          type="button"
          className="panel__btn"
          onClick={(e) => {
            if (allow(e)) onAgain()
          }}
        >
          Fly it again
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

/** After a test flight: its time, against your best here and the blue ship's. */
export function TestResultCard({
  lander,
  time,
  crashes,
  best,
  improved,
  onAgain,
  onDone,
}: {
  lander: LanderDay
  time: number
  crashes: number
  best: number
  improved: boolean
  onAgain: () => void
  onDone: () => void
}) {
  // It opens as the run ends: the run's last presses don't reach its buttons.
  const allow = useDeliberatePress()
  const gap = time - lander.pace
  const against = Math.abs(gap) < 0.005 ? 'Tied with the blue ship' : gap < 0 ? `Beat the blue ship by ${(-gap).toFixed(2)}s` : `${gap.toFixed(2)}s behind the blue ship`
  return (
    <div
      ref={fitCardToSpace}
      className="game-card lander-test"
      style={gameAccentStyle(SLUG)}
      role="dialog"
      aria-label={`${lander.name}: ${formatRun(time)}`}
      onPointerDown={holdPress}
    >
      <div className="game-card__head">
        <span className="game-card__kicker">
          Test flight · #{lander.n} {lander.name}
        </span>
        <h2 className="game-card__title game-card__title--big">{formatRun(time)}</h2>
        <p className="game-card__blurb">
          {against}, with {crashWords(crashes)}.
        </p>
      </div>
      <div className="game-pause-meta">
        <Row label="Your best here">{improved ? 'This run' : formatRun(best)}</Row>
        <Row label="Blue ship">{formatRun(lander.pace)}</Row>
      </div>
      <p className="game-card__hint">A test flight: not saved.</p>
      <div className="game-card__actions">
        <button
          type="button"
          className="panel__btn"
          onClick={(e) => {
            if (allow(e)) onAgain()
          }}
        >
          Fly it again
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
      <CaveNav n={lander.n} />
    </div>
  )
}
