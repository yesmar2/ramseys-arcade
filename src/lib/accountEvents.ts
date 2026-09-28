/*
 * The names that say which account is signed in, and the one way to hear them change, on their own with
 * nothing imported: the dailies' device stores (lib/deviceRuns.ts) listen through here, and Half Full's
 * store is loaded outside the site too (the API's check-halffull script), where lib/auth can't be.
 */

export const SESSION_KEY = 'arcade-session'
/** The signed-in account's id, with the session it belongs to (auth.ts's currentAccountId). */
export const SESSION_ACCOUNT_KEY = 'arcade-session-account'
export const AUTH_EVENT = 'arcade-auth'
/** Which account is signed in changed: signed in, out, or to another, or the session's account came to be known. */
export const ACCOUNT_ID_EVENT = 'arcade-account-id'

/** Hear the signed-in account change, in this tab or another. */
export function subscribeAccountId(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    // A storage cleared all at once names no key.
    if (e.key == null || e.key === SESSION_KEY || e.key === SESSION_ACCOUNT_KEY) onChange()
  }
  window.addEventListener(ACCOUNT_ID_EVENT, onChange)
  window.addEventListener(AUTH_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(ACCOUNT_ID_EVENT, onChange)
    window.removeEventListener(AUTH_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}
