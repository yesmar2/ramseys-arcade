import { noteRunBegun } from './engagement'
import { rememberPlayed } from './lastPlayed'
import { api, ApiError } from './leaderboard'

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
 * Where a game's runs are opened instead of the plain run start, while one is
 * being played in an event that spends a try as its run starts: through the
 * event, which spends the try and opens the run together. Set by the event's
 * play page while it is up, for its one game, and cleared as it goes.
 */
let opener: { slug: string; open: () => Promise<{ runId?: string } | undefined> } | null = null

export function openRunsThrough(slug: string, open: (() => Promise<{ runId?: string } | undefined>) | null): void {
  opener = open ? { slug, open } : null
}

/**
 * Another go at opening a run that couldn't be, after each of these waits: a dropped request or a busy server
 * shouldn't leave a run unchecked, and once the API refuses scores without a run (REQUIRE_RUN_TOKEN), unsaved.
 */
const RETRY_WAITS_MS = [2_000, 5_000, 10_000] as const

/**
 * How long each run's id took to come back after the run began, in ms, by id. The server's clock for a run starts
 * when it opens it, so a late id (a retry, a slow answer) would make an honest score look too quick for its time:
 * a save sends this along (runLagOf) and the API allows for it, up to a minute.
 */
const lags = new Map<string, number>()
const LAGS_KEPT = 40

/** Worth another go: no answer at all, or the server busy or failing, never a refusal of the request itself. */
function retryable(err: unknown): boolean {
  return !(err instanceof ApiError) || err.status >= 500 || err.status === 429
}

const wait = (ms: number) => new Promise<void>((done) => window.setTimeout(done, ms))

/**
 * A run has started.
 *
 * Fire and forget: called from the same place a game resets itself, and a
 * game must not wait on the network to begin.
 */
export function beginRun(slug: string): void {
  noteRunBegun()
  // A run begun, not a page opened, is what "recently played" means: the home page says "Jump back in" off it.
  rememberPlayed(slug)
  const through = opener && opener.slug === slug ? opener.open : null
  const began = performance.now()
  const open = () =>
    (through
      ? through()
      : api<{ runId?: string }>('/runs/start', {
          method: 'POST',
          body: JSON.stringify({ game: slug }),
        })
    ).then((res) => res?.runId || undefined)
  // An event's opener spends a try, so it's never sent twice; a plain start is tried again while this is still the
  // game's run, and a run that can't be opened at all still plays, its score saving unverified.
  const attempt = (tries: number): Promise<string | undefined> =>
    open().catch((err: unknown) => {
      const waitMs = RETRY_WAITS_MS[tries]
      if (through || waitMs == null || !retryable(err)) return undefined
      return wait(waitMs).then(() => (current.get(slug) === run ? attempt(tries + 1) : undefined))
    })
  const run: Promise<string | undefined> = attempt(0).then((runId) => {
    if (runId) {
      lags.set(runId, Math.round(performance.now() - began))
      if (lags.size > LAGS_KEPT) lags.delete(lags.keys().next().value!)
    }
    return runId
  })
  current.set(slug, run)
}

/**
 * How long after its run began this run's id came back, for a save to send as runLagMs. Undefined for an id this
 * page didn't open, such as Find the Bug's run carried on after a reload.
 */
export function runLagOf(runId: string | null | undefined): number | undefined {
  return runId ? lags.get(runId) : undefined
}

/** A run's fields for a save's body: its id, and how late it came back when this page opened it. */
export function runFields(runId: string | null | undefined): { runId?: string; runLagMs?: number } {
  if (!runId) return {}
  const lag = lags.get(runId)
  return lag != null ? { runId, runLagMs: lag } : { runId }
}

/**
 * Carry on a run begun before, under the id it was opened with: Find the Bug's
 * first run of the day, left halfway and taken up again after a reload, so its
 * score is measured from when it really began, and the API knows it for the
 * day's first. Undefined when that run was never opened.
 */
export function resumeRun(slug: string, runId: string | undefined): void {
  current.set(slug, Promise.resolve(runId))
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
