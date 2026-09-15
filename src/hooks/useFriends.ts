import { useCallback, useEffect, useSyncExternalStore } from 'react'
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  listFriends,
  removeFriend,
  sendFriendRequest,
  type Friend,
  type FriendRequest,
  type SendFriendRequestResult,
} from '../lib/friends'
import { useAuth } from './useAuth'

/*
 * One shared copy of the friends list. The header wants the request count
 * for its badge, the drawer wants the totals for its Friends row, and the
 * profile page shows the whole thing — three consumers, one fetch, and one
 * refresh when any of them changes something.
 */

type Store = {
  friends: Friend[]
  requests: FriendRequest[]
  loaded: boolean
  loading: boolean
  error: string | null
  busyId: string | null
}

const empty: Store = {
  friends: [],
  requests: [],
  loaded: false,
  loading: false,
  error: null,
  busyId: null,
}

const EVENT = 'arcade-friends'
const STALE_MS = 30_000

let snapshot: Store = empty
let fetchedAt = 0
let inFlight: Promise<void> | null = null
let listening = false

function emit(next: Store) {
  snapshot = next
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}

function patch(partial: Partial<Store>) {
  emit({ ...snapshot, ...partial })
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  return () => window.removeEventListener(EVENT, onChange)
}

function getSnapshot() {
  return snapshot
}

export function refreshFriends(force = false): Promise<void> {
  if (inFlight) return inFlight
  if (!force && snapshot.loaded && Date.now() - fetchedAt < STALE_MS) {
    return Promise.resolve()
  }
  patch({ loading: true })
  inFlight = listFriends()
    .then((data) => {
      fetchedAt = Date.now()
      patch({
        friends: data.friends,
        requests: data.requests,
        loaded: true,
        loading: false,
        error: null,
      })
    })
    .catch((err: unknown) => {
      patch({
        loaded: true,
        loading: false,
        error: err instanceof Error ? err.message : 'Could not load friends',
      })
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

/** Forget everything — on sign-out, the list belongs to nobody. */
export function resetFriends() {
  fetchedAt = 0
  emit({ ...empty })
}

function ensureListeners() {
  if (typeof window === 'undefined' || listening) return
  listening = true
  const onVisible = () => {
    if (document.visibilityState === 'visible' && snapshot.loaded) void refreshFriends()
  }
  window.addEventListener('focus', onVisible)
  document.addEventListener('visibilitychange', onVisible)
}

export function useFriends() {
  const { signedIn } = useAuth()
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    ensureListeners()
    if (!signedIn) {
      if (snapshot.loaded || snapshot.loading) resetFriends()
      return
    }
    void refreshFriends()
  }, [signedIn])

  /** Run one request action, then reload the list so every consumer agrees. */
  const act = useCallback(async (id: string, fn: () => Promise<unknown>, fallback: string) => {
    patch({ busyId: id, error: null })
    try {
      await fn()
      await refreshFriends(true)
      return true
    } catch (err) {
      patch({ error: err instanceof Error ? err.message : fallback })
      return false
    } finally {
      patch({ busyId: null })
    }
  }, [])

  const send = useCallback(async (name: string): Promise<SendFriendRequestResult> => {
    const result = await sendFriendRequest(name)
    await refreshFriends(true)
    return result
  }, [])

  const requests = signedIn ? snap.requests : []
  return {
    signedIn,
    friends: signedIn ? snap.friends : [],
    incoming: requests.filter((r) => r.direction === 'incoming'),
    outgoing: requests.filter((r) => r.direction === 'outgoing'),
    loaded: snap.loaded,
    loading: snap.loading,
    error: snap.error,
    busyId: snap.busyId,
    refresh: () => refreshFriends(true),
    send,
    accept: (id: string) => act(id, () => acceptFriendRequest(id), 'Could not accept request'),
    decline: (id: string) => act(id, () => declineFriendRequest(id), 'Could not decline request'),
    cancel: (id: string) => act(id, () => cancelFriendRequest(id), 'Could not cancel request'),
    remove: (accountId: string) =>
      act(accountId, () => removeFriend(accountId), 'Could not remove friend'),
  }
}
