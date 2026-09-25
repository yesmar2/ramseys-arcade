import type { ReactNode } from 'react'
import type { LeaderboardPeriod } from '../lib/leaderboard'
import { PlayerMark } from './PlayerMark'
import { PodiumMedal, medalKind } from './PodiumMedal'

export type ListRowProps = {
  rank: number
  name: string
  /** Where the name goes — a profile, usually. */
  href?: string
  avatarId?: string | null
  /** Small line under the name: a date, a device, a game count. */
  sub?: ReactNode
  score: ReactNode
  unit?: string
  mine?: boolean
  /** Pinned above the list when the player sits further down it. */
  pinned?: boolean
  period?: LeaderboardPeriod
  /** Expands under the row: an event's per-game breakdown. */
  breakdown?: ReactNode
  id?: string
}

/**
 * One row of a long list — a score board, an event's standings. A soft card per row: the place as a number, the player's mark
 * with a medal pinned to it for the top three, the name and a caption, the
 * score on the right.
 */
export function ListRow({
  rank,
  name,
  href,
  avatarId,
  sub,
  score,
  unit,
  mine = false,
  pinned = false,
  period,
  breakdown,
  id,
}: ListRowProps) {
  const medal = medalKind(rank)
  const cls = [
    'lst__row',
    medal ? `lst__row--${medal}` : '',
    mine ? 'lst__row--you' : '',
    pinned ? 'lst__row--pinned' : '',
    breakdown ? 'lst__row--expandable' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const cells = (
    <>
      {/*
        * The medal sits in the rank slot, not pinned to the avatar.
        * Clipped to the avatar's corner it overlapped the artwork, and it
        * doubled up with the number beside it — two marks for one fact, in the
        * tightest part of the row. Here it simply is the rank, which is the
        * same shape the board summaries already use.
        */}
      <span className="lst__rank" aria-label={`Place ${rank}`}>
        {medal ? <PodiumMedal kind={medal} period={period} size="sm" /> : rank}
      </span>
      <PlayerMark name={name} avatarId={avatarId} className="lst__mark" />
      <span className="lst__text">
        {href ? (
          <a className="lst__name" href={href} title={name}>
            <span className="lst__name-text">{name}</span>
            {mine ? <span className="lst__you">You</span> : null}
          </a>
        ) : (
          <span className="lst__name" title={name}>
            <span className="lst__name-text">{name}</span>
            {mine ? <span className="lst__you">You</span> : null}
          </span>
        )}
        {sub ? <span className="lst__sub">{sub}</span> : null}
      </span>
      <span className="lst__score">
        {score}
        {unit ? <span className="lst__unit">{unit}</span> : null}
      </span>
    </>
  )

  if (!breakdown) {
    return (
      <li id={id} className={cls} aria-current={mine ? 'true' : undefined}>
        <div className="lst__main">{cells}</div>
      </li>
    )
  }

  return (
    <li id={id} className={cls} aria-current={mine ? 'true' : undefined}>
      <details className="lst__details">
        <summary className="lst__main lst__main--expandable">
          {cells}
          <span className="lst__chev" aria-hidden="true" />
        </summary>
        {breakdown}
      </details>
    </li>
  )
}

/** An open slot on a board that is not full yet. */
export function ListRowEmpty({ rank }: { rank: number }) {
  return (
    <li className="lst__row lst__row--empty" aria-hidden="true">
      <div className="lst__main">
        <span className="lst__rank">{rank}</span>
        <span className="pmark pmark--empty lst__mark" />
        <span className="lst__text">
          <span className="lst__name lst__name--open">Open</span>
        </span>
        <span className="lst__score">—</span>
      </div>
    </li>
  )
}

/** "Top 10" divider under a pinned row. */
export function ListSplit({ children }: { children: ReactNode }) {
  return <li className="lst__split">{children}</li>
}
