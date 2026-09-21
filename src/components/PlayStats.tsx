import type { ReactNode } from 'react'

/**
 * The run's state, under the score, as labelled figures rather than a sentence.
 *
 * Every game had been formatting its own second line — "3 · 2 lives", "3 lives
 * · L2", "24 long · L3" — so they read as prose, differed from each other, and
 * gave the eye nothing to land on: no game's number sat where another's did.
 *
 * These are the same figures the start card uses for Your best and All time: a
 * small uppercase label over the value, in columns. Whatever a game chooses to
 * show, it now looks like every other game showing it, and a glance finds the
 * number by position instead of by reading.
 */
export function PlayReadoutStats({ children }: { children: ReactNode }) {
  return <div className="play-stats">{children}</div>
}

export function PlayStat({
  label,
  value,
  /** Running out — the value takes the game's warning colour. */
  urgent,
}: {
  label: string
  value: ReactNode
  urgent?: boolean
}) {
  return (
    <div className="play-stat">
      <span className="play-stat__label">{label}</span>
      <strong className={`play-stat__value${urgent ? ' play-stat__value--urgent' : ''}`}>
        {value}
      </strong>
    </div>
  )
}
