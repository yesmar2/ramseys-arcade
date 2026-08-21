/** Curated avatar ids — keep in sync with API `src/avatars.ts`. */
/** Flip on when ready to ship avatars on the site. */
export const AVATARS_ENABLED = false

export const AVATAR_IDS = [
  'orb',
  'bolt',
  'ship',
  'star',
  'pulse',
  'chip',
  'ring',
  'wave',
  'coin',
  'spark',
  'cube',
  'nova',
  'pixel',
  'arrow',
  'hex',
  'glow',
  'disc',
  'beam',
  'core',
  'flare',
] as const

export type AvatarId = (typeof AVATAR_IDS)[number]

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === 'string' && (AVATAR_IDS as readonly string[]).includes(value)
}

export function defaultAvatarId(name: string): AvatarId {
  const cleaned = name.trim().toUpperCase()
  let hash = 0
  for (let i = 0; i < cleaned.length; i++) {
    hash = (hash * 31 + cleaned.charCodeAt(i)) >>> 0
  }
  return AVATAR_IDS[hash % AVATAR_IDS.length]
}

export function resolveAvatarId(
  avatarId: string | null | undefined,
  name: string,
): AvatarId {
  if (isAvatarId(avatarId)) return avatarId
  return defaultAvatarId(name)
}

const AVATAR_STORAGE_KEY = 'arcade-avatar-id'

export function getLocalAvatarId(name: string): AvatarId | null {
  try {
    const raw = localStorage.getItem(AVATAR_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const cleaned = name.trim().toUpperCase()
    const id = parsed[cleaned]
    return isAvatarId(id) ? id : null
  } catch {
    return null
  }
}

export function setLocalAvatarId(name: string, avatarId: AvatarId) {
  const cleaned = name.trim().toUpperCase()
  if (!cleaned) return
  try {
    const raw = localStorage.getItem(AVATAR_STORAGE_KEY)
    let parsed: Record<string, string> = {}
    if (raw) {
      const value = JSON.parse(raw) as unknown
      if (value && typeof value === 'object') parsed = value as Record<string, string>
    }
    parsed[cleaned] = avatarId
    localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(parsed))
  } catch {
    /* ignore */
  }
}
