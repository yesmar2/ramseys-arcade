import type { ReactNode } from 'react'
import { getGame } from '../data/games'
import { gameHref, plusHref } from '../hooks/useHashRoute'
import { useAuth } from '../hooks/useAuth'
import { archiveDayWords } from '../lib/archive'
import { earlyFrom, earlyStage, launchDayOf, useEarlyOpen } from '../lib/earlyAccess'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import { PLUS_PRICE } from '../lib/plans'
import { LockIcon } from './chromeIcons'
import '../styles/dailyPast.css'

/*
 * A new game's play page before its launch day (lib/earlyAccess.ts): Plus members play it the week before,
 * admins any time, and anyone else gets this card in its place, saying when it launches and when Plus
 * members can play it. Until it's known who's signed in, nothing shows.
 */
export function EarlyGate({ slug, children }: { slug: string; children: ReactNode }) {
  const stage = earlyStage(slug)
  const open = useEarlyOpen(stage)
  const { isPlus } = useAuth()
  const launch = launchDayOf(slug)
  if (!launch || !stage || open === true) return <>{children}</>
  if (open === undefined) return null
  const name = getGame(slug)?.name ?? slug
  const when = archiveDayWords(launch)
  const early = archiveDayWords(earlyFrom(launch))
  let lead: string
  if (stage === 'early') lead = `Plus members are playing ${name} a week before it launches. Everyone can play it from ${when}.`
  else if (isPlus) lead = `${name} launches on ${when}. You’re on Plus, so you can play it a week early, from ${early}.`
  else lead = `${name} launches on ${when}. Plus members can play it a week early, from ${early}.`
  return (
    <main className="game-page game-page--fullscreen">
      <div className="archive-gate" style={gameAccentStyle(slug)}>
        <div className="game-card past-card archive-gate__card" role="dialog" aria-labelledby="early-gate-title">
          <div className="game-card__head">
            <span className="game-card__kicker">New game · launches {when}</span>
            <h2 id="early-gate-title" className="game-card__title game-card__title--big">
              <span className="archive-gate__lock" aria-hidden="true">
                <LockIcon />
              </span>
              {name}
            </h2>
          </div>
          <p className="archive-gate__lead">{lead}</p>
          {isPlus ? null : (
            <p className="archive-gate__also">Plus is {PLUS_PRICE}, with every season’s Pass+ and every past daily too.</p>
          )}
          <div className="game-card__actions">
            {isPlus ? null : (
              <a className="panel__btn game-card__start" href={plusHref()}>
                See Plus
              </a>
            )}
            <a className={`panel__btn${isPlus ? '' : ' panel__btn--ghost'} past-card__link`} href={gameHref(slug)}>
              Back to {name}
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
