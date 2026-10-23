/*
 * A release while the site is open, taken without a reload screen (Ramsey, 2026-10-23: "is there a better way of
 * handling an updating service worker, than just showing a reload page?").
 *
 * A release renames the files of pages and games, and the server only has the new names. An open tab still runs
 * the release it opened with, so a page or game it hasn't opened yet asks for a file that's gone. So:
 * - Once this tab knows a release has come (its service worker was replaced, or a file it asked for was gone),
 *   the next link tapped opens as a full page load, onto the new release (takeNewRelease, from the router's
 *   link handler). Never from a game being played, and never while a save is on its way.
 * - A page whose own file is gone keeps its loading look and reloads onto the new release (loadOrUpdate, through
 *   lazyPage); a part of a page keeps its placeholder (lazyPart).
 * Nothing reloads under a game being played: a reload comes only before a page has opened, or after it broke.
 */

/** A page's or part's file that didn't come: offline, or gone in a release since this tab opened. */
export const MISSING_FILE =
  /dynamically imported module|Importing a module script failed|Unable to preload CSS|error loading dynamically/i

export function isMissingFile(error: unknown): boolean {
  return MISSING_FILE.test(error instanceof Error ? error.message : String(error ?? ''))
}

const online = () => typeof navigator === 'undefined' || navigator.onLine !== false

let newRelease = false

/** This tab is running a release that's no longer the site's. */
export function noteNewRelease() {
  if (import.meta.env.PROD) newRelease = true
}

/*
 * Saves and other writes on their way to the API (lib/leaderboard's api): a full page load would cut them off,
 * so the switch waits for them.
 */
let writing = 0

export function trackWrite<T>(request: Promise<T>): Promise<T> {
  writing += 1
  const done = () => {
    writing -= 1
  }
  request.then(done, done)
  return request
}

async function writesDone(ms: number) {
  const until = Date.now() + ms
  while (writing > 0 && Date.now() < until) await new Promise((done) => window.setTimeout(done, 100))
}

/** A game's play page, its own or an event's, where a run may be going. */
const PLAY_PATH = /^\/games\/[^/]+\/(?:play|daily)\/?$|^\/tournaments\/[^/]+\/play\//
const playing = () => PLAY_PATH.test(window.location.pathname)

/**
 * A link was tapped: when a release has come, open it as a full page load, onto the new release. True when it
 * did. Never from a play page: the link after the next one does it.
 */
export function takeNewRelease(href: string): boolean {
  if (!newRelease || playing() || writing > 0 || !online()) return false
  window.location.assign(href)
  return true
}

const RELOADED_KEY = 'skermix-chunk-reload'
let reloading = false

/**
 * Reload onto the new release, once the new service worker (if one is on its way) has taken over and writes have
 * gone. False when it won't: offline, or it already reloaded in the last 30 seconds (a release that's broken
 * shouldn't reload forever), and the caller shows its error instead.
 */
export function reloadIntoNewRelease(): boolean {
  if (!import.meta.env.PROD || !online()) return false
  if (reloading) return true
  let last = 0
  try {
    last = Number(sessionStorage.getItem(RELOADED_KEY) ?? 0)
  } catch {
    /* storage may be off; reload once anyway */
  }
  if (Date.now() - last < 30_000) return false
  try {
    sessionStorage.setItem(RELOADED_KEY, String(Date.now()))
  } catch {
    /* as above */
  }
  reloading = true
  newRelease = true
  void Promise.all([newShellReady(8000), writesDone(10_000)]).then(() => window.location.reload())
  return true
}

/**
 * A page's file, or, when it's gone in a release, a wait that never ends while the page reloads onto the new one:
 * the page shows its loading look meanwhile, never an error.
 */
export async function loadOrUpdate<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load()
  } catch (error) {
    if (!isMissingFile(error) || !reloadIntoNewRelease()) throw error
    return new Promise<T>(() => {})
  }
}

/** Resolves once a release's service worker, if one is on its way, has taken over (or `ms` have passed). */
async function newShellReady(ms: number) {
  try {
    const registration = await navigator.serviceWorker?.getRegistration()
    if (!registration) return
    await registration.update().catch(() => {})
    const incoming = registration.installing ?? registration.waiting
    if (!incoming) return
    await new Promise<void>((done) => {
      const timer = window.setTimeout(done, ms)
      incoming.addEventListener('statechange', () => {
        if (incoming.state !== 'activated' && incoming.state !== 'redundant') return
        window.clearTimeout(timer)
        done()
      })
    })
  } catch {
    /* no worker to wait for */
  }
}

/**
 * How often an open tab asks whether a release has come; the browser itself only asks on a full page load. Not
 * while a game is being played: a release's worker clears the last release's kept files as it takes over, and a
 * game may still want one of them.
 */
const CHECK_EVERY_MS = 30 * 60_000
/** Coming back to the tab asks too, at most this often. */
const CHECK_AGAIN_MS = 5 * 60_000

/** Call once at start: notice a release's service worker taking over this tab, and ask for one now and then. */
export function bootAppUpdate() {
  const workers = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker
  if (!import.meta.env.PROD || !workers) return
  // A first visit's worker taking charge isn't a release (lib/offlineCopy.ts); any worker after one is.
  let hadWorker = Boolean(workers.controller)
  workers.addEventListener('controllerchange', () => {
    if (hadWorker) noteNewRelease()
    hadWorker = true
  })

  let lastCheck = Date.now()
  const check = () => {
    if (playing()) return
    lastCheck = Date.now()
    void workers.getRegistration().then((registration) => registration?.update().catch(() => {}))
  }
  window.setInterval(() => {
    if (document.visibilityState === 'visible') check()
  }, CHECK_EVERY_MS)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastCheck > CHECK_AGAIN_MS) check()
  })
}
