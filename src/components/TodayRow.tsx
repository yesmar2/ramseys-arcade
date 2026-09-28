import type { CSSProperties } from 'react'
import { gamePlayHref, todayHref } from '../hooks/useHashRoute'
import { useAccountId } from '../hooks/useAccountId'
import { useAuth } from '../hooks/useAuth'
import { GameArt } from './GameArt'
import { FlameIcon, StarIcon } from './TodayChip'
import { shortDate, useTicket } from './todayPunches'
import '../styles/today.css'

/*
 * Today on the home page (lib/today.ts): today's ticket in a row, the way to the Today page, where the
 * ticket itself is with your days, the streak's rewards and your friends' day. The day, and signed in the
 * streak as the header's chip draws it; how many of the day's dailies are done; each of them a small punch
 * that opens its game, with its result once there is one; and Open today. It's drawn from the same punches
 * as the ticket (todayPunches.ts), for the same viewer, so the two always agree. On a phone it stacks: the
 * day and the count, the punches across, and Open today under them.
 */

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.2 4.2L19 7" />
  </svg>
)
const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 5l7 7-7 7" />
  </svg>
)

export function TodayRow() {
  const { signedIn } = useAuth()
  // Who's looking: each punch is theirs, and never another account's that played on this device.
  const viewer = useAccountId()
  const { day, punches, server, done, total, marks, current } = useTicket(viewer)
  if (!total) return null
  // The streak is the API's, once it has answered; none yet is left unsaid, as on the chip.
  const streak = signedIn && server && current > 0 ? current : null
  return (
    <section className="home-today" aria-labelledby="home-today-title">
      <div className="home-today__day">
        <h2 id="home-today-title" className="home-today__title">
          Today
        </h2>
        <span className="home-today__date">{shortDate(day)}</span>
        <span className="home-today__stand">
          {streak ? (
            <span className={`home-today__streak${marks.full ? ' home-today__streak--full' : ''}`}>
              {marks.full ? <StarIcon /> : <FlameIcon />}
              Day {streak}
            </span>
          ) : null}
          <span className="home-today__count">
            {done} of {total} done
          </span>
        </span>
      </div>
      <ul className="home-today__punches" style={{ '--n': total } as CSSProperties}>
        {punches.map((p) => (
          <li key={p.key}>
            <a
              className={`home-today__punch${p.done ? ' home-today__punch--done' : ''}`}
              href={gamePlayHref(p.slug)}
              // Said as it's seen (Bugs, Play), then the game and the rest, so a spoken "click Bugs" finds it.
              aria-label={`${p.label} ${p.done ? (p.short ?? 'Done') : p.carry ? 'Carry on' : 'Play'}, ${p.game}${p.done ? `, punched${p.mine ? `, ${p.mine}` : ''}` : p.carry ? `, ${p.carry}` : ''}`}
            >
              <span className="home-today__art" aria-hidden="true">
                <GameArt slug={p.slug} className="home-today__scene" />
                {p.done ? (
                  <span className="home-today__check">
                    <CheckIcon />
                  </span>
                ) : null}
              </span>
              <span className="home-today__label" aria-hidden="true">
                {p.label}
              </span>
              <span className="home-today__state" aria-hidden="true">
                {p.done ? (p.short ?? 'Done') : p.carry ? 'Carry on' : 'Play'}
              </span>
            </a>
          </li>
        ))}
      </ul>
      <a className="home-today__open" href={todayHref()}>
        Open today
        <ChevronIcon />
      </a>
    </section>
  )
}
