import type { ReactNode } from 'react'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import { PLACE_NAME, type TodaysHole } from '../../lib/dailyHole'

/*
 * A day's hole on trial, ahead of its day (/games/acechase/play?hole=day:YYYY-MM-DD): the card it opens
 * on, and the one a bullseye brings up. Nothing about a trial is kept; the admin's Hole Book links here,
 * to try a day out before it comes.
 */

const dayWords = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })

/** "Hole #9 · Thu, Oct 3", for the day a trial is ahead of. */
function kicker(hole: TodaysHole): string {
  return `Hole #${hole.n} · ${dayWords.format(new Date(`${hole.day}T12:00:00Z`))} · on trial`
}

const SLUG = 'acechase'

function Card({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      className="game-card acechase-daily"
      style={gameAccentStyle(SLUG)}
      role="dialog"
      aria-label={label}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

export function TrialStartCard({ hole, onStart }: { hole: TodaysHole; onStart: () => void }) {
  const def = hole.def
  return (
    <Card label={`${def.name}, on trial`}>
      <div className="game-card__head">
        <span className="game-card__kicker">{kicker(hole)}</span>
        <h2 className="game-card__title game-card__title--big">{def.name}</h2>
        <p className="game-card__blurb">
          On {PLACE_NAME[hole.pick.style]}. {def.note}
        </p>
      </div>
      <p className="acechase-daily__rules">
        This day&rsquo;s hole, ahead of its day. One putt a try, as many tries as it takes; Skip ahead shows where a
        putt ends. Nothing here is kept.
      </p>
      <div className="game-card__actions">
        <button type="button" className="panel__btn" onClick={onStart}>
          Start
        </button>
      </div>
    </Card>
  )
}

export function TrialResultCard({
  hole,
  tries,
  onAgain,
  onLeave,
}: {
  hole: TodaysHole
  tries: number
  onAgain: () => void
  onLeave: () => void
}) {
  const title = tries === 1 ? 'First try!' : `Bullseye in ${tries}`
  return (
    <Card label={`${hole.def.name}: ${title}`}>
      <div className="game-card__head">
        <span className="game-card__kicker">{kicker(hole)}</span>
        <h2 className="game-card__title game-card__title--big">{title}</h2>
        <p className="game-card__blurb">{hole.def.name}.</p>
      </div>
      <div className="game-card__actions">
        <button type="button" className="panel__btn" onClick={onAgain}>
          Play it again
        </button>
        <button type="button" className="panel__btn panel__btn--ghost" onClick={onLeave}>
          Back to Ace Chase
        </button>
      </div>
    </Card>
  )
}
