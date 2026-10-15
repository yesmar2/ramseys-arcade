import { gameHref, gamePlayHref } from '../hooks/useHashRoute'
import { dailyWords } from '../lib/dailyWords'
import { PlayIcon } from './chromeIcons'
import { CheckIcon } from './DayTicket'
import { GameArt } from './GameArt'
import type { Punch } from './todayPunches'
import '../styles/alsoToday.css'

/*
 * The day's puzzles, under the races (Ramsey picked B from the "Dailies: races only?" canvas, 2026-10-06): Ace
 * Chase's hole, Find the Bug's Wanted and Half Full's pour, still new every day and the same for everyone, but
 * just for fun, so they're off the ticket: they keep no streak and make no Full ticket (lib/today.ts
 * alsoDailies). Each opens its game's page, and its way in its game; done, how it went. Under the ticket on
 * the Dailies page; `compact`, a slim line; and `look="tile"`, a tile of the home page's wall, taking the rest
 * of the floor's last row (GameWall.tsx).
 */
export function AlsoToday({ punches, compact = false, look }: { punches: readonly Punch[]; compact?: boolean; look?: 'tile' }) {
  if (!punches.length) return null
  const tile = look === 'tile'
  const titleId = tile ? 'also-wall-title' : compact ? 'also-home-title' : 'also-title'
  return (
    <section className={`also${compact ? ' also--compact' : ''}${tile ? ' also--tile' : ''}`} aria-labelledby={titleId}>
      <div className="also__head">
        <h2 id={titleId} className="also__title">
          Also today
        </h2>
        <p className="also__sub">{tile ? 'Daily puzzles, just for fun' : 'Daily puzzles, just for fun. They don’t count toward your streak.'}</p>
      </div>
      <ul className="also__list">
        {punches.map((p) => {
          const verb = p.carry ? 'Carry on' : dailyWords(p.slug).verb
          return (
            <li key={p.key} className={`also__item${p.done ? ' also__item--done' : ''}`}>
              <a className="also__pic" href={gameHref(p.slug)} tabIndex={-1} aria-hidden="true">
                <GameArt slug={p.slug} className="also__art" />
              </a>
              <span className="also__text">
                <a className="also__game" href={gameHref(p.slug)} title={p.kicker}>
                  {p.game}
                </a>
                <span className="also__course">{p.title}</span>
              </span>
              {p.done ? (
                <span className="also__result">
                  <CheckIcon />
                  <span className="visually-hidden">Done: </span>
                  {p.short ?? 'Done'}
                </span>
              ) : (
                <a className="also__go" href={gamePlayHref(p.slug)} title={p.carry ?? undefined} aria-label={`${verb} ${p.game}`}>
                  <PlayIcon />
                  {verb}
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
