import { useEffect, useSyncExternalStore } from 'react'
import { fetchAuthConfigStrict, getSessionToken, signInWithDiscordCode, type AuthConfig } from './auth'

/*
 * The ways in: Google, Discord, and a code by email. The API says which it can do (GET /auth/config), and
 * the site offers exactly those, so a way shows up the day its keys go into the API's settings and not
 * before. The answer is kept on the device, so a return visit draws the right buttons straight away.
 * Accounts go by email, so the same email any way in is the same player.
 */

export type SignInWay = 'google' | 'discord' | 'email'

export type SignInWays = {
  google: boolean
  /** Discord's id for this app, when the API can sign people in with Discord. */
  discordClientId: string | null
  email: boolean
}

const WAYS_KEY = 'skermix-signin-ways'
const LAST_WAY_KEY = 'skermix-signin-way'
const CONFIG_TIMEOUT_MS = 10_000

/*
 * Before the API has answered, Google's button is drawn as it always was: it asks for its own id and
 * draws nothing on a deployment without one.
 */
const UNTOLD: SignInWays = { google: true, discordClientId: null, email: false }

function fromConfig(config: AuthConfig): SignInWays {
  return {
    google: Boolean(config.googleEnabled && config.googleClientId),
    discordClientId: config.discordEnabled && config.discordClientId ? config.discordClientId : null,
    email: config.emailEnabled === true,
  }
}

function readKept(): SignInWays | null {
  try {
    const raw = localStorage.getItem(WAYS_KEY)
    const kept = raw ? (JSON.parse(raw) as Partial<SignInWays> | null) : null
    if (!kept || typeof kept.google !== 'boolean' || typeof kept.email !== 'boolean') return null
    return {
      google: kept.google,
      discordClientId: typeof kept.discordClientId === 'string' && kept.discordClientId ? kept.discordClientId : null,
      email: kept.email,
    }
  } catch {
    return null
  }
}

let current: SignInWays = readKept() ?? UNTOLD
let asking: Promise<void> | null = null
const listeners = new Set<() => void>()

function publish(next: SignInWays) {
  try {
    localStorage.setItem(WAYS_KEY, JSON.stringify(next))
  } catch {
    /* this page's copy stands in */
  }
  if (next.google === current.google && next.discordClientId === current.discordClientId && next.email === current.email) return
  current = next
  for (const listener of listeners) listener()
}

/** Ask the API once a page; after a failure, the next caller asks again and the kept answer stands meanwhile. */
export function loadSignInWays(): Promise<void> {
  if (!asking) {
    asking = fetchAuthConfigStrict(CONFIG_TIMEOUT_MS).then(
      (config) => publish(fromConfig(config)),
      () => {
        asking = null
      },
    )
  }
  return asking
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useSignInWays(): SignInWays {
  const ways = useSyncExternalStore(subscribe, () => current, () => current)
  useEffect(() => {
    void loadSignInWays()
  }, [])
  return ways
}

/** The ways on, in the order they're offered. */
export function waysOn(ways: SignInWays): SignInWay[] {
  return [
    ...(ways.google ? (['google'] as const) : []),
    ...(ways.discordClientId ? (['discord'] as const) : []),
    ...(ways.email ? (['email'] as const) : []),
  ]
}

const WAY_NAMES: Record<SignInWay, string> = { google: 'Google', discord: 'Discord', email: 'email' }

/** "Google, Discord or email". */
export function wayWords(ways: SignInWay[]): string {
  const names = ways.map((way) => WAY_NAMES[way])
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`
}

/** The way this device last signed in, for a "Last used" mark. */
export function lastSignInWay(): SignInWay | null {
  try {
    const way = localStorage.getItem(LAST_WAY_KEY)
    return way === 'google' || way === 'discord' || way === 'email' ? way : null
  } catch {
    return null
  }
}

export function rememberSignInWay(way: SignInWay) {
  try {
    localStorage.setItem(LAST_WAY_KEY, way)
  } catch {
    /* only a convenience */
  }
}

// Signed out, the buttons are likely wanted soon (a run's end asks): ask while the page is idle.
if (typeof window !== 'undefined' && !getSessionToken()) {
  window.setTimeout(() => void loadSignInWays(), 1500)
}

/* ---------- Discord ---------- */

/*
 * Discord signs people in on its own site and sends them back to ours, at /auth/discord, with a one-time
 * code. It opens in a popup where one can open, so this page and anything waiting on it (a run's result,
 * ready to save) stays as it is: the popup hands the code back here and closes. Where a popup can't open
 * (blocked, or the installed app, whose popups open in another browser with other storage), this tab goes
 * to Discord and comes back to the page it left.
 */

const TRIP_KEY = 'skermix-discord-signin'
const CHANNEL = 'skermix-discord'
const TRIP_TTL_MS = 15 * 60_000

type Trip = { state: string; back: string; at: number; popup: boolean }
type Answer = { type: 'skermix-discord'; state: string; code?: string; error?: string }
type Ack = { type: 'skermix-discord-ack'; state: string }

/** Discord's own cancel, or ours: nothing to say, the buttons just come back. */
export class DiscordCancelled extends Error {
  constructor() {
    super('Discord sign-in was cancelled')
  }
}

export function discordReturnUri(): string {
  return `${window.location.origin}/auth/discord`
}

function readTrip(): Trip | null {
  try {
    const raw = localStorage.getItem(TRIP_KEY)
    const trip = raw ? (JSON.parse(raw) as Partial<Trip> | null) : null
    if (!trip || typeof trip.state !== 'string' || typeof trip.back !== 'string' || typeof trip.at !== 'number') return null
    return { state: trip.state, back: trip.back, at: trip.at, popup: trip.popup === true }
  } catch {
    return null
  }
}

function writeTrip(trip: Trip | null) {
  try {
    if (trip) localStorage.setItem(TRIP_KEY, JSON.stringify(trip))
    else localStorage.removeItem(TRIP_KEY)
  } catch {
    /* the popup can't tell where it came from; it says so */
  }
}

function installedApp(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function popupFeatures(): string {
  const width = 500
  const height = 780
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2))
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2))
  return `popup=yes,width=${width},height=${height},left=${left},top=${top}`
}

function authorizeUrl(clientId: string, state: string): string {
  const query = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: discordReturnUri(),
    scope: 'identify email',
    state,
    // Someone who has said yes before goes straight through.
    prompt: 'none',
  })
  return `https://discord.com/oauth2/authorize?${query}`
}

function openChannel(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL)
  } catch {
    return null
  }
}

/** The wait this page is in, if any: a second press starts over, and Cancel ends it. */
let waiting: { cancel: () => void } | null = null

export function cancelDiscordSignIn() {
  waiting?.cancel()
}

/**
 * Sign in with Discord. Call it straight from the press, before anything awaits, or the popup is blocked.
 * Resolves 'signed-in', or 'away' when this tab is leaving for Discord; rejects with DiscordCancelled
 * when the player backs out, or with what went wrong.
 */
export async function signInWithDiscord(
  clientId: string,
  hooks: { onAnswer?: () => void } = {},
): Promise<'signed-in' | 'away'> {
  waiting?.cancel()
  const state = crypto.randomUUID()
  const back = `${window.location.pathname}${window.location.search}${window.location.hash}`
  const url = authorizeUrl(clientId, state)
  writeTrip({ state, back, at: Date.now(), popup: true })
  const popup = installedApp() ? null : window.open(url, CHANNEL, popupFeatures())
  if (!popup) {
    writeTrip({ state, back, at: Date.now(), popup: false })
    window.location.assign(url)
    return 'away'
  }
  const answer = await waitForAnswer(state, popup)
  if (!answer.code) throw new DiscordCancelled()
  hooks.onAnswer?.()
  await signInWithDiscordCode(answer.code, discordReturnUri())
  rememberSignInWay('discord')
  return 'signed-in'
}

function waitForAnswer(state: string, popup: Window): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const channel = openChannel()
    let settled = false
    const finish = (answer: Answer | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(expiry)
      window.clearInterval(watch)
      window.removeEventListener('message', onMessage)
      channel?.close()
      waiting = null
      if (answer) resolve(answer)
      else reject(new DiscordCancelled())
    }
    const hear = (data: unknown, reply?: (ack: Ack) => void) => {
      const answer = data as Partial<Answer> | null
      // It comes twice, by the opener and by the channel: the first one counts.
      if (settled || !answer || answer.type !== 'skermix-discord' || answer.state !== state) return
      const ack: Ack = { type: 'skermix-discord-ack', state }
      reply?.(ack)
      channel?.postMessage(ack)
      finish(answer as Answer)
    }
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      hear(e.data, (ack) => (e.source as Window | null)?.postMessage(ack, window.location.origin))
    }
    window.addEventListener('message', onMessage)
    channel?.addEventListener('message', (e) => hear(e.data))
    // Closed without an answer: they backed out. A beat's grace, for an answer posted just as it closed.
    let closedAt = 0
    const watch = window.setInterval(() => {
      if (!popup.closed) return
      closedAt ||= Date.now()
      if (Date.now() - closedAt > 1000) finish(null)
    }, 400)
    const expiry = window.setTimeout(() => finish(null), TRIP_TTL_MS)
    waiting = { cancel: () => finish(null) }
  })
}

export type DiscordReturn =
  /** The page that opened the popup has it, and signs in there. */
  | { kind: 'handed-back' }
  | { kind: 'signed-in'; back: string }
  | { kind: 'cancelled'; back: string }
  /** No trip of ours to finish: an old link, or one from another browser. */
  | { kind: 'stale' }

/**
 * On /auth/discord: Discord's answer. A popup hands it to the page that opened it; when nothing there
 * hears it (that page has gone, or this is the tab that left), it's used here. Throws if the API refuses.
 */
export async function finishDiscordReturn(search: string): Promise<DiscordReturn> {
  const params = new URLSearchParams(search)
  const state = params.get('state')
  const code = params.get('code')
  const error = params.get('error')
  const trip = readTrip()
  if (!trip || !state || trip.state !== state || Date.now() - trip.at > TRIP_TTL_MS) return { kind: 'stale' }
  if (trip.popup) {
    const answer: Answer = { type: 'skermix-discord', state, ...(code ? { code } : {}), ...(error ? { error } : {}) }
    if (await handBack(answer)) {
      writeTrip(null)
      return { kind: 'handed-back' }
    }
  }
  writeTrip(null)
  if (!code) return { kind: 'cancelled', back: trip.back }
  await signInWithDiscordCode(code, discordReturnUri())
  rememberSignInWay('discord')
  return { kind: 'signed-in', back: trip.back }
}

function handBack(answer: Answer): Promise<boolean> {
  return new Promise((resolve) => {
    const channel = openChannel()
    let settled = false
    const done = (heard: boolean) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      channel?.close()
      resolve(heard)
    }
    const isAck = (data: unknown) => {
      const ack = data as Partial<Ack> | null
      return ack?.type === 'skermix-discord-ack' && ack.state === answer.state
    }
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && isAck(e.data)) done(true)
    }
    window.addEventListener('message', onMessage)
    channel?.addEventListener('message', (e) => {
      if (isAck(e.data)) done(true)
    })
    const timer = window.setTimeout(() => done(false), 2500)
    try {
      window.opener?.postMessage(answer, window.location.origin)
    } catch {
      /* the channel carries it */
    }
    channel?.postMessage(answer)
  })
}
