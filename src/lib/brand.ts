/** Public product name (UI, PWA, share text). */
export const APP_NAME = 'Fordriva'

/** Optional contact email for legal pages (`VITE_CONTACT_EMAIL`). */
export const CONTACT_EMAIL =
  (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || ''
