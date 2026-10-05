import { isDailyGame } from '../data/games'
import { AUTH_EVENT, SESSION_KEY } from './accountEvents'
import { fetchPlayerBests, getLastPlayerName } from './leaderboard'

export type PersonalBestKind = 'first' | 'new' | 'tie' | 'short'

export type PersonalBestResult = {
  kind: PersonalBestKind
  headline: string | null
  detail: string | null
  gain: number | null
}

let cachedName = ''
let cachedBests: Record<string, number> = {}
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

type DeviceBest = { score: number; day: string }

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

function deviceBest(slug: string): number {
  const kept = readDeviceBests()[slug]
  if (!kept || typeof kept.score !== 'number') return 0
  if (isDailyGame(slug) && kept.day !== boardDay.format(new Date())) return 0
  return kept.score
}

/** A signed-out run's score, kept as this device's best on its game if it beats it (a daily's, if it's today's). */
export function rememberDeviceBest(slug: string, score: number) {
  if (score <= 0 || signedIn()) return
  const bests = readDeviceBests()
  const today = boardDay.format(new Date())
  const kept = bests[slug]
  if (kept && kept.score >= score && (!isDailyGame(slug) || kept.day === today)) return
  bests[slug] = { score, day: today }
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
  return cachedBests[slug] ?? 0
}

export function rememberPersonalBest(slug: string, score: number) {
  const name = getLastPlayerName().trim().toUpperCase()
  if (!name || score <= 0) return
  if (cachedName !== name) {
    cachedName = name
    cachedBests = {}
  }
  cachedBests[slug] = Math.max(cachedBests[slug] ?? 0, score)
  emit()
}

export async function refreshPersonalBests() {
  if (inflightRefresh) return inflightRefresh

  inflightRefresh = (async () => {
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
