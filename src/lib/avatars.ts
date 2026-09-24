/**
 * Avatars: the tag's own monogram or an emblem, on a round badge, in two
 * colours from a fixed palette, with a ring around it and a pin on its edge
 * that the player has earned.
 *
 * It travels as one short string, saved on the player's name claim:
 *
 *   a2:m:<letters>:<pattern>:<body>:<detail>:<badge>:<ring>:<pin>
 *   a2:e:<emblem>:<body>:<detail>:<badge>:<ring>:<pin>
 *
 * A monogram saves how many letters of the tag it shows, not the letters, so
 * it follows the tag. Every tag has one even before its owner picks — its
 * monogram, coloured from the tag itself — so lists never show a hole.
 *
 * Keep the codec in step with the API's `src/avatars.ts`, which also decides
 * which rings and pins a player has earned (`src/flair.ts`).
 */

import { getGame } from '../data/games'

export const AVATARS_ENABLED = true

export const AVATAR_EMBLEMS = [
  'joystick',
  'pad',
  'coin',
  'bolt',
  'crown',
  'flame',
  'rocket',
  'planet',
  'ufo',
  'dice',
  'trophy',
  'gem',
  'heart',
  'target',
  'eightball',
  'cabinet',
] as const
export type AvatarEmblem = (typeof AVATAR_EMBLEMS)[number]

export const EMBLEM_LABELS: Record<AvatarEmblem, string> = {
  joystick: 'Joystick',
  pad: 'Controller',
  coin: 'Coin',
  bolt: 'Bolt',
  crown: 'Crown',
  flame: 'Flame',
  rocket: 'Rocket',
  planet: 'Planet',
  ufo: 'UFO',
  dice: 'Dice',
  trophy: 'Trophy',
  gem: 'Gem',
  heart: 'Heart',
  target: 'Target',
  eightball: '8-ball',
  cabinet: 'Cabinet',
}

export const AVATAR_PATTERNS = ['plain', 'rings', 'split', 'stripes', 'dots', 'burst', 'half'] as const
export type AvatarPattern = (typeof AVATAR_PATTERNS)[number]

export const PATTERN_LABELS: Record<AvatarPattern, string> = {
  plain: 'Plain',
  rings: 'Rings',
  split: 'Split',
  stripes: 'Stripes',
  dots: 'Dots',
  burst: 'Burst',
  half: 'Half',
}

export const AVATAR_BADGES = ['bold', 'deep', 'night', 'paper'] as const
export type AvatarBadge = (typeof AVATAR_BADGES)[number]

export const BADGE_LABELS: Record<AvatarBadge, string> = { bold: 'Bold', deep: 'Deep', night: 'Night', paper: 'Paper' }

/** Worn around the badge, for how you've placed. */
export const AVATAR_RINGS = ['bronze', 'silver', 'gold', 'record', 'laurel'] as const
export type AvatarRing = (typeof AVATAR_RINGS)[number]

export const RING_INFO: Record<AvatarRing, { label: string; rule: string }> = {
  bronze: { label: 'Bronze', rule: 'Finish a week in the arcade’s top three' },
  silver: { label: 'Silver', rule: 'Finish a week in the top two' },
  gold: { label: 'Gold', rule: 'Win a week' },
  record: { label: 'Record', rule: 'Hold a record in a record book' },
  laurel: { label: 'Laurel', rule: 'Win an event' },
}

/** One pin per game on the shelf, for its all-time top ten. */
export const AVATAR_GAME_PINS = [
  'asteroids',
  'patriot',
  'snake',
  'crosswalk',
  'stacker',
  'centroid',
  'pop',
  'pellets',
  'findbug',
  'crumbtrail',
  'bop',
  'putt',
  'barrage',
  'frenzy',
  'fireflies',
] as const

/** Worn on the badge's edge, for what you've done. */
export const AVATAR_PINS = ['welcome', 'games', 'streak', 'crown', 'bugnet', ...AVATAR_GAME_PINS] as const
export type AvatarPin = (typeof AVATAR_PINS)[number]

export function isGamePin(pin: string): boolean {
  return (AVATAR_GAME_PINS as readonly string[]).includes(pin)
}

export function pinInfo(pin: AvatarPin): { label: string; rule: string } {
  switch (pin) {
    case 'welcome':
      return { label: 'Welcome', rule: 'Everyone gets one' }
    case 'games':
      return { label: 'Five games', rule: 'Play five different games' }
    case 'streak':
      return { label: 'Streak', rule: 'Play seven days in a row' }
    case 'crown':
      return { label: 'Crown', rule: 'Win a month in the arcade' }
    case 'bugnet':
      return { label: 'Bug net', rule: 'Catch all twelve bugs of a month’s bug hunt' }
    default: {
      const name = getGame(pin)?.name ?? pin
      return { label: name, rule: `Reach the all-time top ten on ${name}` }
    }
  }
}

/**
 * The palette: the app's own colours — the site accent, each game's accent,
 * the three medal metals — a light neutral, and four more. Index is what gets
 * saved, so only ever append.
 */
export const AVATAR_COLORS = [
  { id: 'mint', label: 'Mint', hex: '#2eb8a0' },
  { id: 'green', label: 'Green', hex: '#2eb87a' },
  { id: 'leaf', label: 'Leaf', hex: '#3ecf8e' },
  { id: 'cyan', label: 'Cyan', hex: '#3ec8cf' },
  { id: 'sky', label: 'Sky', hex: '#4aa8e8' },
  { id: 'violet', label: 'Violet', hex: '#8a6ad4' },
  { id: 'indigo', label: 'Indigo', hex: '#7a6cf0' },
  { id: 'rose', label: 'Rose', hex: '#e85d75' },
  { id: 'gold', label: 'Gold', hex: '#f5b942' },
  { id: 'bronze', label: 'Bronze', hex: '#c07c3e' },
  { id: 'silver', label: 'Silver', hex: '#8d99a8' },
  { id: 'snow', label: 'Snow', hex: '#e9eef2' },
  { id: 'coral', label: 'Coral', hex: '#ff7f5c' },
  { id: 'pink', label: 'Pink', hex: '#f06fb2' },
  { id: 'lime', label: 'Lime', hex: '#a6d83c' },
  { id: 'sand', label: 'Sand', hex: '#e8c79c' },
] as const

type Common = {
  /** Index into AVATAR_COLORS. */
  body: number
  /** Index into AVATAR_COLORS. */
  detail: number
  badge: AvatarBadge
  ring: AvatarRing | null
  pin: AvatarPin | null
}

export type MonoAvatar = { kind: 'mono'; letters: 1 | 2; pattern: AvatarPattern } & Common
export type EmblemAvatar = { kind: 'emblem'; emblem: AvatarEmblem } & Common
export type Avatar = MonoAvatar | EmblemAvatar

/** The saved form: `a2:m:1:stripes:4:5:bold:none:none`. */
export type AvatarId = string

const VERSION = 'a2'

export function encodeAvatar(avatar: Avatar): AvatarId {
  const tail = `${avatar.body}:${avatar.detail}:${avatar.badge}:${avatar.ring ?? 'none'}:${avatar.pin ?? 'none'}`
  return avatar.kind === 'mono'
    ? `${VERSION}:m:${avatar.letters}:${avatar.pattern}:${tail}`
    : `${VERSION}:e:${avatar.emblem}:${tail}`
}

function oneOf<T extends string>(list: readonly T[], value: string | undefined): T | null {
  return value != null && (list as readonly string[]).includes(value) ? (value as T) : null
}

export function parseAvatar(value: unknown): Avatar | null {
  if (typeof value !== 'string') return null
  const parts = value.split(':')
  if (parts[0] !== VERSION) return null
  const mono = parts[1] === 'm'
  if (!mono && parts[1] !== 'e') return null
  if (parts.length !== (mono ? 9 : 8)) return null
  const [bodyRaw, detailRaw, badgeRaw, ringRaw, pinRaw] = parts.slice(mono ? 4 : 3)
  const inRange = (n: number) => Number.isInteger(n) && n >= 0 && n < AVATAR_COLORS.length
  const body = Number(bodyRaw)
  const detail = Number(detailRaw)
  const badge = oneOf(AVATAR_BADGES, badgeRaw)
  const ring = ringRaw === 'none' ? null : oneOf(AVATAR_RINGS, ringRaw)
  const pin = pinRaw === 'none' ? null : oneOf(AVATAR_PINS, pinRaw)
  if (!inRange(body) || !inRange(detail) || !badge) return null
  if ((ringRaw !== 'none' && !ring) || (pinRaw !== 'none' && !pin)) return null
  const common = { body, detail, badge, ring, pin }
  if (mono) {
    const letters = parts[2] === '1' ? 1 : parts[2] === '2' ? 2 : null
    const pattern = oneOf(AVATAR_PATTERNS, parts[3])
    if (!letters || !pattern) return null
    return { kind: 'mono', letters, pattern, ...common }
  }
  const emblem = oneOf(AVATAR_EMBLEMS, parts[2])
  if (!emblem) return null
  return { kind: 'emblem', emblem, ...common }
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

/** A tag's avatar before anyone has chosen one: its monogram, the same every time for the same tag. */
export function defaultAvatar(name: string): Avatar {
  const hash = hashName(name)
  const n = AVATAR_COLORS.length
  const body = Math.floor(hash / 8) % n
  // A different colour from the body, so the default always has some contrast.
  const detail = (body + 1 + (Math.floor(hash / 97) % (n - 1))) % n
  const pattern = AVATAR_PATTERNS[1 + (hash % (AVATAR_PATTERNS.length - 1))]!
  return { kind: 'mono', letters: 1, pattern, body, detail, badge: 'bold', ring: null, pin: null }
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

/** A new look at random, keeping what's worn: half the time a monogram, half an emblem. */
export function randomAvatar(keep: Pick<Avatar, 'ring' | 'pin'>): Avatar {
  const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]!
  const n = AVATAR_COLORS.length
  const body = Math.floor(Math.random() * n)
  let detail = Math.floor(Math.random() * (n - 1))
  if (detail >= body) detail += 1
  const common = { body, detail, ring: keep.ring, pin: keep.pin }
  if (Math.random() < 0.5) {
    return { kind: 'mono', letters: 1, pattern: pick(AVATAR_PATTERNS), badge: pick(['bold', 'bold', 'deep', 'night', 'paper'] as const), ...common }
  }
  return { kind: 'emblem', emblem: pick(AVATAR_EMBLEMS), badge: pick(['deep', 'deep', 'bold', 'night', 'paper'] as const), ...common }
}

/** The letters a monogram shows for a tag. */
export function monogramText(name: string, letters: 1 | 2): string {
  const cleaned = name.trim().toUpperCase()
  return cleaned ? cleaned.slice(0, letters) : '?'
}

export function avatarColor(index: number): string {
  return AVATAR_COLORS[index]?.hex ?? AVATAR_COLORS[0].hex
}

/** Colours that carry no hue of their own; a page washed in them would go grey. */
const NEUTRAL_AVATAR_COLORS: ReadonlySet<string> = new Set(['silver', 'snow', 'sand'])

/**
 * The one colour that stands for a player, for a page to take its tone from:
 * the body, unless the body is a neutral, then the detail, and the site's own
 * mint when both are.
 */
export function avatarWashColor(avatar: Avatar): string {
  for (const index of [avatar.body, avatar.detail]) {
    const color = AVATAR_COLORS[index]
    if (color && !NEUTRAL_AVATAR_COLORS.has(color.id)) return color.hex
  }
  return AVATAR_COLORS[0].hex
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
