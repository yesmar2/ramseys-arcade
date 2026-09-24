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

/**
 * Each game's current run, as the id the server is handing back for it.
 *
 * Kept as the promise rather than the id, so that asking once is enough: what
 * a score asked for when its run ended stays that run's, while the id is still
 * on its way and after the next run has begun.
 */
const current = new Map<string, Promise<string | undefined>>()

/**
 * A run has started.
 *
 * Fire and forget: called from the same place a game resets itself, and a
 * game must not wait on the network to begin.
 */
export function beginRun(slug: string): void {
  const run = api<{ runId?: string }>('/runs/start', {
    method: 'POST',
    body: JSON.stringify({ game: slug }),
  })
    .then((res) => res?.runId || undefined)
    // Unopenable run: the score still saves, just unverified.
    .catch(() => undefined)
  current.set(slug, run)
}

/**
 * The run this game is in now, for what it scores: its id, or undefined when
 * the run could not be opened.
 *
 * Ask as the run ends and keep the answer. A save can wait on the network for
 * a second or two, and a player who presses Play again meanwhile has begun a
 * run with an id of its own; a score sent with that one is measured against a
 * clock that started a moment ago, and the server refuses it as too fast.
 */
export function runIdFor(slug: string): Promise<string | undefined> {
  return current.get(slug) ?? Promise.resolve(undefined)
}

/**
 * Forget this game's run.
 *
 * Rarely needed: a run is not cleared when its score saves, because one run
 * legitimately keeps paying out after that — the boards first, then every
 * joined tournament that includes the game, with record books filling up along
 * the way. The server tracks what each run has already been cashed in for, so
 * the id stays useful until {@link beginRun} replaces it.
 */
export function endRun(slug: string): void {
  current.delete(slug)
}
