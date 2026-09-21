import { api } from './leaderboard'

/**
 * Tells the server a run has begun, so the score at the end has something to
 * be checked against.
 *
 * The API cannot see the game — it runs here, in the browser — so a score was
 * only ever a number this side asserted. Opening a run gets the moment it
 * started written down somewhere the player cannot edit, and the score is then
 * measured against the time that actually passed.
 *
 * Everything here fails quietly. A run that cannot be opened (offline, the API
 * asleep on its free tier, a browser blocking the request) must never stop
 * somebody playing, so the score simply saves without one, exactly as it did
 * before any of this existed.
 */

/** The unspent run for each game, waiting for that game's score. */
const open = new Map<string, string>()

/** In-flight opens, so a score arriving early still waits for its run id. */
const opening = new Map<string, Promise<void>>()

/**
 * A run has started.
 *
 * Fire and forget: called from the same place a game resets itself, and a
 * game must not wait on the network to begin.
 */
export function beginRun(slug: string): void {
  open.delete(slug)

  const request = api<{ runId?: string }>('/runs/start', {
    method: 'POST',
    body: JSON.stringify({ game: slug }),
  })
    .then((res) => {
      if (res?.runId) open.set(slug, res.runId)
    })
    .catch(() => {
      /* Unopenable run: the score still saves, just unverified. */
    })
    .finally(() => {
      if (opening.get(slug) === request) opening.delete(slug)
    })

  opening.set(slug, request)
}

/**
 * The run id to submit with this game's score, if there is one.
 *
 * Waits on an open still in flight — a game lasts seconds at least and the
 * request takes milliseconds, so this only ever matters for a run that ended
 * almost immediately.
 */
export async function runIdFor(slug: string): Promise<string | undefined> {
  const pending = opening.get(slug)
  if (pending) await pending
  return open.get(slug)
}

/**
 * Forget this game's run.
 *
 * Called once a score has been saved, since the server spends the id at the
 * same moment: keeping it would only produce a second submission rejected for
 * reusing it.
 */
export function endRun(slug: string): void {
  open.delete(slug)
  opening.delete(slug)
}
