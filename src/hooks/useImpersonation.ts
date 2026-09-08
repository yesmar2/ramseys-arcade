import { useEffect, useState } from 'react'
import {
  getImpersonation,
  IMPERSONATE_EVENT,
  type ImpersonationState,
} from '../lib/impersonate'

/** Live impersonation state from localStorage. */
export function useImpersonation(): ImpersonationState | null {
  const [state, setState] = useState(() => getImpersonation())

  useEffect(() => {
    const sync = () => setState(getImpersonation())
    window.addEventListener(IMPERSONATE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(IMPERSONATE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return state
}
