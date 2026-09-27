import { api, ApiError } from './leaderboard'
import { announceSecrets, SECRETS, type SecretFound } from './secrets'

/*
 * The site's easter eggs (components/EasterEggs.tsx). The old cheat code, ↑↑↓↓←→←→BA (or on a phone the
 * same swipes and two taps), turns the arcade 8-bit; tapping the logo seven times makes it blip. Each
 * hides a secret trophy (lib/secrets.ts), kept on the player's shelf when they're signed in. Each has a
 * clue: the code is scratched faintly into the footer, and the logo pings now and then till it's blipped.
 */

const EIGHT_BIT_KEY = 'skermix-eightbit'
/** 8-bit mode went on or off. */
export const EIGHT_BIT_EVENT = 'skermix:eightbit'

/** The pixel face 8-bit mode sets everything in, fetched the first time it's needed. */
const PIXEL_FONT = 'https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;500;600;700&display=swap'

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
  if (!document.querySelector('link[data-pixel-font]')) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = PIXEL_FONT
    link.dataset.pixelFont = ''
    document.head.append(link)
  }
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

const BLIP_FOUND_KEY = 'skermix-blip-found'

/** This device has made the logo blip, so it no longer needs the ping that hints at it. */
export function blipFound(): boolean {
  try {
    return localStorage.getItem(BLIP_FOUND_KEY) === '1'
  } catch {
    return false
  }
}

export function rememberBlip() {
  try {
    localStorage.setItem(BLIP_FOUND_KEY, '1')
  } catch {
    /* storage may be off; the logo just keeps pinging */
  }
}

export type EggKey = 'konami' | 'blip'

/**
 * An egg found. Its secret goes on the player's shelf if they're signed in and haven't found it before,
 * and the pop-up says so; signed out, the pop-up says what signing in would keep.
 */
export async function reportEgg(key: EggKey): Promise<void> {
  try {
    const { found } = await api<{ found: SecretFound | null }>('/secrets/found', { method: 'POST', body: JSON.stringify({ key }) })
    if (found) announceSecrets([found])
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) return
    const secret = SECRETS.find((s) => s.key === key)
    if (secret) announceSecrets([{ ...secret, signedOut: true }])
  }
}
