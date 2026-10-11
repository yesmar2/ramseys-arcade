import { PlayerMark } from './PlayerMark'

/*
 * A record as a brass plaque (Ramsey picked "C with A's plaques" from the "Record books, redesigned" canvas,
 * 2026-10-11): what it is engraved small, the best big, who holds it and when on the plate, and under it how
 * close you are, with the way to go and beat it. One nobody holds yet is an empty outline, up for grabs. The
 * whole plaque opens the record; its button goes to the game.
 */

export type PlaqueYou =
  /** You hold it. */
  | { kind: 'mine' }
  /** On its board: your best, and how near the record it is, 0 to 1. */
  | { kind: 'on'; value: string; share: number; rank: number }
  /** Signed in, with no run on it yet. */
  | { kind: 'none' }

export function RecordPlaque({
  label,
  value,
  holder,
  when,
  href,
  you,
  big = false,
  action,
}: {
  label: string
  /** The record, or null for one nobody holds yet. */
  value: string | null
  holder: { name: string; avatarId?: string | null } | null
  /** "set Sep 14" and the like. */
  when?: string
  href: string
  /** Where you stand; undefined for a visitor (or an answer that doesn't say). */
  you?: PlaqueYou
  /** The book's headline record: a plaque two wide. */
  big?: boolean
  /** The way to go and beat it (or set it): the game, mostly. */
  action?: { href: string; label: string } | null
}) {
  const open = value == null || !holder
  const mine = you?.kind === 'mine'
  return (
    <li className={`rbk-plq${open ? ' rbk-plq--open' : ''}${mine ? ' rbk-plq--mine' : ''}${big && !open ? ' rbk-plq--big' : ''}`}>
      <a className="rbk-plq__link" href={href}>
        <span className="rbk-plq__name">{label}</span>
      </a>
      <span className="rbk-plq__value">{open ? 'Up for grabs' : value}</span>
      <span className="rbk-plq__plate">
        {open ? (
          <span className="rbk-plq__when">The first to do it holds it</span>
        ) : (
          <>
            <span className="rbk-plq__holder">
              <PlayerMark name={holder.name} avatarId={holder.avatarId ?? undefined} className="rbk-plq__mark" />
              <span className="rbk-plq__who">{holder.name}</span>
            </span>
            {when ? <span className="rbk-plq__when">{when}</span> : null}
          </>
        )}
      </span>
      {you || action ? (
        <span className="rbk-plq__foot">
          {mine ? (
            <span className="rbk-plq__you rbk-plq__you--mine">Yours</span>
          ) : you?.kind === 'on' ? (
            <span className="rbk-plq__you">
              <span>
                You: <b>{you.value}</b>
                {you.rank > 1 ? <span className="rbk-plq__rank"> · #{you.rank}</span> : null}
              </span>
              <span className="rbk-plq__bar" aria-hidden="true">
                <span style={{ width: `${Math.round(Math.max(0.04, Math.min(1, you.share)) * 100)}%` }} />
              </span>
            </span>
          ) : you?.kind === 'none' ? (
            <span className="rbk-plq__you rbk-plq__you--quiet">{open ? '' : 'No run on it yet'}</span>
          ) : (
            <span />
          )}
          {action && !mine ? (
            <a className={`rbk-plq__act${open ? ' rbk-plq__act--go' : ''}`} href={action.href}>
              {action.label}
            </a>
          ) : null}
        </span>
      ) : null}
    </li>
  )
}

/** How near a result is to the record, 0 to 1: a fraction of a high one, or of a low one's time. */
export function shareOf(lower: boolean, you: number, top: number): number {
  if (you <= 0 || top <= 0) return 0
  return lower ? top / you : you / top
}
