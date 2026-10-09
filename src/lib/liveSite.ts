/**
 * Whether this is the live site (production), not staging or a laptop: for a game held back on the live site
 * while staging keeps it to try. In a browser, by the address; in a build (scripts/prerender.mjs loads the
 * games in Node), by Vercel's environment, which is 'production' only for the live site's builds. The API
 * holds the same games back on its live service (its store.ts LIVE_ON_DECK_GAMES).
 */
const LIVE_HOSTS = ['ramseys-arcade.vercel.app', 'blipka.com', 'www.blipka.com']

const nodeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env

export const LIVE_SITE: boolean =
  typeof window !== 'undefined' ? LIVE_HOSTS.includes(window.location.hostname) : nodeEnv?.VERCEL_ENV === 'production'
