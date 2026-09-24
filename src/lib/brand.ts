/**
 * Public product name (UI, PWA, share text). The wordmark is drawn, not
 * typed: see BrandMark and lib/wordmark.
 *
 * Saved settings keep their `skermix-` keys from the old name, so a rename
 * doesn't reset anyone's theme, sounds or recent games.
 */
export const APP_NAME = 'Blipka'

/** Public site host used in legal copy. */
export const SITE_HOST = 'blipka.com'

/** Optional contact email for legal pages (`VITE_CONTACT_EMAIL`). */
export const CONTACT_EMAIL =
  (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || ''
