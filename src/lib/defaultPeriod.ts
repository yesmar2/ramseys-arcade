import { useSyncExternalStore } from 'react'
import { LEADERBOARD_PERIODS, type LeaderboardPeriod } from './leaderboard'

export const DEFAULT_PERIOD_KEY = 'fordriva-default-period'
export const DEFAULT_PERIOD_EVENT = 'arcade-default-period'
export const DEFAULT_PERIOD_FALLBACK: LeaderboardPeriod = 'daily'

function isPeriod(value: string): value is LeaderboardPeriod {
  return (LEADERBOARD_PERIODS as readonly string[]).includes(value)
}

export function storedDefaultPeriod(): LeaderboardPeriod {
  try {
    const value = localStorage.getItem(DEFAULT_PERIOD_KEY)
    if (value && isPeriod(value)) return value
  } catch {
    /* ignore quota / private mode */
  }
  return DEFAULT_PERIOD_FALLBACK
}

export function defaultPeriod(): LeaderboardPeriod {
  if (typeof window === 'undefined') return DEFAULT_PERIOD_FALLBACK
  return storedDefaultPeriod()
}

export function setDefaultPeriod(period: LeaderboardPeriod) {
  try {
    localStorage.setItem(DEFAULT_PERIOD_KEY, period)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(DEFAULT_PERIOD_EVENT))
}

export function subscribeDefaultPeriod(onStoreChange: () => void) {
  const onChange = () => onStoreChange()
  window.addEventListener(DEFAULT_PERIOD_EVENT, onChange)
  return () => window.removeEventListener(DEFAULT_PERIOD_EVENT, onChange)
}

export function useDefaultPeriod(): LeaderboardPeriod {
  return useSyncExternalStore(
    subscribeDefaultPeriod,
    defaultPeriod,
    () => DEFAULT_PERIOD_FALLBACK,
  )
}
