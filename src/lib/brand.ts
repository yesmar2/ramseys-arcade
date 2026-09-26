/**
 * Public product name (UI, PWA, share text). The wordmark is drawn, not
 * typed: see BrandMark and lib/wordmark.
 *
 * Saved settings keep their `skermix-` keys from the old name, so a rename
 * doesn't reset anyone's theme, sounds or recent games.
 */
export const APP_NAME = 'Blipka'

/**
 * The one line the arcade goes by: what it is, and a reason to come back
 * tomorrow. Where a line has to say what Blipka is on its own (search results,
 * link previews, the About page, the site's share card, the installed app).
 * The headline over it stays "Simple games. No ads. Just play."
 */
export const SITE_LINE = `${APP_NAME}: the arcade with no ads, and a new Daily every day.`

/** Public site host used in legal copy. */
export const SITE_HOST = 'blipka.com'

/** Optional contact email for legal pages (`VITE_CONTACT_EMAIL`). */
export const CONTACT_EMAIL =
  (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || ''
