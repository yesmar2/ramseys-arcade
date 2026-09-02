import { useEffect, useState } from 'react'
import {
  AUTH_EVENT,
  fetchAuthMe,
  getSessionToken,
  type Account,
} from '../lib/auth'

let cachedAccount: Account | null = null
let inflightMe: Promise<Account | null> | null = null
let lastMeFetchAt = 0
const ME_CACHE_MS = 60_000

async function loadAuthMe(force = false): Promise<Account | null> {
  if (!getSessionToken()) {
    cachedAccount = null
    return null
  }
  const now = Date.now()
  if (!force && cachedAccount && now - lastMeFetchAt < ME_CACHE_MS) {
    return cachedAccount
  }
  if (inflightMe) return inflightMe

  inflightMe = (async () => {
    try {
      const me = await fetchAuthMe()
      const next = me?.account ?? null
      cachedAccount = next
      lastMeFetchAt = Date.now()
      return next
    } catch {
      return cachedAccount
    } finally {
      inflightMe = null
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
