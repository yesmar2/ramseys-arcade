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

const empty: Store = {
  playerName: '',
  invites: [],
  loading: false,
  error: null,
  busyId: null,
  lastFetchedAt: 0,
}

/** Cached snapshot — must be referentially stable between emits. */
let snapshot: Store = empty
let focusBound = false
let inFlight: Promise<void> | null = null

function emit(next: Store) {
  snapshot = next
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}

function getSnapshot(): Store {
  return snapshot
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  return () => window.removeEventListener(EVENT, onChange)
}

function patch(partial: Partial<Store>) {
  emit({ ...snapshot, ...partial })
}

async function refresh(playerName: string, force = false) {
  const name = normalizePlayerName(playerName)
  if (!name) {
    emit({ ...empty })
    return
  }

  if (
    !force &&
    snapshot.playerName === name &&
    Date.now() - snapshot.lastFetchedAt < 8_000 &&
    inFlight
  ) {
    return inFlight
  }

  patch({ playerName: name, loading: true })

  const run = (async () => {
    try {
      const next = await listPendingInvites(name)
      if (snapshot.playerName !== name) return
      patch({
        invites: next,
        error: null,
        lastFetchedAt: Date.now(),
        loading: false,
      })
    } catch (err) {
      if (snapshot.playerName !== name) return
      patch({
        error: err instanceof Error ? err.message : 'Could not load invites',
        loading: false,
      })
    } finally {
      inFlight = null
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
  window.setInterval(() => {
    if (document.visibilityState !== 'visible') return
    const name = normalizePlayerName(getLastPlayerName())
    if (name) void refresh(name)
  }, POLL_MS)
}

export function usePendingInvites() {
  const rawName = usePlayerName()
  const playerName = normalizePlayerName(rawName)
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    ensureListeners()
    if (!playerName) {
      emit({ ...empty })
      return
    }
    void refresh(playerName)
  }, [playerName])

  const accept = useCallback(async (id: string): Promise<AcceptInviteResult | null> => {
    patch({ busyId: id, error: null })
    try {
      const result = await acceptInvite(id)
      patch({
        invites: snapshot.invites.filter((i) => i.id !== id),
        busyId: null,
      })
      return result
    } catch (err) {
      patch({
        error: err instanceof Error ? err.message : 'Could not accept invite',
        busyId: null,
      })
      return null
    }
  }, [])

  const decline = useCallback(async (id: string) => {
    patch({ busyId: id, error: null })
    try {
      await declineInvite(id)
      patch({
        invites: snapshot.invites.filter((i) => i.id !== id),
        busyId: null,
      })
      return true
    } catch (err) {
      patch({
        error: err instanceof Error ? err.message : 'Could not decline invite',
        busyId: null,
      })
      return false
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
