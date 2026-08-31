import { spotterDayKey } from './dayKey'

const SOLVED_KEY = 'spotter-solved-day'
const STREAK_KEY = 'spotter-streak'
const LAST_PLAYED_KEY = 'spotter-last-played'

export type SpotterDayResult = {
  dayKey: string
  leaderboardMs: number
  strikes: number
  official: boolean
  revealed?: boolean
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function getSpotterTodayResult(): SpotterDayResult | null {
  const today = spotterDayKey()
  const saved = readJson<SpotterDayResult>(SOLVED_KEY)
  if (!saved || saved.dayKey !== today) return null
  return saved
}

export function isSpotterSolvedToday(): boolean {
  const r = getSpotterTodayResult()
  return Boolean(r?.official && !r.revealed)
}

export function saveSpotterResult(result: SpotterDayResult) {
  try {
    localStorage.setItem(SOLVED_KEY, JSON.stringify(result))

    if (!result.official) return

    const today = spotterDayKey()
    const yesterday = spotterDayKey(new Date(Date.now() - 86_400_000))
    const prevLast = localStorage.getItem(LAST_PLAYED_KEY)
    let streak = Number(localStorage.getItem(STREAK_KEY) || '0') || 0

    if (prevLast === yesterday) streak += 1
    else if (prevLast !== today) streak = 1

    localStorage.setItem(STREAK_KEY, String(streak))
    localStorage.setItem(LAST_PLAYED_KEY, today)
  } catch {
    /* ignore */
  }
}

export function getSpotterStreak(): number {
  try {
    const streak = Number(localStorage.getItem(STREAK_KEY) || '0')
    const today = spotterDayKey()
    const last = localStorage.getItem(LAST_PLAYED_KEY)
    if (!last) return 0
    if (last === today) return streak
    const yesterday = spotterDayKey(new Date(Date.now() - 86_400_000))
    if (last === yesterday) return streak
    return 0
  } catch {
    return 0
  }
}
