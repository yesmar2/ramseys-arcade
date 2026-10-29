import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { GamePanelBody } from '../../components/PauseControls'
import { useDeliberatePress } from '../../hooks/useDeliberatePress'
import { adminHref, gamePlayHref } from '../../hooks/useHashRoute'
import { fitCardToSpace } from '../../lib/cardFit'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import { dayOfTower, towerDay, PLANNED_TOWERS } from './daily'
import { towerRunHref } from './links'
import { LAB_DAY, type SlingDay } from './runs'
import { missWords, formatRun } from './score'
import { SetPlatinumRow } from '../../components/SetPlatinumRow'

/*
 * The cards of an admin's test run (/games/sling/play?day=YYYY-MM-DD for today's tower or some still to come,
 * from the admin's Tower Book): the one it opens on, and the one after a run. A test run is for flying tower
 * before their day: its runs go on no board and aren't kept past the tab. Only an admin gets one (SlingGame);
 * anyone else asking is sent to today's tower. A past day's tower are practice, on their own cards
 * (PracticeCards.tsx).
 */

const SLUG = 'sling'

const holdPress = (e: ReactPointerEvent) => e.stopPropagation()

/** "Today's tower", "Come Thu, Oct 8". */
function whenWords(day: string) {
  if (day === LAB_DAY) return 'Test tower, every section once: a new one each time you load the page'
  if (day === towerDay()) return 'Today’s tower'
  const date = new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
  return `Come ${date}`
}

/** The tower either side, and the way back to the book. A tap here isn't a tap to start. */
function TowerNav({ n }: { n: number }) {
  return (
    <nav className="sling-test__nav" aria-label="Other towers">
      {n > 1 ? (
        <a href={towerRunHref(dayOfTower(n - 1))} onPointerDown={holdPress}>
          ‹ #{n - 1}
        </a>
      ) : (
        <span />
      )}
      <a href={adminHref('towers')} onPointerDown={holdPress}>
        Tower Book
      </a>
      {n < PLANNED_TOWERS ? (
        <a href={towerRunHref(dayOfTower(n + 1))} onPointerDown={holdPress}>
          #{n + 1} ›
        </a>
      ) : (
        <span />
      )}
    </nav>
  )
}

/** Under the test tower' Start: the way back to the book, and new test tower (laid afresh as the page loads again). */
function LabNav() {
  return (
    <nav className="sling-test__nav" aria-label="Other towers">
      <span />
      <a href={adminHref('towers')} onPointerDown={holdPress}>
        Tower Book
      </a>
      <a
        href={`${gamePlayHref(SLUG)}?lab=1`}
        onPointerDown={holdPress}
        onClick={(e) => {
          e.preventDefault()
          window.location.reload()
        }}
      >
        New tower ›
      </a>
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
export function TestStartCard({ sling, best }: { sling: SlingDay; best: number | null }) {
  return (
    <div ref={fitCardToSpace} className="game-card game-card--start sling-test" style={gameAccentStyle(SLUG)}>
      <div className="game-card__head">
        <span className="game-card__kicker">{sling.day === LAB_DAY ? 'Test tower' : `Test run · tower ${sling.n} of ${PLANNED_TOWERS}`}</span>
        <h2 className="game-card__title game-card__title--big">{sling.name}</h2>
        <p className="game-card__blurb">
          {whenWords(sling.day)}. Runs here aren’t saved: they go on no board, and your best here is gone when you close the tab.
        </p>
      </div>
      <GamePanelBody
        slug={SLUG}
        personalBest={0}
        hideBest
        hideRecord
        extraMeta={
          <>
            <Row label="Blue blip">{formatRun(sling.pace)}</Row>
            <Row label="Your best here">{best != null ? formatRun(best) : '–'}</Row>
            {sling.day !== LAB_DAY ? <SetPlatinumRow game="sling" course={sling.n} pace={sling.pace} format={formatRun} /> : null}
          </>
        }
        primary={
          <button type="button" className="panel__btn game-card__start">
            Start
          </button>
        }
      />
      {sling.day === LAB_DAY ? <LabNav /> : <TowerNav n={sling.n} />}
    </div>
  )
}

/** After a test run: its time, against your best here and the blue blip's. */
export function TestResultCard({
  sling,
  time,
  misses,
  best,
  improved,
  onAgain,
  onDone,
}: {
  sling: SlingDay
  time: number
  misses: number
  best: number
  improved: boolean
  onAgain: () => void
  onDone: () => void
}) {
  // It opens as the run ends: the run's last presses don't reach its buttons.
  const allow = useDeliberatePress()
  const gap = time - sling.pace
  const against = Math.abs(gap) < 0.005 ? 'Tied with the blue blip' : gap < 0 ? `Beat the blue blip by ${(-gap).toFixed(2)}s` : `${gap.toFixed(2)}s behind the blue blip`
  return (
    <div
      ref={fitCardToSpace}
      className="game-card sling-test"
      style={gameAccentStyle(SLUG)}
      role="dialog"
      aria-label={`${sling.name}: ${formatRun(time)}`}
      onPointerDown={holdPress}
    >
      <div className="game-card__head">
        <span className="game-card__kicker">{sling.day === LAB_DAY ? `Test tower · ${sling.name}` : `Test run · #${sling.n} ${sling.name}`}</span>
        <h2 className="game-card__title game-card__title--big">{formatRun(time)}</h2>
        <p className="game-card__blurb">
          {against}, with {missWords(misses)}.
        </p>
      </div>
      <div className="game-pause-meta">
        <Row label="Your best here">{improved ? 'This run' : formatRun(best)}</Row>
        <Row label="Blue blip">{formatRun(sling.pace)}</Row>
        {sling.day !== LAB_DAY ? <SetPlatinumRow game="sling" course={sling.n} pace={sling.pace} ms={Math.round(time * 1000)} format={formatRun} /> : null}
      </div>
      <p className="game-card__note">A test run: on no board. Your best here sets platinum, half a second slower.</p>
      <div className="game-card__actions">
        <button
          type="button"
          className="panel__btn"
          onClick={(e) => {
            if (allow(e)) onAgain()
          }}
        >
          Sling it again
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
      {sling.day === LAB_DAY ? <LabNav /> : <TowerNav n={sling.n} />}
    </div>
  )
}
