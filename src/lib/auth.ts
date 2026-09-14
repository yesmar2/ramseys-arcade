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
import { clearTournamentIdentity } from './tournaments'

const SESSION_KEY = 'arcade-session'
const ACCOUNT_TAGS_KEY = 'arcade-account-tags'
export const AUTH_EVENT = 'arcade-auth'

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

const API_BASE = resolveApiBase()

/** Bumps on every session write so in-flight /auth/me calls can be ignored. */
let authGeneration = 0
let lastAccountId: string | null = null

function bumpAuthGeneration() {
  authGeneration += 1
  return authGeneration
}

export function getAuthGeneration() {
  return authGeneration
}

function setLastAccountId(accountId: string | null) {
  lastAccountId = accountId
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
  if (!token) setLastAccountId(null)
  try {
    if (token) localStorage.setItem(SESSION_KEY, token)
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
  if (opts?.emit !== false) emitAuth()
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
    try {
      const body = (await res.json()) as { error?: string; code?: string }
      if (body.error) message = body.error
      code = body.code
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status, code)
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
    pruneOrphanClaims(names.map((entry) => entry.name))
    setPlayerNameLocal(names[0].name)
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
} | null> {
  const tokenAtStart = getSessionToken()
  const generationAtStart = authGeneration
  if (!tokenAtStart) return null
  try {
    const data = await authApi<{ account: Account; names: OwnedName[] }>('/auth/me')
    // Session changed while this request was in flight — ignore the result.
    if (getSessionToken() !== tokenAtStart || authGeneration !== generationAtStart) {
      return null
    }
    applyOwnedNames(data.names ?? [], data.account.id)
    return { account: data.account, names: data.names ?? [] }
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
  applyOwnedNames(data.names ?? [], lastAccountId ?? undefined)
  setPlayerNameLocal(data.name)
  if (lastAccountId) rememberAccountTag(lastAccountId, data.name)
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
  setSessionToken(null, { emit: false })
  // Drop local identity with the session. Per-account tag memory remains so
  // the next sign-in can restore this account's own tag — not the last one's.
  clearPlayerNameLocal()
  clearAllClaimTokens()
  clearActiveGroup()
  clearTournamentIdentity()
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
