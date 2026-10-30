import { createHash, timingSafeEqual } from 'node:crypto'
import { gatePassword, makePass, PASS_COOKIE, PASS_DAYS, passFromCookies, passValid } from './api/_gate.js'

/*
 * The coming-soon gate, and the one address the site goes by: Vercel's Routing Middleware, run before every
 * page and function (not the built files, see `config`).
 *
 * Until launch the site is up but not open (Ramsey, 2026-10-13): anyone without the password gets the
 * coming-soon page (public/soon.html) at whatever address they asked for. It takes emails for opening day
 * (the API's /launch-list) and has a quiet "Have a password?" for Ramsey and his testers; the right password
 * sets a pass good for 30 days on that browser (api/_gate.js). The password goes in without its capitals and
 * spaces mattering, since a phone's keyboard adds both.
 *
 * Two settings on Vercel (Production), each doing nothing while it's unset, so this file changes nothing on
 * its own:
 * - SITE_PASSWORD closed the site behind the gate until launch. The site is open for good now, whatever it says
 *   (api/_gate.js gatePassword).
 * - CANONICAL_HOST is the address the site goes by (blipka.com). Any other address on production (the old
 *   ramseys-arcade.vercel.app) answers with a permanent redirect to it, path and all. Its www twin is left to
 *   Vercel's domain setting, whichever way that goes.
 *
 * A browser whose service worker kept the app from before opens it without asking the server, so the app asks
 * instead (src/lib/gate.ts): GET /__gate says whether it may run here, or where it lives now.
 */

export const config = {
  runtime: 'nodejs',
  // Pages, functions and /__gate. The built files are the same for everyone (and their hashed names say
  // nothing), and the coming-soon page needs its pictures and font for the people it stops.
  matcher: ['/((?!assets/|fonts/|soon/|og/|_vercel/).*)'],
}

const GATE = '/__gate'
const SOON = '/soon.html'

/**
 * What anyone may have with the gate closed: the coming-soon page and what it shows, the service worker, so a
 * browser that kept the app from before can take the update that lets it go, and the Privacy Policy and Terms.
 * Google's sign-in branding check and the payments sign-up read those before launch (Ramsey, 2026-10-16: "let
 * the privacy and terms pages through"). The app runs on them, and goes back to the server for any other page
 * (src/lib/gate.ts OPEN_PAGES).
 */
const OPEN = new Set([SOON, '/favicon.svg', '/apple-touch-icon.png', '/og.png', '/robots.txt', '/sw.js', '/privacy', '/privacy/', '/terms', '/terms/'])

/** @param {Request} request */
export default async function middleware(request) {
  const url = new URL(request.url)
  const home = canonicalHost()
  if (home && !sameSite(url.hostname, home) && !keepsItsHost(url)) {
    if (url.pathname === GATE) return json({ ok: false, go: `https://${home}` })
    return Response.redirect(`https://${home}${url.pathname}${url.search}`, 308)
  }

  const password = gatePassword()
  if (!password) {
    if (url.pathname === GATE) return json({ ok: true })
    // Open: the live site is done with the coming-soon page (it stays to look at on staging).
    if (url.pathname === SOON && process.env.VERCEL_ENV === 'production') return Response.redirect(new URL('/', url), 302)
    return undefined
  }

  if (url.pathname === GATE) {
    if (request.method === 'POST') return unlock(request, password)
    return json({ ok: hasPass(request, password) })
  }
  if (OPEN.has(url.pathname) || hasPass(request, password)) return undefined
  return rewrite(new URL(SOON, url))
}

/**
 * The site's own address, with www or without. Which of the two the other redirects to is Vercel's domain
 * setting (Settings → Domains); redirecting between them here too sent visitors round in a loop the day
 * blipka.com went up (Vercel sent blipka.com to www, this sent www back).
 * @param {string} host
 * @param {string} home
 */
function sameSite(host, home) {
  const bare = (/** @type {string} */ name) => name.replace(/^www\./, '')
  return bare(host) === bare(home)
}

/** The address the live site goes by, when one is set; only production redirects to it. */
function canonicalHost() {
  if (process.env.VERCEL_ENV !== 'production') return null
  const host = process.env.CANONICAL_HOST?.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  return host || null
}

/**
 * What stays on an old address: the service worker, and its fetches of the files it keeps (Workbox marks them
 * __WB_REVISION__). A redirect would fail its update and leave that browser on the old app for good; the new
 * one moves itself (src/lib/gate.ts).
 * @param {URL} url
 */
function keepsItsHost(url) {
  return url.pathname === '/sw.js' || url.searchParams.has('__WB_REVISION__')
}

/**
 * @param {Request} request
 * @param {string} password
 */
function hasPass(request, password) {
  return passValid(passFromCookies(request.headers.get('cookie')), password)
}

/**
 * POST /__gate, from the coming-soon page: the password, and where to go after (`next`). Answers JSON to the
 * page's script; a plain form post (no script) is sent on with a 303.
 * @param {Request} request
 */
async function unlock(request, /** @type {string} */ password) {
  const script = (request.headers.get('accept') ?? '').includes('application/json')
  const form = await request.formData().catch(() => null)
  const next = samePagePath(String(form?.get('next') ?? '/'))
  const who = clientAddress(request)

  const wait = waitBeforeTry(who)
  if (wait > 0) {
    return script ? json({ ok: false, code: 'TOO_MANY', retryAfter: Math.ceil(wait / 1000) }, 429) : seeOther(next)
  }
  if (!samePassword(String(form?.get('password') ?? ''), password)) {
    noteWrongTry(who)
    // A guess costs a moment, however many come at once.
    await new Promise((done) => setTimeout(done, WRONG_TRY_DELAY_MS))
    return script ? json({ ok: false, code: 'WRONG' }, 401) : seeOther(next)
  }
  wrongTries.delete(who)

  const maxAge = PASS_DAYS * 24 * 60 * 60
  const pass = makePass(password, Math.floor(Date.now() / 1000) + maxAge)
  const cookie = `${PASS_COOKIE}=${pass}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`
  return script ? json({ ok: true }, 200, { 'set-cookie': cookie }) : seeOther(next, { 'set-cookie': cookie })
}

/** Capitals and the spaces around it don't matter; compared in constant time all the same. */
function samePassword(/** @type {string} */ given, /** @type {string} */ password) {
  const digest = (/** @type {string} */ text) => createHash('sha256').update(text.trim().toLowerCase()).digest()
  return timingSafeEqual(digest(given), digest(password))
}

/*
 * Wrong tries, by the address they come from: after FREE_TRIES in a row, one a minute; a quarter of an hour
 * without one starts over. Everyone's together, too, so many addresses can't share the guessing. Kept in this
 * instance's memory: a best effort, which with the delay above is plenty for a password nobody can look up.
 */
const FREE_TRIES = 5
const TRY_GAP_MS = 60_000
const FORGET_MS = 15 * 60_000
const WRONG_TRY_DELAY_MS = 400
const EVERYONE_PER_MINUTE = 60
/** @type {Map<string, { count: number, last: number }>} */
const wrongTries = new Map()
let everyone = { minute: 0, count: 0 }

/** How long `who` must wait before trying again; 0 to go ahead. */
function waitBeforeTry(/** @type {string} */ who, now = Date.now()) {
  const minute = Math.floor(now / 60_000)
  if (everyone.minute === minute && everyone.count >= EVERYONE_PER_MINUTE) return (minute + 1) * 60_000 - now
  const tries = wrongTries.get(who)
  if (!tries) return 0
  if (now - tries.last > FORGET_MS) {
    wrongTries.delete(who)
    return 0
  }
  return tries.count >= FREE_TRIES ? Math.max(0, tries.last + TRY_GAP_MS - now) : 0
}

function noteWrongTry(/** @type {string} */ who, now = Date.now()) {
  const minute = Math.floor(now / 60_000)
  everyone = everyone.minute === minute ? { minute, count: everyone.count + 1 } : { minute, count: 1 }
  // A flood of addresses can't grow the map past this; forgetting them all only lets each try a few more times.
  if (wrongTries.size >= 10_000) wrongTries.clear()
  const tries = wrongTries.get(who)
  wrongTries.set(who, { count: tries && now - tries.last <= FORGET_MS ? tries.count + 1 : 1, last: now })
}

/** @param {Request} request */
function clientAddress(request) {
  return request.headers.get('x-real-ip') || (request.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown'
}

/** A path on this site to go on to, never another site's address. */
function samePagePath(/** @type {string} */ path) {
  return path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\') ? path : '/'
}

/**
 * Vercel serves `to` in place of the address asked for, as @vercel/functions' rewrite() does.
 * @param {URL} to
 */
function rewrite(to) {
  return new Response(null, { headers: { 'x-middleware-rewrite': String(to) } })
}

/**
 * @param {unknown} body
 * @param {Record<string, string>} [headers]
 */
function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  })
}

/**
 * @param {string} path
 * @param {Record<string, string>} [headers]
 */
function seeOther(path, headers = {}) {
  return new Response(null, { status: 303, headers: { location: path, 'cache-control': 'no-store', ...headers } })
}
