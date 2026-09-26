import type { ReactNode } from 'react'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import type { HoleDef } from './physics'

/*
 * A hole on trial's two cards (/games/acechase/play?hole=<key>): the one it opens on, and the one a
 * bullseye brings up. Nothing about a trial is kept, and nothing links to one; it's for trying a hole
 * out before it goes in a round.
 */

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

export function TrialStartCard({ def, onStart }: { def: HoleDef; onStart: () => void }) {
  return (
    <Card label={`${def.name}, on trial`}>
      <div className="game-card__head">
        <span className="game-card__kicker">A hole on trial</span>
        <h2 className="game-card__title game-card__title--big">{def.name}</h2>
        <p className="game-card__blurb">{def.note}</p>
      </div>
      <p className="acechase-daily__rules">
        One putt a try, as many tries as it takes; Skip ahead shows where a putt ends. Nothing here is kept.
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
  def,
  tries,
  onAgain,
  onLeave,
}: {
  def: HoleDef
  tries: number
  onAgain: () => void
  onLeave: () => void
}) {
  const title = tries === 1 ? 'First try!' : `Bullseye in ${tries}`
  return (
    <Card label={`${def.name}: ${title}`}>
      <div className="game-card__head">
        <span className="game-card__kicker">A hole on trial</span>
        <h2 className="game-card__title game-card__title--big">{title}</h2>
        <p className="game-card__blurb">{def.name}.</p>
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
