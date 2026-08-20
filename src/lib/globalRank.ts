import { useSyncExternalStore } from 'react'
import {
  fetchGlobalRank,
  getLastPlayerName,
  type GlobalRankResult,
} from './leaderboard'

const empty: GlobalRankResult = {
  rank: null,
  score: 0,
  totalPlayers: 0,
  byGame: {},
  nearby: [],
}

let cachedName = ''
let cached: GlobalRankResult = empty
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function subscribeGlobalRank(onStoreChange: () => void) {
  listeners.add(onStoreChange)
  return () => {
    listeners.delete(onStoreChange)
  }
}

export function getGlobalRankSnapshot(): GlobalRankResult {
  const name = getLastPlayerName()
  if (!name || name !== cachedName) return empty
  return cached
}

export async function refreshGlobalRank() {
  const name = getLastPlayerName()
  if (!name) {
    cachedName = ''
    cached = empty
    emit()
    return
  }
  try {
    const next = await fetchGlobalRank(name)
    cachedName = name
    cached = next
    emit()
  } catch {
    if (cachedName !== name) {
      cachedName = name
      cached = empty
      emit()
    }
  }
}

export function useGlobalRank(): GlobalRankResult {
  return useSyncExternalStore(subscribeGlobalRank, getGlobalRankSnapshot, () => empty)
}
