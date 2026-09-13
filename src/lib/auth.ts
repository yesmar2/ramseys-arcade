import {
  ApiError,
  clearPlayerNameLocal,
  forgetClaimToken,
  getClaimToken,
  getLastPlayerName,
  migrateLocalScoresToName,
  pruneOrphanClaims,
  rememberClaimToken,
  setPlayerNameLocal,
} from './leaderboard'

const SESSION_KEY = 'arcade-session'
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
 * Never clears the local tag here — that belongs to logout / failed adopt,
 * so a raced empty `/auth/me` cannot wipe a just-linked tag.
 */
function applyOwnedNames(names: OwnedName[]) {
  for (const entry of names) {
    if (entry.name && entry.token) rememberClaimToken(entry.name, entry.token)
  }
  if (names.length >= 1) {
    pruneOrphanClaims(names.map((entry) => entry.name))
    setPlayerNameLocal(names[0].name)
  }
}

/**
 * After a fresh session is written (silently): restore account tag, or adopt the
 * pre-sign-in local tag when the account has none.
 */
async function adoptNamesAfterSignIn(
  names: OwnedName[],
  carriedTag: string,
): Promise<OwnedName[]> {
  if (names.length >= 1) {
    applyOwnedNames(names)
    return names
  }

  if (carriedTag) {
    try {
      const linked = await linkCurrentNameToAccount(carriedTag)
      if (linked) return [{ name: linked.name, token: linked.token }]
    } catch {
      /* Tag belongs to another account — this one stays tagless. */
    }
  }

  // Tagless account (and no adoptable local tag): clear leftover local name.
  clearPlayerNameLocal()
  return []
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
  const carriedTag = getLastPlayerName()
  const data = await authApi<{
    sessionToken: string
    account: Account
    names: OwnedName[]
  }>('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
  // Write session without notifying listeners until names are settled.
  setSessionToken(data.sessionToken, { emit: false })
  const names = await adoptNamesAfterSignIn(data.names ?? [], carriedTag)
  emitAuth()
  return { account: data.account, names }
}

export async function fetchAuthMe(): Promise<{
  account: Account
  names: OwnedName[]
} | null> {
  if (!getSessionToken()) return null
  try {
    const data = await authApi<{ account: Account; names: OwnedName[] }>('/auth/me')
    applyOwnedNames(data.names ?? [])
    return { account: data.account, names: data.names ?? [] }
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      setSessionToken(null)
      return null
    }
    throw err
  }
}

export async function linkCurrentNameToAccount(name?: string): Promise<OwnedName | null> {
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
  const previous = getLastPlayerName()
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
  await migrateLocalScoresToName(data.name, data.token)
  try {
    const { syncJoinedTournamentRosters } = await import('./tournaments')
    await syncJoinedTournamentRosters(true)
  } catch {
    /* tournaments optional */
  }
  applyOwnedNames(data.names ?? [])
  setPlayerNameLocal(data.name)
  return { name: data.name, token: data.token }
}

export async function logoutAccount() {
  try {
    if (getSessionToken()) {
      await authApi('/auth/logout', { method: 'POST' })
    }
  } catch {
    /* ignore */
  }
  setSessionToken(null, { emit: false })
  // Drop the local tag with the session so the next sign-in restores from the
  // account (and shared browsers do not keep showing someone else's tag).
  clearPlayerNameLocal()
  emitAuth()
}

/** After verify: adopt account tag, or link local guest tag if account has none. */
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
  const carriedTag = getLastPlayerName()
  const data = await authApi<{
    sessionToken: string
    account: Account
    names: OwnedName[]
  }>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  })
  setSessionToken(data.sessionToken, { emit: false })
  const names = await adoptNamesAfterSignIn(data.names ?? [], carriedTag)
  emitAuth()
  return { account: data.account, names }
}
