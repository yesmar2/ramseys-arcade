import { useEffect, useId, useRef, useState } from 'react'
import { plusHref } from '../hooks/useHashRoute'
import { withRace } from '../lib/raceGhost'
import '../styles/raceGhost.css'

/*
 * A board row's Race button (race any ghost, lib/raceGhost.ts): it opens the game on that course with the
 * row's run as the ghost. The #1's is anyone's, and so is any run for a Plus member; for anyone else it opens a
 * small card saying what racing them is and the way to Plus. Your own row has an empty slot, so the columns
 * stay lined up.
 */
export function RaceGhostButton({
  playHref,
  name,
  time,
  gap,
  needsPlus,
  mine = false,
}: {
  /** The course's play link. */
  playHref: string
  name: string
  /** Their time, as the board shows it. */
  time: string
  /** How much quicker than yours, in words, when you have a time: "5.85s". */
  gap?: string | null
  needsPlus: boolean
  mine?: boolean
}) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLSpanElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', key)
    }
  }, [open])
  if (mine) return <span className="gb-row__race" aria-hidden="true" />
  if (!needsPlus) {
    return (
      <span className="gb-row__race">
        <a className="rg-btn" href={withRace(playHref, name)} aria-label={`Race ${name}’s ghost`}>
          Race
        </a>
      </span>
    )
  }
  return (
    <span className="gb-row__race" ref={boxRef}>
      <button type="button" className="rg-btn rg-btn--plus" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        Race
      </button>
      {open ? (
        <span id={id} className="rg-pop" role="dialog" aria-label={`Race ${name}’s ghost`}>
          <b className="rg-pop__title">
            Race {name}’s {time}
          </b>
          <span className="rg-pop__words">
            Their whole run, as a ghost beside you: see where they go faster.{gap ? ` ${gap} quicker than yours.` : ''}
          </span>
          <a className="rg-pop__go" href={plusHref()}>
            Race with Plus
          </a>
          <span className="rg-pop__free">The #1 and your next place up are free.</span>
        </span>
      ) : null}
    </span>
  )
}
