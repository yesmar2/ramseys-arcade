import { useEffect, useState } from 'react'
import {
  AUTH_EVENT,
  fetchAuthMe,
  getAuthGeneration,
  getSessionToken,
  type Account,
} from '../lib/auth'

let cachedAccount: Account | null = null
let inflightMe: Promise<Account | null> | null = null
let inflightGeneration = -1
let lastMeFetchAt = 0
const ME_CACHE_MS = 60_000

async function loadAuthMe(force = false): Promise<Account | null> {
  if (!getSessionToken()) {
    cachedAccount = null
    inflightMe = null
    inflightGeneration = -1
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
      lastMeFetchAt = Date.now()
      return next
    } catch {
      return cachedAccount
    } finally {
      if (inflightGeneration === generation) {
        inflightMe = null
      }
    }
  })()

  return inflightMe
}

export function useAuth() {
  const [account, setAccount] = useState<Account | null>(() => cachedAccount)
  const [loading, setLoading] = useState(
    () => Boolean(getSessionToken()) && !cachedAccount,
  )

  useEffect(() => {
    let cancelled = false
    const sync = async (force = false) => {
      if (!getSessionToken()) {
        cachedAccount = null
        inflightMe = null
        inflightGeneration = -1
        if (!cancelled) {
          setAccount(null)
          setLoading(false)
        }
        return
      }
      if (!cachedAccount || force) setLoading(true)
      const next = await loadAuthMe(force)
      if (!cancelled) {
        setAccount(next)
        setLoading(false)
      }
    }
    void sync()
    const onAuth = () => void sync(true)
    const onFocus = () => {
      if (getSessionToken()) void sync(false)
    }
    window.addEventListener(AUTH_EVENT, onAuth)
    window.addEventListener('storage', onAuth)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      cancelled = true
      window.removeEventListener(AUTH_EVENT, onAuth)
      window.removeEventListener('storage', onAuth)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [])

  return { account, loading, signedIn: Boolean(account) }
}
