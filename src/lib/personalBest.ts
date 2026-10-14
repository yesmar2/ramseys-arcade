import { isDailyGame } from '../data/games'
import { AUTH_EVENT, SESSION_KEY } from './accountEvents'
import { fetchPlayerBests, getLastPlayerName } from './leaderboard'
import { keptToSave, stillSavable } from './pendingRuns'
import { keptSinceReset } from './runResets'

export type PersonalBestKind = 'first' | 'new' | 'tie' | 'short'

export type PersonalBestResult = {
  kind: PersonalBestKind
  headline: string | null
  detail: string | null
  gain: number | null
}

let cachedName = ''
let cachedBests: Record<string, number> = {}
/**
 * The board day the cached dailies' bests are for: a daily's best is that day's, so one kept from before midnight
 * (a tab or the app left open) is yesterday's, and is never judged against today's blue (a medal won "today"
 * before a run).
 */
let cachedDay = ''
/** The day a stale cache last asked to be fetched again: a day's turn asks once. */
let staleAsked = ''
let turnover = 0
let inflightRefresh: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function subscribePersonalBests(onStoreChange: () => void) {
  listeners.add(onStoreChange)
  // Signing in or out changes whose best it is: the account's, or this device's.
  window.addEventListener(AUTH_EVENT, onStoreChange)
  return () => {
    listeners.delete(onStoreChange)
    window.removeEventListener(AUTH_EVENT, onStoreChange)
  }
}

/*
 * Signed out, your best is this device's (Ramsey, 2026-10-05: signed out, "Your Best" never moved as he played).
 * Each run a signed-out player finishes is kept here by its report (ScoreSaveCard), the best a game; a daily's
 * for its day only, as a daily's best is today's. It's saved nowhere else, so where it shows, it says to sign in
 * to keep it; signed in, the account's best on the boards is what shows.
 */
const DEVICE_KEY = 'skermix-device-bests'
const boardDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
const boardClock = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** At the boards' midnight, whatever shows a best reads it again: a daily's goes with its day. */
function watchTurnover() {
  if (typeof window === 'undefined') return
  window.clearTimeout(turnover)
  const [h, m, s] = boardClock.format(new Date()).split(':').map(Number)
  const left = Math.max(0, (24 * 3600 - (h! * 3600 + m! * 60 + s!)) * 1000)
  turnover = window.setTimeout(emit, left + 1000)
}

/** The cache is a day behind: fetch it again, once a day, and not from inside a render. */
function askAgainForToday() {
  const today = boardDay.format(new Date())
  if (staleAsked === today || typeof window === 'undefined') return
  staleAsked = today
  window.setTimeout(() => void refreshPersonalBests(), 0)
}

/** A device's best on a game: its score, its board day, and when it was kept (missing on bests kept before resets). */
type DeviceBest = { score: number; day: string; at?: number }

function signedIn(): boolean {
  try {
    return Boolean(localStorage.getItem(SESSION_KEY))
  } catch {
    return false
  }
}

function readDeviceBests(): Record<string, DeviceBest> {
  try {
    const parsed = JSON.parse(localStorage.getItem(DEVICE_KEY) ?? '{}') as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, DeviceBest>) : {}
  } catch {
    return {}
  }
}

/** A device's best on a game that's still its: today's, on a daily, and kept since the game's runs were reset. */
function liveBest(slug: string, kept: DeviceBest | undefined): DeviceBest | null {
  if (!kept || typeof kept.score !== 'number') return null
  if (isDailyGame(slug) && kept.day !== boardDay.format(new Date())) return null
  return keptSinceReset(slug, kept.at) ? kept : null
}

function deviceBest(slug: string): number {
  return liveBest(slug, readDeviceBests()[slug])?.score ?? 0
}

/**
 * Whether signing in can still put this device's best on its game's board: the run that set it is kept to be
 * saved (lib/pendingRuns.ts), or on a daily, which keeps its runs its own way (deviceRuns.ts), it was played
 * while its run can still be taken up. Past that it's only this device's best, and where it shows it says so.
 */
export function deviceBestSavable(slug: string): boolean {
  const best = liveBest(slug, readDeviceBests()[slug])
  if (!best) return false
  if (isDailyGame(slug)) return best.at != null && stillSavable(best.at)
  return keptToSave(slug, best.score)
}

/** A signed-out run's score, kept as this device's best on its game if it beats it (a daily's, if it's today's). */
export function rememberDeviceBest(slug: string, score: number) {
  if (score <= 0 || signedIn()) return
  const bests = readDeviceBests()
  const today = boardDay.format(new Date())
  const kept = liveBest(slug, bests[slug])
  if (kept && kept.score >= score) return
  bests[slug] = { score, day: today, at: Date.now() }
  try {
    localStorage.setItem(DEVICE_KEY, JSON.stringify(bests))
  } catch {
    /* private mode: nothing kept, as before */
  }
  emit()
}

export function getPersonalBest(slug: string): number {
  if (!signedIn()) return deviceBest(slug)
  const name = getLastPlayerName().trim().toUpperCase()
  if (!name || name !== cachedName) return 0
  // Yesterday's best on a daily is nothing today: none till today's comes back.
  if (isDailyGame(slug) && cachedDay !== boardDay.format(new Date())) {
    askAgainForToday()
    return 0
  }
  return cachedBests[slug] ?? 0
}

export function rememberPersonalBest(slug: string, score: number) {
  const name = getLastPlayerName().trim().toUpperCase()
  if (!name || score <= 0) return
  const today = boardDay.format(new Date())
  if (cachedName !== name) {
    cachedName = name
    cachedBests = {}
    cachedDay = today
  } else if (cachedDay !== today) {
    // A new day since the cache was filled: the dailies' bests were yesterday's; the other games' are for good.
    for (const key of Object.keys(cachedBests)) if (isDailyGame(key)) delete cachedBests[key]
    cachedDay = today
  }
  cachedBests[slug] = Math.max(cachedBests[slug] ?? 0, score)
  emit()
}

export async function refreshPersonalBests() {
  if (inflightRefresh) return inflightRefresh

  watchTurnover()
  inflightRefresh = (async () => {
    // The day it's asked on: one that turns while it's on its way is caught as a day behind, and asked again.
    const day = boardDay.format(new Date())
    const name = getLastPlayerName().trim().toUpperCase()
    if (!name) {
      cachedName = ''
      cachedBests = {}
      emit()
      return
    }
    try {
      // A daily's best is today's: its all-time board is day points, not a run (leaderboardFormat isDayPointsBoard).
      const [bests, today] = await Promise.all([fetchPlayerBests(name), fetchPlayerBests(name, 'daily')])
      for (const slug of new Set([...Object.keys(bests), ...Object.keys(today)])) {
        if (!isDailyGame(slug)) continue
        if (today[slug]) bests[slug] = today[slug]
        else delete bests[slug]
      }
      cachedName = name
      cachedBests = bests
      cachedDay = day
      emit()
    } catch {
      if (cachedName !== name) {
        cachedName = name
        cachedBests = {}
        emit()
      }
    }
  })().finally(() => {
    inflightRefresh = null
  })

  return inflightRefresh
}

export function describePersonalBest(
  score: number,
  previousBest: number,
): PersonalBestResult {
  if (previousBest <= 0) {
    // First score for this game — don't celebrate or label it as a personal best.
    return { kind: 'first', headline: null, detail: null, gain: null }
  }
  if (score > previousBest) {
    return {
      kind: 'new',
      headline: 'New personal best',
      detail: null,
      gain: score - previousBest,
    }
  }
  if (score === previousBest) {
    return { kind: 'tie', headline: null, detail: 'Tied your record', gain: null }
  }
  const gap = previousBest - score
  return {
    kind: 'short',
    headline: null,
    detail: `${gap} from your record`,
    gain: null,
  }
}
