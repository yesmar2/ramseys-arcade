import { createHmac, timingSafeEqual } from 'node:crypto'

/*
 * The coming-soon gate's pass (middleware.js): a cookie saying this browser gave the password. It's signed with
 * the password itself, so nobody can make one without knowing it, and changing SITE_PASSWORD on Vercel signs
 * everyone out. It lives here rather than in middleware.js because the page functions' reads of the site's own
 * pages go through the gate like anyone's, and need a pass of their own while it's closed.
 */

export const PASS_COOKIE = 'blipka-pass'

/** How long a pass lasts: a tester types the password once a month, not once a visit. */
export const PASS_DAYS = 30

/**
 * The gate's password; null when the gate is open. Blipka opened on Oct 30, 2026, and the gate stays open
 * whatever SITE_PASSWORD says: deleting it on Vercel asked Ramsey for a two-factor code he didn't have. To close
 * the site again, read `process.env.SITE_PASSWORD?.trim() || null` here as before.
 */
export function gatePassword() {
  return null
}

/**
 * @param {string} password
 * @param {number} until Seconds since 1970.
 */
function sign(password, until) {
  return createHmac('sha256', password).update(`${PASS_COOKIE}.${until}`).digest('base64url')
}

/**
 * A pass good until `until`.
 * @param {string} password
 * @param {number} until Seconds since 1970.
 */
export function makePass(password, until) {
  return `${until}.${sign(password, until)}`
}

/**
 * Whether a pass is one this password made, and not past its day.
 * @param {string | null} pass
 * @param {string} password
 */
export function passValid(pass, password, now = Date.now()) {
  const [untilText = '', signature = ''] = String(pass ?? '').split('.')
  const until = Number(untilText)
  if (!signature || !Number.isInteger(until) || until * 1000 <= now) return false
  const want = Buffer.from(sign(password, until))
  const got = Buffer.from(signature)
  return want.length === got.length && timingSafeEqual(want, got)
}

/**
 * The pass among a request's cookies.
 * @param {string | null | undefined} header The Cookie header.
 */
export function passFromCookies(header) {
  for (const part of String(header ?? '').split(';')) {
    const at = part.indexOf('=')
    if (at > 0 && part.slice(0, at).trim() === PASS_COOKIE) return part.slice(at + 1).trim()
  }
  return null
}

/**
 * Headers for a function's own read of the site's pages: while the gate is closed, a pass good for a minute,
 * or the read would come back as the coming-soon page.
 * @returns {Record<string, string>}
 */
export function ownReadHeaders() {
  const password = gatePassword()
  if (!password) return {}
  return { cookie: `${PASS_COOKIE}=${makePass(password, Math.floor(Date.now() / 1000) + 60)}` }
}
