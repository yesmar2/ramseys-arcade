import { useSyncExternalStore } from 'react'
import { currentAccountId, subscribeAccountId } from '../lib/auth'

/**
 * The account signed in now (lib/auth.ts's currentAccountId): its id, null signed out, or undefined while
 * the session's account isn't known yet. Drawn again whenever it changes, here or in another tab.
 */
export function useAccountId(): string | null | undefined {
  return useSyncExternalStore(subscribeAccountId, currentAccountId, () => null)
}
