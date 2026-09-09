import { useCallback, useEffect, useSyncExternalStore } from 'react'
import {
  acceptInvite,
  declineInvite,
  listPendingInvites,
  type AcceptInviteResult,
  type PublicInvite,
} from '../lib/invites'
import { normalizePlayerName, getLastPlayerName } from '../lib/leaderboard'
import { usePlayerName } from './usePlayerName'

const POLL_MS = 45_000
const EVENT = 'arcade-pending-invites'

type Store = {
  playerName: string
  invites: PublicInvite[]
  loading: boolean
  error: string | null
  busyId: string | null
  lastFetchedAt: number
}

const store: Store = {
  playerName: '',
  invites: [],
  loading: false,
  error: null,
  busyId: null,
  lastFetchedAt: 0,
}

let pollTimer: number | null = null
let focusBound = false
let inFlight: Promise<void> | null = null

function emit() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}

function snapshot(): Store {
  return { ...store }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  return () => window.removeEventListener(EVENT, onChange)
}

async function refresh(playerName: string, force = false) {
  const name = normalizePlayerName(playerName)
  if (!name) {
    store.playerName = ''
    store.invites = []
    store.error = null
    store.loading = false
    emit()
    return
  }

  if (
    !force &&
    store.playerName === name &&
    Date.now() - store.lastFetchedAt < 8_000 &&
    inFlight
  ) {
    return inFlight
  }

  store.playerName = name
  store.loading = true
  emit()

  const run = (async () => {
    try {
      const next = await listPendingInvites(name)
      if (store.playerName !== name) return
      store.invites = next
      store.error = null
      store.lastFetchedAt = Date.now()
    } catch (err) {
      if (store.playerName !== name) return
      store.error = err instanceof Error ? err.message : 'Could not load invites'
    } finally {
      if (store.playerName === name) store.loading = false
      inFlight = null
      emit()
    }
  })()
  inFlight = run
  return run
}

function ensureListeners() {
  if (typeof window === 'undefined' || focusBound) return
  focusBound = true
  const onFocus = () => {
    const name = normalizePlayerName(getLastPlayerName())
    if (name) void refresh(name)
  }
  window.addEventListener('focus', onFocus)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') onFocus()
  })
  pollTimer = window.setInterval(() => {
    if (document.visibilityState !== 'visible') return
    const name = normalizePlayerName(getLastPlayerName())
    if (name) void refresh(name)
  }, POLL_MS)
}

export function usePendingInvites() {
  const rawName = usePlayerName()
  const playerName = normalizePlayerName(rawName)
  const snap = useSyncExternalStore(subscribe, snapshot, snapshot)

  useEffect(() => {
    ensureListeners()
    if (!playerName) {
      store.playerName = ''
      store.invites = []
      store.error = null
      emit()
      return
    }
    void refresh(playerName)
  }, [playerName])

  const accept = useCallback(async (id: string): Promise<AcceptInviteResult | null> => {
    store.busyId = id
    store.error = null
    emit()
    try {
      const result = await acceptInvite(id)
      store.invites = store.invites.filter((i) => i.id !== id)
      return result
    } catch (err) {
      store.error = err instanceof Error ? err.message : 'Could not accept invite'
      return null
    } finally {
      store.busyId = null
      emit()
    }
  }, [])

  const decline = useCallback(async (id: string) => {
    store.busyId = id
    store.error = null
    emit()
    try {
      await declineInvite(id)
      store.invites = store.invites.filter((i) => i.id !== id)
      return true
    } catch (err) {
      store.error = err instanceof Error ? err.message : 'Could not decline invite'
      return false
    } finally {
      store.busyId = null
      emit()
    }
  }, [])

  const invites = playerName && snap.playerName === playerName ? snap.invites : []

  return {
    invites,
    count: invites.length,
    loading: snap.loading && snap.playerName === playerName,
    error: snap.playerName === playerName ? snap.error : null,
    busyId: snap.busyId,
    refresh: () => refresh(playerName, true),
    accept,
    decline,
    playerName,
  }
}
