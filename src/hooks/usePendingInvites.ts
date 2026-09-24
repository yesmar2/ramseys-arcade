import { useCallback, useEffect, useSyncExternalStore } from 'react'
import {
  acceptInvite,
  declineInvite,
  listPendingInvites,
  type AcceptInviteResult,
  type PublicInvite,
} from '../lib/invites'
import { normalizePlayerName, getLastPlayerName } from '../lib/leaderboard'
import { useAuth } from './useAuth'
import { usePlayerName } from './usePlayerName'

const POLL_MS = 45_000
/** Invites this fresh are shown as they are: a new page doesn't ask again. */
const FRESH_MS = 30_000
const EVENT = 'arcade-pending-invites'

type Store = {
  key: string
  playerName: string
  invites: PublicInvite[]
  loading: boolean
  error: string | null
  busyId: string | null
  lastFetchedAt: number
}

const empty: Store = {
  key: '',
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
/** Latest signed-in flag for focus/interval refresh. */
let signedInLatest = false

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

async function refresh(playerName: string, signedIn: boolean, force = false) {
  const name = normalizePlayerName(playerName)
  const key = name || (signedIn ? '__session__' : '')
  if (!key) {
    emit({ ...empty })
    return
  }

  if (!force && snapshot.key === key) {
    if (inFlight) return inFlight
    // Asked moments ago: every page mounts the header again, and it needn't ask again.
    if (Date.now() - snapshot.lastFetchedAt < FRESH_MS) return
  }

  patch({ key, playerName: name, loading: true })

  const run = (async () => {
    try {
      const next = await listPendingInvites(name || undefined)
      if (snapshot.key !== key) return
      patch({
        invites: next,
        error: null,
        lastFetchedAt: Date.now(),
        loading: false,
      })
    } catch (err) {
      if (snapshot.key !== key) return
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
    if (name || signedInLatest) void refresh(name, signedInLatest)
  }
  window.addEventListener('focus', onFocus)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') onFocus()
  })
  window.setInterval(() => {
    if (document.visibilityState !== 'visible') return
    const name = normalizePlayerName(getLastPlayerName())
    if (name || signedInLatest) void refresh(name, signedInLatest)
  }, POLL_MS)
}

export function usePendingInvites() {
  const { signedIn } = useAuth()
  const rawName = usePlayerName()
  const playerName = normalizePlayerName(rawName)
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const key = playerName || (signedIn ? '__session__' : '')

  useEffect(() => {
    signedInLatest = signedIn
  }, [signedIn])

  useEffect(() => {
    ensureListeners()
    if (!key) {
      emit({ ...empty })
      return
    }
    void refresh(playerName, signedIn)
  }, [playerName, signedIn, key])

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

  const invites = key && snap.key === key ? snap.invites : []

  return {
    invites,
    count: invites.length,
    loading: snap.loading && snap.key === key,
    error: snap.key === key ? snap.error : null,
    busyId: snap.busyId,
    refresh: () => refresh(playerName, signedIn, true),
    accept,
    decline,
    playerName,
  }
}
