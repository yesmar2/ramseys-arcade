import { useEffect, useState } from 'react'
import { todayHref } from '../hooks/useHashRoute'
import { dayMarks, liveDailies, subscribeToday, todayRule, todayServer, type TodayServer } from '../lib/today'
import '../styles/today.css'

/*
 * The Today set in the header (lib/today.ts): the streak and how today's ticket stands, and the way to the
 * Today page from anywhere, marked as where you are while you're on it. It counts the day's dailies done of
 * all of them ("2/5"), lights up once enough are done to keep the streak, and says "Full" when every one is.
 * Signed in with a tag only: a streak is kept by an account.
 */

export const FlameIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3c.6 3.2 4.8 5.3 4.8 10.1A4.8 4.8 0 0 1 12 18a4.8 4.8 0 0 1-4.8-4.9c0-2.1 1-3.6 2.2-4.8.3 1.9 1.3 3 2.4 3.2C11 9.2 11.4 5.7 12 3z" />
    <path d="M12 21a7 7 0 0 0 7-7" />
  </svg>
)

/** A Full ticket's star, on the chip and in the week. */
export const StarIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 3.2l2.6 5.5 6 .8-4.4 4.1 1.1 5.9L12 16.6l-5.3 2.9 1.1-5.9L3.4 9.5l6-.8z" />
  </svg>
)

export function TodayChip({ here }: { here: boolean }) {
  const [state, setState] = useState<TodayServer | null>(todayServer)
  useEffect(() => subscribeToday(() => setState(todayServer())), [])
  if (!state) return null
  // Only today's live dailies count: an API from before Today's Pour has no word on it.
  const live = liveDailies(state.day, state)
  const rule = todayRule(live.length)
  const done = live.filter((d) => state.done[d.key]).length
  const marks = dayMarks(done, rule)
  const full = state.full ?? marks.full
  const streak = state.streak.current
  const count = full ? 'Full' : `${done}/${rule.count}`
  const said = full ? 'a Full ticket' : `${done} of ${rule.count} done${marks.kept ? ', the day kept' : ''}`
  const label = `Today: ${said}${streak > 0 ? `, streak ${streak} ${streak === 1 ? 'day' : 'days'}` : ''}`
  return (
    <a
      className={`today-chip${full ? ' today-chip--full' : marks.kept ? ' today-chip--all' : ''}${here ? ' today-chip--here' : ''}`}
      href={todayHref()}
      aria-current={here ? 'page' : undefined}
      aria-label={label}
    >
      {full ? <StarIcon /> : <FlameIcon />}
      <span className="today-chip__word">Today</span>
      {streak > 0 ? <span className="today-chip__day">Day {streak}</span> : null}
      <span className="today-chip__count">{count}</span>
    </a>
  )
}
