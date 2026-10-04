import { ACCOUNT_ID_EVENT } from './accountEvents'
import { currentAccountId } from './auth'
import { api, ApiError } from './leaderboard'
import { announceSecrets, SECRETS, type SecretFound } from './secrets'

/*
 * The site's easter eggs (components/EasterEggs.tsx), each hiding a secret trophy (lib/secrets.ts), kept on
 * the player's shelf when they're signed in, and each with a clue:
 * - The old cheat code, ↑↑↓↓←→←→BA (or on a phone just the swipes), turns the arcade 8-bit. Its clue is
 *   scratched very faintly into the footer, without the BA on a phone.
 * - Seven quick taps on the logo make it blip. Till a device has done it, the logo pings now and then.
 * - "do a barrel roll" in the search spins the page (lib/eggWords.ts). A search that finds nothing says so.
 * - Old game cheats, typed or searched, answer back (lib/eggWords.ts). The code on the wall hints at them,
 *   and so does a search that finds nothing, once the barrel roll is done.
 * - Left alone for three minutes, the site's screen saver bounces the blip round the screen, and it hits a
 *   corner in the end (components/BlipSaver.tsx). It shows itself.
 * - A page that isn't there is a Game Over screen with a coin slot (pages/GameOverPage.tsx). A faint
 *   "Level 256" in the footer leads to one.
 * - In Centroid, a balanced plate tapped again while it sits on its pin shatters (games/dead-center).
 *   Till a device has broken one, a balanced plate shows a faint hairline crack round its pin.
 * - Nine more live in their games, each with its clue in its own files (the admin page's Trophies tab
 *   says each one in full): Crosswalk's crossing button that does nothing; Bop's lever pulled down to the
 *   cherries; three donuts in Hot Lap; three falls before Marble Run's first checkpoint; a wave of
 *   Patriot without a shot; Pellets' safe spot; the alien in Lander's cave; a shooting star over the
 *   Fireflies pond; and Barrage's moon, shot till it has a black eye.
 */

const EIGHT_BIT_KEY = 'skermix-eightbit'
/** 8-bit mode went on or off. */
export const EIGHT_BIT_EVENT = 'skermix:eightbit'

/** The pixel face 8-bit mode sets everything in, fetched the first time it's needed. */
const PIXEL_FONT = 'https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;500;600;700&display=swap'

/** The pixel face, for 8-bit mode and the Game Over screen, fetched once. */
export function loadPixelFont() {
  if (document.querySelector('link[data-pixel-font]')) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = PIXEL_FONT
  link.dataset.pixelFont = ''
  document.head.append(link)
}

export function isEightBit(): boolean {
  try {
    return localStorage.getItem(EIGHT_BIT_KEY) === '1'
  } catch {
    return false
  }
}

/** Put the page in 8-bit or back, as the device last had it or as asked. */
export function applyEightBit(on = isEightBit()) {
  const root = document.documentElement
  if (!on) {
    delete root.dataset.eightbit
    return
  }
  loadPixelFont()
  root.dataset.eightbit = ''
}

export function setEightBit(on: boolean) {
  try {
    if (on) localStorage.setItem(EIGHT_BIT_KEY, '1')
    else localStorage.removeItem(EIGHT_BIT_KEY)
  } catch {
    /* storage may be off; this visit still flips */
  }
  applyEightBit(on)
  window.dispatchEvent(new Event(EIGHT_BIT_EVENT))
}

export type EggKey =
  | 'konami'
  | 'blip'
  | 'barrelroll'
  | 'corner'
  | 'cheats'
  | 'continue'
  | 'shatter'
  | 'placebo'
  | 'jackpot'
  | 'donuts'
  | 'marbles'
  | 'wargames'
  | 'safespot'
  | 'alien'
  | 'shootingstar'
  | 'moon'

/*
 * Whether an egg is found is the account's, while one is signed in, and the device's while signed out. Two
 * accounts on one device each find every egg for themselves (Ramsey, 2026-10-01: "when signing in a
 * different account, the secrets don't seem to work"), and an egg found on another device puts its clue
 * away here too. The account's are the API's (GET /secrets/found), asked whenever the account changes and
 * kept on the device under the account, so a clue knows at once on the next visit.
 */

/** Where a device remembers it found an egg signed out (the blip's key is older than the rest). */
function doneKey(key: EggKey) {
  return key === 'blip' ? 'skermix-blip-found' : `skermix-egg-${key}`
}

/** Where a device remembers an account found an egg. */
function accountDoneKey(key: EggKey, account: string) {
  return `skermix-egg-${key}@${account}`
}

/** The secrets the account signed in has found, as the API says; null till it has said. */
let accountFound: { account: string; keys: Set<string> } | null = null

function refreshAccountFound() {
  const account = currentAccountId()
  if (typeof account !== 'string') {
    accountFound = null
    return
  }
  if (accountFound?.account !== account) accountFound = null
  api<{ found: number[] }>('/secrets/found')
    .then(({ found }) => {
      if (currentAccountId() !== account) return
      const keys = new Set<string>(found.map((n) => SECRETS.find((s) => s.n === n)?.key).filter((k): k is NonNullable<typeof k> => Boolean(k)))
      // An egg found here while the question was out isn't in the answer yet: keep what this device knows too.
      for (const s of SECRETS) {
        try {
          if (localStorage.getItem(accountDoneKey(s.key as EggKey, account)) === '1') keys.add(s.key)
        } catch {
          break
        }
      }
      accountFound = { account, keys }
      try {
        for (const key of keys) localStorage.setItem(accountDoneKey(key as EggKey, account), '1')
      } catch {
        /* the API's answer still holds this visit */
      }
    })
    .catch(() => {
      /* the device's word for the account stands */
    })
}

if (typeof window !== 'undefined') {
  window.addEventListener(ACCOUNT_ID_EVENT, refreshAccountFound)
  // Once the site's up and the session's known.
  window.setTimeout(refreshAccountFound, 1500)
}

/** Whoever's playing has found the egg, so its clue can step aside: the account signed in, or this device. */
export function eggDone(key: EggKey): boolean {
  const account = currentAccountId()
  if (typeof account === 'string' && accountFound?.account === account) return accountFound.keys.has(key)
  try {
    return localStorage.getItem(typeof account === 'string' ? accountDoneKey(key, account) : doneKey(key)) === '1'
  } catch {
    return false
  }
}

function markEggDone(key: EggKey, account: string | null) {
  try {
    localStorage.setItem(account ? accountDoneKey(key, account) : doneKey(key), '1')
  } catch {
    /* storage may be off; the clue just stays */
  }
  if (account && accountFound?.account === account) accountFound.keys.add(key)
}

/**
 * Eggs the API has answered for this visit, and eggs the pop-up has told a signed-out player about, each
 * under who found it: another account signed in on the same visit finds them all again.
 */
const reported = new Set<string>()
const toldSignedOut = new Set<string>()

/**
 * An egg found. Its secret goes on the player's shelf if they're signed in and haven't found it before,
 * and the pop-up says so; signed out, the pop-up says what signing in would keep, once a visit. Found
 * again the same visit by the same player, it doesn't ask twice.
 */
export async function reportEgg(key: EggKey): Promise<void> {
  const account = currentAccountId()
  const who = `${typeof account === 'string' ? account : 'out'}:${key}`
  if (typeof account !== 'string') markEggDone(key, null)
  if (reported.has(who)) return
  reported.add(who)
  try {
    const { found, code } = await api<{ found: SecretFound | null; code?: string }>('/secrets/found', {
      method: 'POST',
      body: JSON.stringify({ key }),
    })
    // Found now or before, it's the account's; with no tag yet, it can be found again once there is one.
    if (typeof account === 'string' && code !== 'NO_TAG') markEggDone(key, account)
    else if (code === 'NO_TAG') reported.delete(who)
    if (found) announceSecrets([found])
  } catch (err) {
    // Worth another go on the next find, signed in by then perhaps.
    reported.delete(who)
    if (!(err instanceof ApiError) || err.status !== 401 || toldSignedOut.has(key)) return
    toldSignedOut.add(key)
    const secret = SECRETS.find((s) => s.key === key)
    if (secret) announceSecrets([{ ...secret, signedOut: true }])
  }
}
