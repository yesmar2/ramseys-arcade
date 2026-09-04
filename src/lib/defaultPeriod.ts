import { useSyncExternalStore } from 'react'
import {
  coerceVisiblePeriod,
  LEADERBOARD_PERIODS,
  type LeaderboardPeriod,
} from './leaderboard'

export const DEFAULT_PERIOD_KEY = 'skermix-default-period'
export const DEFAULT_PERIOD_EVENT = 'arcade-default-period'
export const DEFAULT_PERIOD_FALLBACK: LeaderboardPeriod = 'weekly'

const LEGACY_DEFAULT_PERIOD_KEYS = ['fordriva-default-period'] as const

function isPeriod(value: string): value is LeaderboardPeriod {
  return (LEADERBOARD_PERIODS as readonly string[]).includes(value)
}

export function storedDefaultPeriod(): LeaderboardPeriod {
  try {
    let value = localStorage.getItem(DEFAULT_PERIOD_KEY)
    if (!value || !isPeriod(value)) {
      for (const key of LEGACY_DEFAULT_PERIOD_KEYS) {
        value = localStorage.getItem(key)
        if (value && isPeriod(value)) {
          localStorage.setItem(DEFAULT_PERIOD_KEY, value)
          break
        }
      }
    }
    if (value && isPeriod(value)) return coerceVisiblePeriod(value)
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
  const next = coerceVisiblePeriod(period)
  try {
    localStorage.setItem(DEFAULT_PERIOD_KEY, next)
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
