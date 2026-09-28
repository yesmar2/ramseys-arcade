import {
  ApiError,
  clearAllClaimTokens,
  clearPlayerNameLocal,
  forgetClaimToken,
  getClaimToken,
  getLastPlayerName,
  migrateLocalScoresToName,
  normalizePlayerName,
  pruneOrphanClaims,
  rememberClaimToken,
  setPlayerNameLocal,
} from './leaderboard'
import { clearActiveGroup } from './groups'
import { isImpersonating } from './impersonate'
import { hashString } from './seededRandom'
import { clearTournamentIdentity } from './tournaments'

import { ACCOUNT_ID_EVENT, AUTH_EVENT, SESSION_ACCOUNT_KEY, SESSION_KEY } from './accountEvents'

export { ACCOUNT_ID_EVENT, AUTH_EVENT, subscribeAccountId } from './accountEvents'

const ACCOUNT_TAGS_KEY = 'arcade-account-tags'

import type { PlanLimits } from './plans'

export type AccountPlan = 'free' | 'plus'

export type Account = {
  id: string
  email: string
  createdAt: number
  plan: AccountPlan
}

export type OwnedName = {
  name: string
  token: string
}

function resolveApiBase() {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')
  if (fromEnv && !fromEnv.includes('localhost')) return fromEnv
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `${protocol}//${hostname}:8787`
    }
  }
  return fromEnv || 'http://localhost:8787'
}

export const API_BASE = resolveApiBase()

/** Bumps on every session write so in-flight /auth/me calls can be ignored. */
let authGeneration = 0

function bumpAuthGeneration() {
  authGeneration += 1
  return authGeneration
}

export function getAuthGeneration() {
  return authGeneration
}

/*
 * Which account is signed in, known at once on every page and in every tab: the account's id, kept with a
 * fingerprint of the session it was said for (never the token itself). A daily's run on this device is
 * stamped with it (lib/deviceRuns.ts), so a run is only ever shown and sent as its own player's. It's
 * written whenever the session's account is said (a sign-in, /auth/me), and goes with the session: a
 * new session's account isn't known until it's said, even one begun in a tab still on an older bundle,
 * which doesn't keep it (the fingerprint won't match the session before it).
 */
type SessionAccount = { of: number; id: string }

/** This tab's own copy, for when storage won't keep one. */
let knownAccount: SessionAccount | null = null

function fingerprintOf(token: string): number {
  return hashString(`session:${token}`)
}

/** The session signed in now, as a fingerprint that tells sessions apart; null signed out. */
export function sessionFingerprint(): number | null {
  const token = getSessionToken()
  return token ? fingerprintOf(token) : null
}

function readSessionAccount(): SessionAccount | null {
  try {
    const raw = localStorage.getItem(SESSION_ACCOUNT_KEY)
    const saved = raw ? (JSON.parse(raw) as Partial<SessionAccount> | null) : null
    if (saved && typeof saved.of === 'number' && typeof saved.id === 'string' && saved.id) return { of: saved.of, id: saved.id }
  } catch {
    /* this tab's copy stands in */
  }
  return null
}

/**
 * The account signed in now: its id; null signed out; undefined while the session's account isn't known
 * yet (a session from before the account was kept, until /auth/me answers). Read afresh on every call, so
 * every tab agrees the moment another signs in, out, or as someone else.
 */
export function currentAccountId(): string | null | undefined {
  const token = getSessionToken()
  if (!token) return null
  const of = fingerprintOf(token)
  const saved = readSessionAccount()
  if (saved?.of === of) return saved.id
  return knownAccount?.of === of ? knownAccount.id : undefined
}

/** Tell whoever shows a player's own things that the account signed in changed, if it did. */
function announceAccountId(before: string | null | undefined) {
  if (typeof window !== 'undefined' && currentAccountId() !== before) {
    window.dispatchEvent(new Event(ACCOUNT_ID_EVENT))
  }
}

/** Keep the session's account, said by the API, for the session signed in now. */
function setLastAccountId(accountId: string) {
  const token = getSessionToken()
  if (!token || !accountId) return
  const before = currentAccountId()
  knownAccount = { of: fingerprintOf(token), id: accountId }
  const saved = readSessionAccount()
  // Said again on every /auth/me: other tabs hear only of a change.
  if (saved?.of === knownAccount.of && saved.id === accountId) return
  try {
    localStorage.setItem(SESSION_ACCOUNT_KEY, JSON.stringify(knownAccount))
  } catch {
    /* this tab's copy stands in */
  }
  announceAccountId(before)
}

/** The session is over, or another has begun: whichever account it was isn't this one's. */
function forgetSessionAccount() {
  knownAccount = null
  try {
    localStorage.removeItem(SESSION_ACCOUNT_KEY)
  } catch {
    /* ignore */
  }
}

function emitAuth() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_EVENT))
  }
}

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

export function setSessionToken(token: string | null, opts?: { emit?: boolean }) {
  bumpAuthGeneration()
  const before = currentAccountId()
  const changed = !token || token !== getSessionToken()
  try {
    if (token) localStorage.setItem(SESSION_KEY, token)
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
  // After the token, so another tab hears of the new session first: asking /auth/me for the old one
  // just as it ends leaves that tab signed out (useAuth drops an answer for a session that's gone).
  if (changed) forgetSessionAccount()
  if (opts?.emit !== false) {
    announceAccountId(before)
    emitAuth()
  }
}

export function authHeaders(): Record<string, string> {
  const token = getSessionToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function readAccountTags(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ACCOUNT_TAGS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, string> = {}
    for (const [accountId, name] of Object.entries(parsed as Record<string, unknown>)) {
      const cleaned = typeof name === 'string' ? normalizePlayerName(name) : ''
      if (accountId && cleaned) out[accountId] = cleaned
    }
    return out
  } catch {
    return {}
  }
}

function writeAccountTags(map: Record<string, string>) {
  try {
    localStorage.setItem(ACCOUNT_TAGS_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

/** Remember which gamer tag belongs to which account on this browser. */
export function rememberAccountTag(accountId: string, name: string) {
  const cleaned = normalizePlayerName(name)
  if (!accountId || !cleaned) return
  const map = readAccountTags()
  if (map[accountId] === cleaned) return
  map[accountId] = cleaned
  writeAccountTags(map)
}

export function recallAccountTag(accountId: string): string {
  if (!accountId) return ''
  return readAccountTags()[accountId] ?? ''
}

function forgetAccountTag(accountId: string) {
  if (!accountId) return
  const map = readAccountTags()
  if (!(accountId in map)) return
  delete map[accountId]
  writeAccountTags(map)
}

async function authApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    let message = `API error ${res.status}`
    let code: string | undefined
    let detail: { limit?: string; plan?: string; allowed?: number | boolean } | undefined
    try {
      const body = (await res.json()) as {
        error?: string
        code?: string
        limit?: string
        plan?: string
        allowed?: number | boolean
      }
      if (body.error) message = body.error
      code = body.code
      if (body.limit) detail = { limit: body.limit, plan: body.plan, allowed: body.allowed }
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status, code, detail)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

/**
 * Sync local tag + claim tokens from the account's owned names.
 * Never clears the local tag here — clearing is logout / explicit tagless adopt.
 */
function applyOwnedNames(names: OwnedName[], accountId?: string) {
  for (const entry of names) {
    if (entry.name && entry.token) rememberClaimToken(entry.name, entry.token)
  }
  if (names.length >= 1) {
    /*
     * Impersonation is a local override of which tag you are playing as, so
     * the account's own tag must not be written back over it. This runs on
     * every /auth/me — which is every page that mounts useAuth, plus every
     * window focus — and it was quietly ending the impersonation one
     * navigation later. Pruning is skipped with it: the borrowed tag's claim
     * token is not one of the account's own, and would be swept away.
     */
    if (!isImpersonating()) {
      pruneOrphanClaims(names.map((entry) => entry.name))
      setPlayerNameLocal(names[0].name)
    }
    if (accountId) {
      setLastAccountId(accountId)
      rememberAccountTag(accountId, names[0].name)
    }
  } else if (accountId) {
    setLastAccountId(accountId)
  }
}

/**
 * Restore this account's tag after sign-in.
 * Prefer server-owned names; fall back to this browser's per-account memory.
 * Do not steal whatever tag the previous account left in `arcade-last-name`.
 */
async function adoptNamesAfterSignIn(
  accountId: string,
  names: OwnedName[],
): Promise<OwnedName[]> {
  if (names.length >= 1) {
    applyOwnedNames(names, accountId)
    return names
  }

  const remembered = recallAccountTag(accountId)
  if (remembered) {
    try {
      // No renameFrom — never migrate the previous account's tag into this one.
      const linked = await linkCurrentNameToAccount(remembered)
      if (linked) {
        rememberAccountTag(accountId, linked.name)
        return [{ name: linked.name, token: linked.token }]
      }
    } catch {
      // Stale local memory (tag taken / moved) — drop it and stay tagless.
      forgetAccountTag(accountId)
    }
  }

  // This account has no tag here. Clear leftover UI state from the prior user.
  clearPlayerNameLocal()
  clearTournamentIdentity()
  return []
}

/** Drop prior-account local identity before a new session takes over. */
function resetDeviceIdentityForAccountSwitch() {
  clearPlayerNameLocal()
  clearAllClaimTokens()
  clearActiveGroup()
  clearTournamentIdentity()
}

export async function requestMagicLink(email: string): Promise<{
  email: string
  verifyUrl?: string
  verifyToken?: string
  expiresAt: number
}> {
  return authApi('/auth/magic-link', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function verifyMagicToken(token: string): Promise<{
  account: Account
  names: OwnedName[]
}> {
  const data = await authApi<{
    sessionToken: string
    account: Account
    names: OwnedName[]
  }>('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
  setSessionToken(data.sessionToken, { emit: false })
  resetDeviceIdentityForAccountSwitch()
  setLastAccountId(data.account.id)
  const names = await adoptNamesAfterSignIn(data.account.id, data.names ?? [])
  emitAuth()
  return { account: data.account, names }
}

export async function fetchAuthMe(): Promise<{
  account: Account
  names: OwnedName[]
  limits?: PlanLimits
} | null> {
  const tokenAtStart = getSessionToken()
  const generationAtStart = authGeneration
  if (!tokenAtStart) return null
  try {
    const data = await authApi<{
      account: Account
      names: OwnedName[]
      limits?: PlanLimits
    }>('/auth/me')
    // Session changed while this request was in flight — ignore the result.
    if (getSessionToken() !== tokenAtStart || authGeneration !== generationAtStart) {
      return null
    }
    applyOwnedNames(data.names ?? [], data.account.id)
    // The plan's limits too: without them every account, Plus or not, got the free ones.
    return { account: data.account, names: data.names ?? [], limits: data.limits }
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      // Only clear if this request's token is still the active one.
      if (getSessionToken() === tokenAtStart) {
        setSessionToken(null)
      }
      return null
    }
    throw err
  }
}

export async function linkCurrentNameToAccount(
  name?: string,
  opts?: { renameFrom?: string | null },
): Promise<OwnedName | null> {
  try {
    const raw = localStorage.getItem('arcade-impersonate')
    if (raw) {
      const parsed = JSON.parse(raw) as { name?: unknown }
      if (typeof parsed?.name === 'string' && parsed.name.trim()) {
        throw new ApiError(
          'Stop impersonating before linking a gamer tag to your account',
          400,
          'IMPERSONATING',
        )
      }
    }
  } catch (err) {
    if (err instanceof ApiError) throw err
  }
  const cleaned = (name || getLastPlayerName()).trim().toUpperCase()
  if (!cleaned || !getSessionToken()) return null
  // Only rename when the caller explicitly asks (e.g. PlayerBadge edit).
  // Auto-detecting getLastPlayerName() as previous was rewriting other
  // accounts' group seats when switching Google logins on one browser.
  const previous = normalizePlayerName(opts?.renameFrom ?? '')
  const claimToken = getClaimToken(cleaned) ?? undefined
  const previousToken =
    previous && previous !== cleaned ? getClaimToken(previous) ?? undefined : undefined
  const data = await authApi<{
    name: string
    token: string
    names: OwnedName[]
  }>('/auth/link-name', {
    method: 'POST',
    body: JSON.stringify({
      name: cleaned,
      ...(claimToken ? { claimToken } : {}),
      ...(previous && previous !== cleaned ? { previousName: previous } : {}),
      ...(previousToken ? { previousToken } : {}),
    }),
  })
  rememberClaimToken(data.name, data.token)
  if (previous && previous !== data.name) {
    forgetClaimToken(previous)
  }
  if (previous && previous !== data.name) {
    await migrateLocalScoresToName(data.name, data.token)
  }
  try {
    const { syncJoinedTournamentRosters } = await import('./tournaments')
    await syncJoinedTournamentRosters(true)
  } catch {
    /* tournaments optional */
  }
  // The session's own account, as it is now: another tab may have signed in as someone else since this
  // one last heard, and its account mustn't be said for this session.
  const accountId = currentAccountId() ?? undefined
  applyOwnedNames(data.names ?? [], accountId)
  setPlayerNameLocal(data.name)
  if (accountId) rememberAccountTag(accountId, data.name)
  return { name: data.name, token: data.token }
}

export async function logoutAccount() {
  const token = getSessionToken()
  try {
    if (token) {
      await authApi('/auth/logout', { method: 'POST' })
    }
  } catch {
    /* ignore */
  }
  const accountBefore = currentAccountId()
  setSessionToken(null, { emit: false })
  // Drop local identity with the session. Per-account tag memory remains so
  // the next sign-in can restore this account's own tag — not the last one's.
  clearPlayerNameLocal()
  clearAllClaimTokens()
  clearActiveGroup()
  clearTournamentIdentity()
  announceAccountId(accountBefore)
  emitAuth()
}

/** After verify: adopt account tag from server or this browser's memory. */
export async function completeSignIn(verifyToken: string) {
  return verifyMagicToken(verifyToken)
}

export async function fetchAuthConfig(): Promise<{
  googleClientId: string | null
  googleEnabled: boolean
}> {
  try {
    return await authApi('/auth/config')
  } catch {
    const fromEnv = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim()
    return {
      googleClientId: fromEnv || null,
      googleEnabled: Boolean(fromEnv),
    }
  }
}

export async function signInWithGoogleIdToken(idToken: string): Promise<{
  account: Account
  names: OwnedName[]
}> {
  const data = await authApi<{
    sessionToken: string
    account: Account
    names: OwnedName[]
  }>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  })
  setSessionToken(data.sessionToken, { emit: false })
  resetDeviceIdentityForAccountSwitch()
  setLastAccountId(data.account.id)
  const names = await adoptNamesAfterSignIn(data.account.id, data.names ?? [])
  emitAuth()
  return { account: data.account, names }
}
