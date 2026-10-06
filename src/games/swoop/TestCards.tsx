import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { GamePanelBody } from '../../components/PauseControls'
import { useDeliberatePress } from '../../hooks/useDeliberatePress'
import { adminHref } from '../../hooks/useHashRoute'
import { fitCardToSpace } from '../../lib/cardFit'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import { dayOfHills, hillsDay, PLANNED_HILLS } from './daily'
import { hillsRunHref } from './links'
import type { SwoopDay } from './runs'
import { cleanWords, formatRun } from './score'

/*
 * The cards of an admin's test run (/games/swoop/play?day=YYYY-MM-DD for today's hills or some still to come,
 * from the admin's Hills Book): the one it opens on, and the one after a run. A test run is for flying hills
 * before their day: its runs go on no board and aren't kept past the tab. Only an admin gets one (SwoopGame);
 * anyone else asking is sent to today's hills. A past day's hills are practice, on their own cards
 * (PracticeCards.tsx).
 */

const SLUG = 'swoop'

const holdPress = (e: ReactPointerEvent) => e.stopPropagation()

/** "Today's hills", "Come Thu, Oct 8". */
function whenWords(day: string) {
  if (day === hillsDay()) return 'Today’s hills'
  const date = new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
  return `Come ${date}`
}

/** The hills either side, and the way back to the book. A tap here isn't a tap to start. */
function HillsNav({ n }: { n: number }) {
  return (
    <nav className="swoop-test__nav" aria-label="Other hills">
      {n > 1 ? (
        <a href={hillsRunHref(dayOfHills(n - 1))} onPointerDown={holdPress}>
          ‹ #{n - 1}
        </a>
      ) : (
        <span />
      )}
      <a href={adminHref('hills')} onPointerDown={holdPress}>
        Hills Book
      </a>
      {n < PLANNED_HILLS ? (
        <a href={hillsRunHref(dayOfHills(n + 1))} onPointerDown={holdPress}>
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
export function TestStartCard({ swoop, best }: { swoop: SwoopDay; best: number | null }) {
  return (
    <div ref={fitCardToSpace} className="game-card game-card--start swoop-test" style={gameAccentStyle(SLUG)}>
      <div className="game-card__head">
        <span className="game-card__kicker">
          Test run · hills {swoop.n} of {PLANNED_HILLS}
        </span>
        <h2 className="game-card__title game-card__title--big">{swoop.name}</h2>
        <p className="game-card__blurb">
          {whenWords(swoop.day)}. Runs here aren’t saved: they go on no board, and your best here is gone when you close the tab.
        </p>
      </div>
      <GamePanelBody
        slug={SLUG}
        personalBest={0}
        hideBest
        hideRecord
        extraMeta={
          <>
            <Row label="Blue bird">{formatRun(swoop.pace)}</Row>
            <Row label="Your best here">{best != null ? formatRun(best) : '–'}</Row>
          </>
        }
      />
      <button type="button" className="panel__btn game-card__start">
        Start
      </button>
      <HillsNav n={swoop.n} />
    </div>
  )
}

/** After a test run: its time, against your best here and the blue bird's. */
export function TestResultCard({
  swoop,
  time,
  clean,
  best,
  improved,
  onAgain,
  onDone,
}: {
  swoop: SwoopDay
  time: number
  clean: number
  best: number
  improved: boolean
  onAgain: () => void
  onDone: () => void
}) {
  // It opens as the run ends: the run's last presses don't reach its buttons.
  const allow = useDeliberatePress()
  const gap = time - swoop.pace
  const against = Math.abs(gap) < 0.005 ? 'Tied with the blue bird' : gap < 0 ? `Beat the blue bird by ${(-gap).toFixed(2)}s` : `${gap.toFixed(2)}s behind the blue bird`
  return (
    <div
      ref={fitCardToSpace}
      className="game-card swoop-test"
      style={gameAccentStyle(SLUG)}
      role="dialog"
      aria-label={`${swoop.name}: ${formatRun(time)}`}
      onPointerDown={holdPress}
    >
      <div className="game-card__head">
        <span className="game-card__kicker">
          Test run · #{swoop.n} {swoop.name}
        </span>
        <h2 className="game-card__title game-card__title--big">{formatRun(time)}</h2>
        <p className="game-card__blurb">
          {against}, with {cleanWords(clean)}.
        </p>
      </div>
      <div className="game-pause-meta">
        <Row label="Your best here">{improved ? 'This run' : formatRun(best)}</Row>
        <Row label="Blue bird">{formatRun(swoop.pace)}</Row>
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
          Swoop it again
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
