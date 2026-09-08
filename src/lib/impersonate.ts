import {
  ApiError,
  getLastPlayerName,
  normalizePlayerName,
  rememberClaimToken,
  setPlayerNameLocal,
  api,
} from './leaderboard'

export const IMPERSONATE_KEY = 'arcade-impersonate'
const RECENTS_KEY = 'arcade-impersonate-recents'
export const IMPERSONATE_EVENT = 'arcade-impersonate'

const RECENTS_MAX = 8

export type ImpersonationState = {
  name: string
  previousName: string
}

export function isDevImpersonateEnabled() {
  return import.meta.env.DEV
}

export function getImpersonation(): ImpersonationState | null {
  try {
    const raw = localStorage.getItem(IMPERSONATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ImpersonationState>
    const name = normalizePlayerName(parsed.name ?? '')
    if (!name) return null
    return {
      name,
      previousName: normalizePlayerName(parsed.previousName ?? ''),
    }
  } catch {
    return null
  }
}

export function isImpersonating() {
  return Boolean(getImpersonation()?.name)
}

export function impersonateRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: string[] = []
    for (const item of parsed) {
      const name = typeof item === 'string' ? normalizePlayerName(item) : ''
      if (name && !out.includes(name)) out.push(name)
    }
    return out.slice(0, RECENTS_MAX)
  } catch {
    return []
  }
}

function writeImpersonation(state: ImpersonationState | null) {
  try {
    if (state) localStorage.setItem(IMPERSONATE_KEY, JSON.stringify(state))
    else localStorage.removeItem(IMPERSONATE_KEY)
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(IMPERSONATE_EVENT))
  }
}

function addRecent(name: string) {
  const cleaned = normalizePlayerName(name)
  if (!cleaned) return
  const next = [cleaned, ...impersonateRecents().filter((item) => item !== cleaned)].slice(
    0,
    RECENTS_MAX,
  )
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

/** Borrow a tag's claim token for local testing. Does not rename or attach your account. */
export async function startImpersonation(name: string): Promise<string> {
  if (!isDevImpersonateEnabled()) {
    throw new ApiError('Impersonation is only available in local Vite DEV', 403, 'DEV_ONLY')
  }
  const cleaned = normalizePlayerName(name)
  if (!cleaned) {
    throw new ApiError('Name required', 400, 'NAME_REQUIRED')
  }

  const data = await api<{ name: string; token: string }>('/names/assume', {
    method: 'POST',
    body: JSON.stringify({ name: cleaned }),
  })

  rememberClaimToken(data.name, data.token)
  const current = getImpersonation()
  const previousName = current?.previousName || getLastPlayerName()
  writeImpersonation({
    name: data.name,
    previousName,
  })
  addRecent(data.name)
  setPlayerNameLocal(data.name)
  return data.name
}

export function stopImpersonation() {
  const state = getImpersonation()
  writeImpersonation(null)
  if (state?.previousName && state.previousName !== state.name) {
    setPlayerNameLocal(state.previousName)
  }
}
