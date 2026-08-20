import { useEffect, useState } from 'react'
import {
  AUTH_EVENT,
  fetchAuthMe,
  getSessionToken,
  type Account,
} from '../lib/auth'

export function useAuth() {
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(() => Boolean(getSessionToken()))

  useEffect(() => {
    let cancelled = false
    const sync = async () => {
      if (!getSessionToken()) {
        if (!cancelled) {
          setAccount(null)
          setLoading(false)
        }
        return
      }
      setLoading(true)
      try {
        const me = await fetchAuthMe()
        if (!cancelled) setAccount(me?.account ?? null)
      } catch {
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
