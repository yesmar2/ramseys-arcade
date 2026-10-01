import { currentAccountId, getSessionToken } from './auth'
import { addLeaderboardScore, ApiError, getClaimToken, getLastPlayerName, normalizePlayerName } from './leaderboard'
import { refreshTickets } from './tickets'

/*
 * Runs played signed out, kept on this device until their player signs in (Ramsey, 2026-10-01: "let's do 6").
 *
 * A run's report used to keep a signed-out run only while it stayed open: sign in there and it saved, leave
 * and it was gone. Now each one is kept here as its report asks for the sign-in, and whenever this device is
 * signed in with a tag, every run still kept goes on the boards under that account, oldest first, paying its
 * tickets as any saved run does. The report says how many are waiting, and a note says what was saved.
 *
 * The API opened each run before it was played (runSession.ts), with no account, so whoever signs in may save
 * it; but only for 6 hours from its start (its runs.ts RUN_TTL_MS), so runs are kept 5 hours from their end.
 * A daily's runs aren't kept here: they have their own (deviceRuns.ts).
 */

const KEY = 'skermix-pending-runs'
/** Kept this long after the run ended: the API takes a run up to 6 hours after it began. */
const KEEP_MS = 5 * 60 * 60 * 1000
/** At most this many kept: the latest. */
const MAX = 20

export type PendingRun = {
  /** This device's own name for it. */
  id: string
  slug: string
  score: number
  /** The run the API opened for it, when it could; a run it couldn't open saves without one while that's allowed. */
  runId?: string
  endedAt: number
  /** Crosswalk's prize tickets picked up on the way. */
  pickups?: number
}

/** Said when kept runs have gone on the boards: how many, and what they paid. */
export const PENDING_SAVED_EVENT = 'skermix:pending-saved'
export type PendingSaved = { saved: number; tickets: number }

/** A run whose report is up: that report saves it, so the saver here leaves it be. */
const held = new Set<string>()

function read(now = Date.now()): PendingRun[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return (parsed as PendingRun[]).filter((r) => r && typeof r.slug === 'string' && typeof r.score === 'number' && now - r.endedAt < KEEP_MS)
  } catch {
    return []
  }
}

function write(runs: PendingRun[]) {
  try {
    if (runs.length) localStorage.setItem(KEY, JSON.stringify(runs.slice(-MAX)))
    else localStorage.removeItem(KEY)
  } catch {
    /* private mode: the run's report can still save it while it's up */
  }
}

/** Keep a signed-out run until sign-in. The same run kept twice (a report reopened) is kept once. */
export function keepPendingRun(run: Omit<PendingRun, 'id' | 'endedAt'>): string {
  const runs = read()
  const same = run.runId ? runs.find((r) => r.runId === run.runId) : undefined
  if (same) return same.id
  const id = `pr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  write([...runs, { ...run, id, endedAt: Date.now() }])
  return id
}

export function dropPendingRun(id: string) {
  write(read().filter((r) => r.id !== id))
}

/** A run's report is up and will save it: hold it back from the saver until the report goes. */
export function holdPendingRun(id: string) {
  held.add(id)
}

export function releasePendingRun(id: string) {
  held.delete(id)
}

/** How many runs are kept, leaving out one (the report asking). */
export function pendingCount(except?: string): number {
  return read().filter((r) => r.id !== except).length
}

/** Whether a refusal is for good (the run can never be saved) rather than for now. */
function refusedForGood(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false
  if (err.status === 401 || err.status === 429) return false
  // A tag that's taken or not allowed: once the tag's put right, the runs can still go.
  if (err.code === 'NAME_TAKEN' || err.code === 'NAME_NOT_ALLOWED' || err.code === 'TOKEN_REQUIRED') return false
  return err.status >= 400 && err.status < 500
}

let saving: Promise<PendingSaved | null> | null = null

/**
 * Put every kept run on the boards under the account signed in, with its tag, oldest first. Nothing while
 * signed out or tagless, or while a save is going. A run refused for good (too old, already used, a score the
 * API can't believe) is let go; anything else stops the round, to try again at the next sign-in or tag.
 */
export function savePendingRuns(): Promise<PendingSaved | null> {
  if (saving) return saving
  saving = (async () => {
    const name = normalizePlayerName(getLastPlayerName())
    if (!getSessionToken() || typeof currentAccountId() !== 'string' || !name || !getClaimToken(name)) return null
    let saved = 0
    let tickets = 0
    for (const run of read()) {
      if (held.has(run.id)) continue
      try {
        const result = await addLeaderboardScore(run.slug, name, run.score, {
          run: Promise.resolve(run.runId),
          pickups: run.pickups,
        })
        dropPendingRun(run.id)
        saved++
        tickets += result.tickets?.earned ?? 0
      } catch (err) {
        if (refusedForGood(err)) {
          dropPendingRun(run.id)
          continue
        }
        break
      }
    }
    if (!saved) return null
    void refreshTickets(true)
    const said: PendingSaved = { saved, tickets }
    window.dispatchEvent(new CustomEvent<PendingSaved>(PENDING_SAVED_EVENT, { detail: said }))
    return said
  })().finally(() => {
    saving = null
  })
  return saving
}
