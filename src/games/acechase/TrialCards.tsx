import type { ReactNode } from 'react'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import { dailyDay, PLACE_NAME, type TodaysHole } from '../../lib/dailyHole'

/*
 * A day's hole played as practice (/games/acechase/play?hole=day:YYYY-MM-DD): a past day's from the
 * archive, or one ahead of its day from the admin's Hole Book. The card it opens on, and the one a
 * bullseye brings up. Nothing about it is kept.
 */

/** A past day's, from the archive, rather than one ahead of its day. */
const isPast = (hole: TodaysHole) => hole.day < dailyDay()

const dayWords = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })

/** "Hole #9 · Thu, Oct 3 · from the archive", for the day it was, or is to be. */
function kicker(hole: TodaysHole): string {
  return `Hole #${hole.n} · ${dayWords.format(new Date(`${hole.day}T12:00:00Z`))} · ${isPast(hole) ? 'from the archive' : 'on trial'}`
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
        {isPast(hole) ? 'A past day’s hole, to play again.' : 'This day’s hole, ahead of its day.'} One putt a try, as many
        tries as it takes; Skip ahead shows where a putt ends. Nothing here is kept, so it counts for no board or tickets.
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
          {isPast(hole) ? 'Back to the archive' : 'Back to Ace Chase'}
        </button>
      </div>
    </Card>
  )
}
