import { useEffect, useState, type ReactNode } from 'react'
import '../styles/tomorrowTease.css'

/*
 * Tomorrow's course on a racing daily's report: its picture from above, its number and name, and when it
 * opens, so the end of today's run points at the next one. Ramsey picked it (2026-10-05) from ideas to bring
 * players back to Hot Lap, Marble Run and Lander. It sits under the way on to the next of today's dailies.
 * It can't be played before its day; seeing its shape a day early tells nobody how to drive it.
 */
export function TomorrowTease({
  noun,
  n,
  name,
  picture,
  msLeft,
  words,
}: {
  /** "track", "course" or "cave". */
  noun: string
  n: number
  name: string
  /** Its picture from above, filling a wide box. */
  picture: ReactNode
  /** Until it opens, now. */
  msLeft: () => number
  /** "7h 12m": the game's own way of saying how long. */
  words: (ms: number) => string
}) {
  const [left, setLeft] = useState(() => msLeft())
  useEffect(() => {
    const timer = window.setInterval(() => setLeft(msLeft()), 20_000)
    return () => window.clearInterval(timer)
  }, [msLeft])
  return (
    <div className="tomorrow-tease">
      <span className="tomorrow-tease__pic" aria-hidden="true">
        {picture}
      </span>
      <span className="tomorrow-tease__text">
        <span className="tomorrow-tease__kicker">
          Tomorrow · {noun} #{n}
        </span>
        <span className="tomorrow-tease__title">{name}</span>
        <span className="tomorrow-tease__sub">Opens in {words(left)}</span>
      </span>
    </div>
  )
}
