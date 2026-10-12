import { useEffect, useState } from 'react'
import {
  AUTH_EVENT,
  dropSignedOutIdentity,
  fetchAuthMe,
  getAuthGeneration,
  getSessionToken,
  type Account,
} from '../lib/auth'
import { FREE_LIMITS, type PlanLimits } from '../lib/plans'

let cachedAccount: Account | null = null
/** Travels with the account: same fetch, same lifetime, same invalidation. */
let cachedLimits: PlanLimits = FREE_LIMITS
let inflightMe: Promise<Account | null> | null = null
let inflightGeneration = -1
let lastMeFetchAt = 0
const ME_CACHE_MS = 60_000

/*
 * /auth/me not reached (anything but a 401, which ends the session): while the session's account isn't known,
 * it's asked again on its own, soon and then less often. Every useAuth hears how any asking went (ME_EVENT), not
 * only the ones that asked: a menu just opened may be the one whose asking gets through.
 */
const ME_EVENT = 'arcade-auth-me'
const RETRY_FIRST_MS = 2_000
const RETRY_MOST_MS = 60_000
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryWait = 0

function stopRetrying() {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
  retryWait = 0
}

function retryLater() {
  if (retryTimer || typeof window === 'undefined') return
  retryWait = retryWait ? Math.min(retryWait * 2, RETRY_MOST_MS) : RETRY_FIRST_MS
  retryTimer = setTimeout(() => {
    retryTimer = null
    void loadAuthMe(true)
  }, retryWait)
}

/** Ask /auth/me again now (the menu's Try again), rather than at the next retry: every useAuth hears the answer. */
export async function retryAuth(): Promise<void> {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
  await loadAuthMe(true)
}

async function loadAuthMe(force = false): Promise<Account | null> {
  if (!getSessionToken()) {
    cachedAccount = null
    cachedLimits = FREE_LIMITS
    inflightMe = null
    inflightGeneration = -1
    stopRetrying()
    return null
  }
  const generation = getAuthGeneration()
  const now = Date.now()
  if (
    !force &&
    cachedAccount &&
    now - lastMeFetchAt < ME_CACHE_MS &&
    inflightGeneration === generation
  ) {
    return cachedAccount
  }
  // Reuse only an in-flight fetch for this same session generation.
  if (inflightMe && inflightGeneration === generation) return inflightMe

  inflightGeneration = generation
  inflightMe = (async () => {
    try {
      const me = await fetchAuthMe()
      if (getAuthGeneration() !== generation) {
        return cachedAccount
      }
      const next = me?.account ?? null
      cachedAccount = next
      cachedLimits = me?.limits ?? FREE_LIMITS
      lastMeFetchAt = Date.now()
      // Answered: whose the session is, or (a 401) that it's over.
      stopRetrying()
      return next
    } catch {
      if (!cachedAccount) retryLater()
      return cachedAccount
    } finally {
      if (inflightGeneration === generation) {
        inflightMe = null
      }
      // Whichever hook asked, every one takes the answer (or the failure) up.
      if (typeof window !== 'undefined') window.dispatchEvent(new Event(ME_EVENT))
    }
  })()

  return inflightMe
}

export function useAuth() {
  const [account, setAccount] = useState<Account | null>(() => cachedAccount)
  const [limits, setLimits] = useState<PlanLimits>(() => cachedLimits)
  const [loading, setLoading] = useState(
    () => Boolean(getSessionToken()) && !cachedAccount,
  )
  // Whether this device has a session: none is signed out, and one is signed in once /auth/me says whose it is.
  // Until it answers, or when it fails with anything but a 401 (which ends the session), it's neither.
  const [session, setSession] = useState(() => Boolean(getSessionToken()))

  useEffect(() => {
    let cancelled = false
    const sync = async (force = false) => {
      if (!getSessionToken()) {
        cachedAccount = null
        cachedLimits = FREE_LIMITS
        inflightMe = null
        inflightGeneration = -1
        stopRetrying()
        // A tag a session left behind isn't this signed-out viewer's.
        dropSignedOutIdentity()
        if (!cancelled) {
          setAccount(null)
          setLimits(FREE_LIMITS)
          setLoading(false)
          setSession(false)
        }
        return
      }
      setSession(true)
      if (!cachedAccount || force) setLoading(true)
      const next = await loadAuthMe(force)
      if (!cancelled) {
        setAccount(next)
        setLimits(cachedLimits)
        setLoading(false)
      }
    }
    void sync()
    const onAuth = () => void sync(true)
    const onFocus = () => {
      if (getSessionToken()) void sync(false)
    }
    // A retry, or the menu's Try again, answered: take its word, whichever hook asked (unless a newer asking is out).
    const onMe = () => {
      if (cancelled || inflightMe) return
      setAccount(cachedAccount)
      setLimits(cachedLimits)
      setLoading(false)
    }
    window.addEventListener(AUTH_EVENT, onAuth)
    window.addEventListener(ME_EVENT, onMe)
    window.addEventListener('storage', onAuth)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      cancelled = true
      window.removeEventListener(AUTH_EVENT, onAuth)
      window.removeEventListener(ME_EVENT, onMe)
      window.removeEventListener('storage', onAuth)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [])

  return {
    account,
    limits,
    loading,
    signedIn: Boolean(account),
    /** No session on this device: the only time to ask anyone to sign in. Neither this nor signedIn while a session's account isn't known. */
    signedOut: !account && !session,
    isPlus: account?.plan === 'plus',
  }
}
