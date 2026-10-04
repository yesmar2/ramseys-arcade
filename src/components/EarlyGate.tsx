import type { ReactNode } from 'react'
import { getGame } from '../data/games'
import { gameHref, plusHref } from '../hooks/useHashRoute'
import { archiveDayWords } from '../lib/archive'
import { plusFirstDay, useEarlyOpen } from '../lib/earlyAccess'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import { PLUS_PRICE } from '../lib/plans'
import { LockIcon } from './chromeIcons'
import '../styles/dailyPast.css'

/*
 * A game's play page while it's in early access (lib/earlyAccess.ts): Plus members and admins play it, and
 * anyone else gets this card in its place, saying the day it opens to everyone and the way to Plus. Until
 * it's known who's signed in, nothing shows.
 */
export function EarlyGate({ slug, children }: { slug: string; children: ReactNode }) {
  const open = useEarlyOpen()
  const day = plusFirstDay(slug)
  if (!day || open === true) return <>{children}</>
  if (open === undefined) return null
  const name = getGame(slug)?.name ?? slug
  return (
    <main className="game-page game-page--fullscreen">
      <div className="archive-gate" style={gameAccentStyle(slug)}>
        <div className="game-card past-card archive-gate__card" role="dialog" aria-labelledby="early-gate-title">
          <div className="game-card__head">
            <span className="game-card__kicker">Launches {archiveDayWords(day)}</span>
            <h2 id="early-gate-title" className="game-card__title game-card__title--big">
              <span className="archive-gate__lock" aria-hidden="true">
                <LockIcon />
              </span>
              {name}
            </h2>
          </div>
          <p className="archive-gate__lead">
            {name} launches for everyone on {archiveDayWords(day)}. Until then, Plus members can try it early, as practice: its
            boards open on launch day.
          </p>
          <p className="archive-gate__also">Plus is {PLUS_PRICE}, with every season’s Pass+ and every past daily too.</p>
          <div className="game-card__actions">
            <a className="panel__btn game-card__start" href={plusHref()}>
              See Plus
            </a>
            <a className="panel__btn panel__btn--ghost past-card__link" href={gameHref(slug)}>
              Back to {name}
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
