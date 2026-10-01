import type { TodayFreezes } from '../lib/today'
import { InfoTip } from './InfoTip'
import { FreezeIcon } from './TodayChip'
import '../styles/streakFreezes.css'

/*
 * The streak freezes a player holds, beside their streak on the Dailies page: on the ticket's stub and in
 * the page's head (the stub is gone on a phone). A snowflake for each that can be held, lit for each held,
 * and how many; Ramsey picked it over a chip and a meter (2026-10-01). A freeze covers a day missed, so the
 * streak goes on without counting it; one comes with every 7 days kept in a row, and 2 are held at most (the
 * API's today.ts walkStreak). The tip says all that, and when the next one comes.
 */

const WORD = ['No', 'One', 'Two', 'Three']

export function StreakFreezes({ freezes, className = '' }: { freezes: TodayFreezes; className?: string }) {
  const { held, max, every, next } = freezes
  const heldWords = held === 0 ? 'No freezes yet' : `${WORD[held] ?? held} ${held === 1 ? 'freeze' : 'freezes'}`
  const nextWords =
    held >= max
      ? `You hold the most there can be, ${WORD[max]?.toLowerCase() ?? max}.`
      : `The next one comes after ${next} more ${next === 1 ? 'day' : 'days'} kept.`
  return (
    <InfoTip
      className={`sfz${held > 0 ? ' sfz--held' : ''}${className ? ` ${className}` : ''}`}
      tipClassName="sfz-tip"
      description={`Streak freezes: ${heldWords.toLowerCase()} held. A freeze covers a day you miss, so your streak goes on. You earn one for every ${every} days in a row, and hold up to ${max}. ${nextWords}`}
      trigger={
        <>
          <span className="sfz__flakes" aria-hidden="true">
            {Array.from({ length: max }, (_, i) => (
              <span key={i} className={i < held ? 'sfz__flake sfz__flake--on' : 'sfz__flake'}>
                <FreezeIcon />
              </span>
            ))}
          </span>
          <span className="sfz__word">{heldWords}</span>
        </>
      }
    >
      <span className="sfz-tip__head">
        <FreezeIcon />
        Streak freezes
      </span>
      <span className="sfz-tip__lead">A freeze covers a day you miss, so your streak goes on. That day just doesn’t add to it.</span>
      <span className="sfz-tip__more">
        You earn one for every {every} days in a row, and hold up to {max}. {held > 0 ? `${heldWords} held now. ` : ''}
        {nextWords}
      </span>
    </InfoTip>
  )
}
