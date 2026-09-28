import { subscribeAccountId } from './accountEvents'

/*
 * Whose a daily's run on this device is. Every run a daily keeps here is stamped with its owner when it
 * begins: the signed-in account's id, or SIGNED_OUT. A day keeps one run per owner, so one player's run
 * never overwrites another's (a first run lost that way strands its player for the day: the API counts
 * only the first).
 *
 * The viewer is the account signed in now (auth.ts's currentAccountId): an id, null signed out, or
 * undefined while the session's account isn't known yet. A viewer's own run is the one stamped with
 * their account, or, signed out, the signed-out one; a run kept before runs were stamped (legacy) is
 * their own only while signed out, or once it matches their account's own board result exactly. While
 * the viewer is undefined nothing here is theirs, and no counted run may start or be sent.
 *
 * A run played signed out can be taken up by whoever signs in on this device, but only in its game, by
 * something they do there (Carry on, "Put it on today's board", the save card up as they sign in): the
 * ticket, the hub cards, the archive and the shares show only a viewer's own run. Once saved, it's
 * stamped with the account that saved it.
 */

/** Who's signed in, as the dailies read it: an account's id, null signed out, undefined not known yet. */
export type Viewer = string | null | undefined

/** The stamp of a run played signed out. */
export const SIGNED_OUT = '-'

/** A day's runs on this device, by owner: an account's id, or SIGNED_OUT. */
export type OwnedRuns<Run> = Partial<Record<string, Run>>

/** The stamp a run begun now gets: the account's id, or SIGNED_OUT; undefined while the account isn't known, when no counted run may start. */
export function ownerOf(viewer: Viewer): string | undefined {
  if (viewer === undefined) return undefined
  return viewer ?? SIGNED_OUT
}

/** The slot of a day's runs that is the viewer's own; undefined (none) while the account isn't known. The same as the stamp a run of theirs gets. */
export function ownKey(viewer: Viewer): string | undefined {
  return ownerOf(viewer)
}

/** The account a stamp names, as the save card takes it (its `owner`): null for a run played signed out. */
export function ownerAccount(owner: string): string | null {
  return owner === SIGNED_OUT ? null : owner
}

/**
 * The viewer's own run of a day: the one stamped with their account, or signed out, the signed-out one,
 * else the legacy run (kept before runs were stamped; carried on, it's the signed-out run from then on).
 * Nothing while the account isn't known.
 */
export function ownRun<Run>(runs: OwnedRuns<Run> | null | undefined, legacy: Run | null | undefined, viewer: Viewer): Run | null {
  const key = ownKey(viewer)
  if (key === undefined) return null
  return runs?.[key] ?? (key === SIGNED_OUT ? (legacy ?? null) : null)
}

/**
 * A run played signed out that the signed-in viewer may take up, in its game only, by something they do
 * there; null signed out (it's their own then) or while the account isn't known. A legacy run isn't one:
 * a signed-in account gets one only when it matches that account's own board result exactly.
 */
export function claimableRun<Run>(runs: OwnedRuns<Run> | null | undefined, viewer: Viewer): Run | null {
  if (typeof viewer !== 'string') return null
  return runs?.[SIGNED_OUT] ?? null
}

/** Hear whenever the viewer may have changed, in this tab or another: for a daily store's own subscribe. */
export function subscribeViewer(onChange: () => void): () => void {
  return subscribeAccountId(onChange)
}
