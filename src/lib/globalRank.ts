import { useSyncExternalStore } from 'react'
import {
  DEFAULT_PERIOD_EVENT,
  defaultPeriod,
} from './defaultPeriod'
import {
  fetchGlobalRank,
  getLastPlayerName,
  PLAYER_NAME_EVENT,
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
let requestId = 0
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function onPreferenceChange() {
  cached = empty
  emit()
  void refreshGlobalRank()
}

function onPlayerNameEvent() {
  emit()
  void refreshGlobalRank()
}

let listeningForName = false

function ensureNameListener() {
  if (listeningForName || typeof window === 'undefined') return
  listeningForName = true
  window.addEventListener(PLAYER_NAME_EVENT, onPlayerNameEvent)
  window.addEventListener(DEFAULT_PERIOD_EVENT, onPreferenceChange)
}

export function subscribeGlobalRank(onStoreChange: () => void) {
  ensureNameListener()
  listeners.add(onStoreChange)
  return () => {
    listeners.delete(onStoreChange)
  }
}

export function getGlobalRankSnapshot(): GlobalRankResult {
  const name = getLastPlayerName()
  if (!name) return empty
  // Keep last payload for this tag (avoid blanking the chip while a refresh is in flight).
  if (name === cachedName) return cached
  return empty
}

export async function refreshGlobalRank() {
  const name = getLastPlayerName()
  if (!name) {
    cachedName = ''
    cached = empty
    emit()
    return
  }
  const id = ++requestId
  try {
    const next = await fetchGlobalRank(name, defaultPeriod())
    if (id !== requestId) return
    cachedName = name
    cached = next
    emit()
  } catch {
    if (id !== requestId) return
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
