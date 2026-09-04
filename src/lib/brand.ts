/** Public product name (UI, PWA, share text). */
export const APP_NAME = 'Skermix'

/** Public site host used in legal copy. */
export const SITE_HOST = 'skermix.com'

/**
 * Split mark for header/hero — accent color on the second half.
 * "Sker" + "mix"
 */
export const APP_NAME_LEAD = 'Sker'
export const APP_NAME_ACCENT = 'mix'

/** Optional contact email for legal pages (`VITE_CONTACT_EMAIL`). */
export const CONTACT_EMAIL =
  (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || ''
