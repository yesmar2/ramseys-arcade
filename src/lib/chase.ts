import { useSyncExternalStore } from 'react'

/*
 * A record you chose to chase: picked from Chase a record beside Play on the
 * game's page (or from the start card), named on the start card, and carried
 * through the run as a pace bar under the score (D with A of the "Snake: chase
 * a record" canvas, Ramsey's pick on 2026-10-29). Kept per game for the tab,
 * like a friend's challenge (lib/challenges.ts), so one pick lasts run after run.
 */

const KEY = 'skermix-chase'
const EVENT = 'arcade-chase'
const KEEP_MS = 12 * 60 * 60 * 1000

/** The games with records worth chasing in a run. */
export const CHASE_GAMES: ReadonlySet<string> = new Set(['snake'])

export function canChase(slug: string): boolean {
  return CHASE_GAMES.has(slug)
}

export type Chase = {
  game: string
  /** The record's book id, or `score` for the game's board. */
  recordId: string
  /** What it is, short: "Length 30", "Longest snake", "Best score". */
  short: string
  /** `ms`: a race to `goal`, against the clock. `count`: a number to pass. */
  unit: 'ms' | 'count'
  /** The time or number to beat; null when nobody has set one yet. */
  target: number | null
  /** For a race: where it ends (a length, for Snake). */
  goal?: number
  /** Whose it is. */
  name?: string
}

type Kept = Chase & { openedAt: number }

function readAll(): Record<string, Kept> {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, Kept>
    const now = Date.now()
    const out: Record<string, Kept> = {}
    for (const [slug, ch] of Object.entries(parsed ?? {})) {
      if (ch && typeof ch.recordId === 'string' && now - (ch.openedAt ?? 0) < KEEP_MS) out[slug] = ch
    }
    return out
  } catch {
    return {}
  }
}

function writeAll(all: Record<string, Kept>) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* private mode: the chase lasts as long as the page */
  }
  window.dispatchEvent(new Event(EVENT))
}

export function setChase(chase: Chase) {
  const all = readAll()
  all[chase.game] = { ...chase, openedAt: Date.now() }
  writeAll(all)
}

export function clearChase(slug: string) {
  const all = readAll()
  if (!all[slug]) return
  delete all[slug]
  writeAll(all)
}

let snapshotRaw: string | null = null
let snapshot: Record<string, Kept> = {}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  return () => window.removeEventListener(EVENT, onChange)
}

function getSnapshot(): Record<string, Kept> {
  let raw: string | null = null
  try {
    raw = sessionStorage.getItem(KEY)
  } catch {
    raw = null
  }
  if (raw !== snapshotRaw) {
    snapshotRaw = raw
    snapshot = readAll()
  }
  return snapshot
}

/** The record this tab is chasing on a game, kept current as it changes. */
export function useChase(slug: string): Chase | null {
  const all = useSyncExternalStore(subscribe, getSnapshot, () => snapshot)
  return all[slug] ?? null
}
