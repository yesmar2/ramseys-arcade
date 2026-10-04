import type { ReactNode } from 'react'
import { dailyTabHref, plusHref } from '../../hooks/useHashRoute'
import { archiveDayWords, inArchive, OPEN_DAYS, useArchiveOpen } from '../../lib/archive'
import { dailyWords } from '../../lib/dailyWords'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import { PLUS_PRICE } from '../../lib/plans'
import { LockIcon } from '../chromeIcons'
import '../../styles/dailyPast.css'

/*
 * A daily's play page for a past day (lib/archive.ts): the last week's are everyone's, and older ones are
 * Plus's. Anyone else asking for one gets this card in the game's place: what the archive is, the way to
 * Plus, and the way back to the past tab. Until it's known who's signed in, nothing shows.
 */
export function ArchiveGate({
  slug,
  day,
  course,
  children,
}: {
  slug: string
  /** The past day asked for, YYYY-MM-DD; null for today's game, or a day still to come. */
  day: string | null
  /** The course on the past tab, for the way back to its card: a track's or hole's number, or the day. */
  course?: string | number
  children: ReactNode
}) {
  const open = useArchiveOpen()
  if (!day || !inArchive(day) || open === true) return <>{children}</>
  if (open === undefined) return null
  const words = dailyWords(slug)
  const back = dailyTabHref(slug, 'past', course ?? day)
  return (
    <div className="archive-gate" style={gameAccentStyle(slug)}>
      <div className="game-card past-card archive-gate__card" role="dialog" aria-labelledby="archive-gate-title">
        <div className="game-card__head">
          <span className="game-card__kicker">
            Past {words.course} · {archiveDayWords(day)}
          </span>
          <h2 id="archive-gate-title" className="game-card__title game-card__title--big">
            <span className="archive-gate__lock" aria-hidden="true">
              <LockIcon />
            </span>
            In the archive
          </h2>
        </div>
        <p className="archive-gate__lead">
          Anyone can play a daily’s last {OPEN_DAYS} days. Older days are for Plus members, as practice: nothing is saved,
          and they never count toward your rank.
        </p>
        <p className="archive-gate__also">Plus is {PLUS_PRICE}, with every season’s Pass+ too.</p>
        <div className="game-card__actions">
          <a className="panel__btn game-card__start" href={plusHref()}>
            See Plus
          </a>
          <a className="panel__btn panel__btn--ghost past-card__link" href={back}>
            Back to {words.pastTab.toLowerCase()}
          </a>
        </div>
      </div>
    </div>
  )
}
