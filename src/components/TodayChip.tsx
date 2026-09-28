import { useEffect, useState } from 'react'
import { goToToday, subscribeToday, todayHref, todayServer, type TodayServer } from '../lib/today'
import '../styles/today.css'

/*
 * The Today set in the header (lib/today.ts): the streak and how much of today's ticket is punched, one
 * tap from the card on the home page, from anywhere. Signed in with a tag only: a streak is kept by an
 * account.
 */

export const FlameIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3c.6 3.2 4.8 5.3 4.8 10.1A4.8 4.8 0 0 1 12 18a4.8 4.8 0 0 1-4.8-4.9c0-2.1 1-3.6 2.2-4.8.3 1.9 1.3 3 2.4 3.2C11 9.2 11.4 5.7 12 3z" />
    <path d="M12 21a7 7 0 0 0 7-7" />
  </svg>
)

export function TodayChip() {
  const [state, setState] = useState<TodayServer | null>(todayServer)
  useEffect(() => subscribeToday(() => setState(todayServer())), [])
  if (!state) return null
  const done = Object.values(state.done).filter(Boolean).length
  const streak = state.streak.current
  const all = done === 3
  const label = `Today: ${done} of 3 done${streak > 0 ? `, streak ${streak} ${streak === 1 ? 'day' : 'days'}` : ''}`
  return (
    <a className={`today-chip${all ? ' today-chip--all' : ''}`} href={todayHref()} onClick={goToToday} aria-label={label}>
      <FlameIcon />
      <span className="today-chip__word">Today</span>
      {streak > 0 ? <span className="today-chip__day">Day {streak}</span> : null}
      <span className="today-chip__count">
        {done}/3
      </span>
    </a>
  )
}
