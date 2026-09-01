import { useEffect, useState } from 'react'
import {
  AUTH_EVENT,
  fetchAuthMe,
  getSessionToken,
  type Account,
} from '../lib/auth'

let cachedAccount: Account | null = null

export function useAuth() {
  const [account, setAccount] = useState<Account | null>(() => cachedAccount)
  const [loading, setLoading] = useState(
    () => Boolean(getSessionToken()) && !cachedAccount,
  )

  useEffect(() => {
    let cancelled = false
    const sync = async () => {
      if (!getSessionToken()) {
        cachedAccount = null
        if (!cancelled) {
          setAccount(null)
          setLoading(false)
        }
        return
      }
      if (!cachedAccount) setLoading(true)
      try {
        const me = await fetchAuthMe()
        const next = me?.account ?? null
        cachedAccount = next
        if (!cancelled) setAccount(next)
      } catch {
        cachedAccount = null
        if (!cancelled) setAccount(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void sync()
    const onAuth = () => void sync()
    const onFocus = () => {
      if (getSessionToken()) void sync()
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
