import { api, ApiError } from './leaderboard'
import { announceSecrets, SECRETS, type SecretFound } from './secrets'

/*
 * The site's easter eggs (components/EasterEggs.tsx), each hiding a secret trophy (lib/secrets.ts), kept on
 * the player's shelf when they're signed in, and each with a clue:
 * - The old cheat code, ↑↑↓↓←→←→BA (or on a phone the same swipes and two taps), turns the arcade 8-bit.
 *   Its clue is scratched faintly into the footer.
 * - Seven quick taps on the logo make it blip. Till a device has done it, the logo pings now and then.
 * - "do a barrel roll" in the search spins the page (lib/eggWords.ts). A search that finds nothing says so.
 * - Old game cheats, typed or searched, answer back (lib/eggWords.ts). The code on the wall hints at them,
 *   and so does a search that finds nothing, once the barrel roll is done.
 * - Left alone for a minute, the site's screen saver bounces the blip round the screen, and it hits a
 *   corner in the end (components/BlipSaver.tsx). It shows itself.
 * - A page that isn't there is a Game Over screen with a coin slot (pages/GameOverPage.tsx). A faint
 *   "Level 256" in the footer leads to one.
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

export type EggKey = 'konami' | 'blip' | 'barrelroll' | 'corner' | 'cheats' | 'continue'

/** Where a device remembers it found an egg (the blip's key is older than the rest). */
function doneKey(key: EggKey) {
  return key === 'blip' ? 'skermix-blip-found' : `skermix-egg-${key}`
}

/** This device has found the egg, so its clue can step aside. */
export function eggDone(key: EggKey): boolean {
  try {
    return localStorage.getItem(doneKey(key)) === '1'
  } catch {
    return false
  }
}

function markEggDone(key: EggKey) {
  try {
    localStorage.setItem(doneKey(key), '1')
  } catch {
    /* storage may be off; the clue just stays */
  }
}

/** Eggs the API has answered for this visit, and eggs the pop-up has told a signed-out player about. */
const reported = new Set<EggKey>()
const toldSignedOut = new Set<EggKey>()

/**
 * An egg found. Its secret goes on the player's shelf if they're signed in and haven't found it before,
 * and the pop-up says so; signed out, the pop-up says what signing in would keep, once a visit. Found
 * again the same visit, signed in, it doesn't ask twice.
 */
export async function reportEgg(key: EggKey): Promise<void> {
  markEggDone(key)
  if (reported.has(key)) return
  reported.add(key)
  try {
    const { found } = await api<{ found: SecretFound | null }>('/secrets/found', { method: 'POST', body: JSON.stringify({ key }) })
    if (found) announceSecrets([found])
  } catch (err) {
    // Worth another go on the next find, signed in by then perhaps.
    reported.delete(key)
    if (!(err instanceof ApiError) || err.status !== 401 || toldSignedOut.has(key)) return
    toldSignedOut.add(key)
    const secret = SECRETS.find((s) => s.key === key)
    if (secret) announceSecrets([{ ...secret, signedOut: true }])
  }
}
