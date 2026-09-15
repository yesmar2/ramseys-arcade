/**
 * Avatars: a simple character in the player's colours.
 *
 * An avatar is a shape (one of a small cast of creatures) plus two colours
 * from a fixed palette — the body and an accent (cheeks, ears, an antenna,
 * whatever that shape uses it for). It travels as one short string, saved
 * on the player's name claim: `a1:<shape>:<body>:<accent>`. Every tag has
 * one even before its owner picks — a stable default from the tag itself —
 * so lists never show a hole.
 *
 * Keep the codec in step with the API's `src/avatars.ts`.
 */

export const AVATARS_ENABLED = true

export const AVATAR_SHAPES = [
  'blob',
  'bot',
  'cat',
  'ghost',
  'star',
  'drop',
  'block',
  'mush',
  'alien',
  'fox',
  'skull',
  'slime',
  'gem',
  'bolt',
  'rocket',
  'pad',
] as const

export type AvatarShape = (typeof AVATAR_SHAPES)[number]

export const AVATAR_SHAPE_LABELS: Record<AvatarShape, string> = {
  blob: 'Blob',
  bot: 'Bot',
  cat: 'Cat',
  ghost: 'Ghost',
  star: 'Star',
  drop: 'Drop',
  block: 'Block',
  mush: 'Mushroom',
  alien: 'Alien',
  fox: 'Fox',
  skull: 'Skull',
  slime: 'Slime',
  gem: 'Gem',
  bolt: 'Bolt',
  rocket: 'Rocket',
  pad: 'Pad',
}

/**
 * The palette: the app's own colours — the site accent, each game's accent,
 * and the three medal metals — plus one light neutral so a character can be
 * pale. Index is what gets saved, so only ever append.
 */
export const AVATAR_COLORS = [
  { id: 'mint', hex: '#2eb8a0' }, // site accent
  { id: 'green', hex: '#2eb87a' }, // Asteroids
  { id: 'leaf', hex: '#3ecf8e' }, // Snake
  { id: 'cyan', hex: '#3ec8cf' }, // Find the Bug
  { id: 'sky', hex: '#4aa8e8' }, // Stacker, Centroid, Pop
  { id: 'violet', hex: '#8a6ad4' }, // Simon
  { id: 'indigo', hex: '#7a6cf0' }, // Spotter
  { id: 'rose', hex: '#e85d75' }, // Patriot, Barrage
  { id: 'gold', hex: '#f5b942' }, // Crosswalk, Pellets, Crumbtrail
  { id: 'bronze', hex: '#c07c3e' }, // third place
  { id: 'silver', hex: '#8d99a8' }, // second place
  { id: 'snow', hex: '#e9eef2' },
] as const

export type Avatar = {
  shape: AvatarShape
  /** Index into AVATAR_COLORS. */
  body: number
  /** Index into AVATAR_COLORS. */
  accent: number
}

/** The saved form: `a1:blob:4:1`. */
export type AvatarId = string

const VERSION = 'a1'

export function encodeAvatar(avatar: Avatar): AvatarId {
  return `${VERSION}:${avatar.shape}:${avatar.body}:${avatar.accent}`
}

export function parseAvatar(value: unknown): Avatar | null {
  if (typeof value !== 'string') return null
  const parts = value.split(':')
  if (parts.length !== 4 || parts[0] !== VERSION) return null
  const shape = parts[1] as AvatarShape
  if (!(AVATAR_SHAPES as readonly string[]).includes(shape)) return null
  const body = Number(parts[2])
  const accent = Number(parts[3])
  const inRange = (n: number) => Number.isInteger(n) && n >= 0 && n < AVATAR_COLORS.length
  if (!inRange(body) || !inRange(accent)) return null
  return { shape, body, accent }
}

export function isAvatarId(value: unknown): value is AvatarId {
  return parseAvatar(value) !== null
}

function hashName(name: string) {
  const cleaned = name.trim().toUpperCase()
  let hash = 0
  for (let i = 0; i < cleaned.length; i++) {
    hash = (hash * 31 + cleaned.charCodeAt(i)) >>> 0
  }
  return hash
}

/** A tag's avatar before anyone has chosen one: the same every time, for the same tag. */
export function defaultAvatar(name: string): Avatar {
  const hash = hashName(name)
  const shape = AVATAR_SHAPES[hash % AVATAR_SHAPES.length]!
  const body = Math.floor(hash / 8) % AVATAR_COLORS.length
  // A different colour from the body, so the default always has some contrast.
  const accent = (body + 1 + (Math.floor(hash / 97) % (AVATAR_COLORS.length - 1))) % AVATAR_COLORS.length
  return { shape, body, accent }
}

export function defaultAvatarId(name: string): AvatarId {
  return encodeAvatar(defaultAvatar(name))
}

/** The avatar to draw for a tag: what was saved if it is valid, else the default. */
export function resolveAvatar(avatarId: string | null | undefined, name: string): Avatar {
  return parseAvatar(avatarId) ?? defaultAvatar(name)
}

export function resolveAvatarId(avatarId: string | null | undefined, name: string): AvatarId {
  return encodeAvatar(resolveAvatar(avatarId, name))
}

export function randomAvatar(): Avatar {
  const shape = AVATAR_SHAPES[Math.floor(Math.random() * AVATAR_SHAPES.length)]!
  const body = Math.floor(Math.random() * AVATAR_COLORS.length)
  let accent = Math.floor(Math.random() * (AVATAR_COLORS.length - 1))
  if (accent >= body) accent += 1
  return { shape, body, accent }
}

export function avatarColor(index: number): string {
  return AVATAR_COLORS[index]?.hex ?? AVATAR_COLORS[0].hex
}

/* ---------- this device's copy, so a mark paints before the API answers ---------- */

const AVATAR_STORAGE_KEY = 'arcade-avatar-id'

/** Fired on window when this player's avatar changes, so every mark on screen can repaint. */
export const AVATAR_EVENT = 'arcade-avatar'

export function getLocalAvatarId(name: string): AvatarId | null {
  try {
    const raw = localStorage.getItem(AVATAR_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const id = parsed[name.trim().toUpperCase()]
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
  window.dispatchEvent(new CustomEvent(AVATAR_EVENT, { detail: { name: cleaned, avatarId } }))
}
