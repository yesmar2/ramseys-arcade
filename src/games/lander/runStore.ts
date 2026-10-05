import { ownKey, ownRun, SIGNED_OUT, type OwnedRuns, type Viewer } from '../../lib/deviceRuns'

/*
 * Your own best run down each day's cave, kept on the device with where the ship was all the way down, so it
 * can fly again as the ghost. Nothing here needs the game's engine, so the Dailies card can read a day's best
 * from it without loading the game.
 */

/**
 * A run as its ghost flies it: its time, when it passed each gate and landed, and where it was (sim.ts
 * Flight's ghost: x, y, angle and engine, GHOST_RATE a second, the landing's moment last).
 */
/** A run and its path; `skin`, the season skin it was flown in (lib/skins.ts), so its ghost wears it too. */
export type GhostRun = { time: number; splits: number[]; ghost: number[]; skin?: string }

/** A ghost sample's numbers (sim.ts GHOST_STRIDE), here so this file needs no engine. */
const STRIDE = 4

/*
 * Not a score: the board keeps that. This is only each day's best run and its path, for the ghost, on this
 * device, and only the last few days: a day's run is no use in another day's cave.
 *
 * Each player who flies here has a best run of their own (lib/deviceRuns.ts): a run is kept under whoever
 * was signed in as it started, or signed out, so one player's run is never another's ghost, and never kept
 * over theirs.
 */
const RUNS_KEY = 'skermix-lander-runs'
const KEEP_DAYS = 3
/** A run and its path come to some 40 KB: a day keeps the runs of this many players, dropping the oldest. */
const KEEP_OWNERS = 4

type KeptRun = GhostRun & { at: number }

function validRun(raw: Partial<GhostRun> | null | undefined): GhostRun | null {
  if (!raw || typeof raw.time !== 'number' || !(raw.time > 10 && raw.time < 900)) return null
  if (!Array.isArray(raw.splits) || raw.splits.length < 1 || !raw.splits.every(Number.isFinite)) return null
  if (!Array.isArray(raw.ghost) || raw.ghost.length < STRIDE * 10 || raw.ghost.length % STRIDE !== 0 || !raw.ghost.every(Number.isFinite)) return null
  return { time: raw.time, splits: raw.splits, ghost: raw.ghost, ...(typeof raw.skin === 'string' ? { skin: raw.skin } : {}) }
}

/** Each day's best runs on this device, by whose they are: an account's id, or SIGNED_OUT. */
function readRuns(): Record<string, OwnedRuns<KeptRun>> {
  try {
    const parsed = JSON.parse(localStorage.getItem(RUNS_KEY) ?? 'null') as { days?: Record<string, Record<string, Partial<KeptRun>> | null> } | null
    const days: Record<string, OwnedRuns<KeptRun>> = {}
    for (const [day, runs] of Object.entries(parsed?.days ?? {})) {
      for (const [owner, raw] of Object.entries(runs ?? {})) {
        const run = validRun(raw)
        if (run) days[day] = { ...days[day], [owner]: { ...run, at: typeof raw.at === 'number' ? raw.at : 0 } }
      }
    }
    return days
  } catch {
    return {}
  }
}

/** A day's runs written back, KEEP_OWNERS of them at most, and only the last KEEP_DAYS days. */
function writeRuns(days: Record<string, OwnedRuns<KeptRun>>, day: string, runs: OwnedRuns<KeptRun>) {
  const newest = Object.entries(runs)
    .filter((entry): entry is [string, KeptRun] => entry[1] != null)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, KEEP_OWNERS)
  const all = { ...days, [day]: Object.fromEntries(newest) }
  const keep = Object.keys(all).sort().slice(-KEEP_DAYS)
  localStorage.setItem(RUNS_KEY, JSON.stringify({ days: Object.fromEntries(keep.map((d) => [d, all[d]])) }))
}

const toKeep = (run: GhostRun): KeptRun => ({
  time: run.time,
  splits: run.splits,
  ghost: run.ghost.map((v) => Math.round(v * 100) / 100),
  // The skin it was flown in, so your own ghost wears it (b96691c read it back, but it was never written).
  ...(run.skin ? { skin: run.skin } : {}),
  at: Date.now(),
})

const sameRun = (kept: GhostRun | null | undefined, run: GhostRun) =>
  kept != null && kept.time === run.time && kept.splits.every((at, k) => at === run.splits[k])

/** Your best run down a day's cave on this device: the viewer's own, never another player's. */
export function keptRun(day: string, viewer: Viewer): GhostRun | null {
  return ownRun(readRuns()[day], viewer)
}

/** A run kept as the best of whoever flew it: `owner`, the account signed in as it started, or SIGNED_OUT. */
export function keepBestRun(day: string, owner: string, run: GhostRun) {
  try {
    const days = readRuns()
    writeRuns(days, day, { ...days[day], [owner]: toKeep(run) })
  } catch {
    /* a private window keeps nothing; the run still counts */
  }
}

/**
 * A run flown signed out, then put on the board by the account signed in on its card: it's that account's
 * from now on, its best here if it's faster than the one it had, and the signed-out run it was is gone.
 */
export function claimRun(day: string, accountId: string, run: GhostRun) {
  try {
    const days = readRuns()
    const runs = { ...days[day] }
    const mine = runs[accountId]
    if (!mine || run.time < mine.time) runs[accountId] = toKeep(run)
    if (sameRun(runs[SIGNED_OUT], run)) delete runs[SIGNED_OUT]
    writeRuns(days, day, runs)
  } catch {
    /* a private window keeps nothing; the run is on the board */
  }
}

/** A past or test day's best practice run, by whose it is: kept only while the tab is open. */
const practiceRuns = new Map<string, GhostRun>()
const practiceKey = (owner: string, day: string) => `${owner}|${day}`

/** The viewer's best practice run down a day's cave, in this tab. */
export function practiceBest(day: string, viewer: Viewer): GhostRun | null {
  const own = ownKey(viewer)
  return own === undefined ? null : (practiceRuns.get(practiceKey(own, day)) ?? null)
}

export function keepPracticeRun(day: string, owner: string, run: GhostRun) {
  practiceRuns.set(practiceKey(owner, day), run)
}
