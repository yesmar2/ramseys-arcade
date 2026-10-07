import { useId, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { BADGE_ART, EMBLEM_ART, PATTERN_ART, PIN_AT, PIN_DISC, PIN_EDGE, PIN_GLYPHS, RING_ART, type ArtRole } from '../lib/avatarArt'
import { avatarColor, isFinishBadge, isGamePin, monogramText, resolveAvatar, type Avatar, type AvatarBadge, type AvatarPin } from '../lib/avatars'
import { inkOn, mixColor } from '../lib/color'
import { GameThumbGlyph } from './GameThumbArt'
import { isWinterFinish, WinterSurface, winterInks, winterRim } from './season/WinterFinishes'

type PlayerAvatarProps = {
  /** Saved avatar string; falls back to the tag's default when missing or stale. */
  avatarId?: string | null
  name?: string
  /** A parsed avatar wins over `avatarId`, for previews that haven't been saved. */
  avatar?: Avatar
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  title?: string
}

const SIZE_REM: Record<NonNullable<PlayerAvatarProps['size']>, string> = {
  sm: '1.45rem',
  md: '2rem',
  lg: '3.5rem',
  xl: '7rem',
}

const NAVY = '#0e1720'
const INK = '#10202c'

/*
 * One round badge, the same size for everyone so a list of them reads as a
 * list: the tag's monogram on a pattern, or an emblem drawn bold enough to hold
 * up at board size. A ring goes around the badge and a pin on its edge, both
 * earned, both in their own colours so they mean the same thing on everyone.
 *
 * A finish from the prize counter (Glitter, Starfield, 8-bit, Neon, Lava,
 * Holo, Aurora, and Gold, which only a 30-day Today streak earns) is the
 * badge's own surface, inside its edge, so it never reads as a ring or a pin.
 * Its gradients and glow need ids, made per avatar so any number can share a
 * page.
 */

function finishRim(badge: AvatarBadge): string {
  if (isWinterFinish(badge)) return winterRim(badge)
  switch (badge) {
    case 'holo':
      return 'rgba(255,255,255,0.55)'
    case 'glitter':
      return 'rgba(255,255,255,0.3)'
    case 'neon':
      return 'rgba(255,255,255,0.12)'
    case 'lava':
      return 'rgba(255,138,61,0.35)'
    case 'aurora':
      return 'rgba(126,240,196,0.3)'
    case 'gilded':
      return 'rgba(255,244,200,0.5)'
    case 'orbit':
      return 'rgba(138,144,216,0.35)'
    case 'ringed':
      return 'rgba(245,185,66,0.4)'
    case 'mission':
      return 'rgba(242,129,58,0.45)'
    case 'supernova':
      return 'rgba(255,240,200,0.5)'
    case 'eclipse':
      return 'rgba(255,231,163,0.22)'
    case 'blue-marble':
      return 'rgba(159,214,255,0.4)'
    case 'black-hole':
      return 'rgba(255,179,71,0.28)'
    case 'pixels':
      return 'rgba(10,16,24,0.35)'
    case 'paper':
      return 'rgba(18,28,38,0.14)'
    default:
      return 'rgba(255,255,255,0.14)'
  }
}

function emblemRoles(avatar: Avatar): Record<ArtRole, string> {
  const body = avatarColor(avatar.body)
  const detail = avatarColor(avatar.detail)
  return {
    body,
    detail,
    dark: mixColor(body, NAVY, 0.35),
    light: mixColor(body, '#ffffff', 0.5),
    hi: 'rgba(255,255,255,0.32)',
    shade: 'rgba(10,16,24,0.2)',
    ink: '#17212c',
    white: '#ffffff',
    screen: '#111b25',
    steel: '#d3dbe1',
    tongue: '#ff7d95',
    rim: avatar.badge === 'paper' ? 'rgba(18,28,38,0.14)' : isFinishBadge(avatar.badge) ? finishRim(avatar.badge) : 'rgba(255,255,255,0.12)',
  }
}

function badgeFill(avatar: Avatar): string {
  const body = avatarColor(avatar.body)
  switch (avatar.badge) {
    case 'deep':
      return mixColor(body, NAVY, 0.6)
    case 'night':
      return '#101923'
    case 'paper':
      return '#f4efe6'
    default:
      return avatar.kind === 'mono' ? body : mixColor(avatarColor(avatar.detail), NAVY, 0.18)
  }
}

/** The pattern's ink, the letter's, and the line's under it; a finish draws no pattern. */
function monoInks(avatar: Avatar): { pattern: string; letter: string; line: string } {
  const body = avatarColor(avatar.body)
  const line = avatarColor(avatar.detail)
  if (isWinterFinish(avatar.badge)) return winterInks(avatar.badge)
  switch (avatar.badge) {
    case 'deep':
      return { pattern: mixColor(body, NAVY, 0.5), letter: body, line }
    case 'night':
      return { pattern: '#18232f', letter: body, line }
    case 'paper':
      return { pattern: '#e9e1d3', letter: mixColor(body, NAVY, 0.18), line }
    case 'holo':
      return { pattern: '', letter: '#1b2433', line: '#1b2433' }
    case 'neon':
      return { pattern: '', letter: mixColor(body, '#ffffff', 0.3), line: '#ff6fb5' }
    case 'starfield':
      return { pattern: '', letter: mixColor(body, '#ffffff', 0.25), line }
    case 'lava':
      return { pattern: '', letter: '#fff0dc', line: '#ff8a3d' }
    case 'aurora':
      return { pattern: '', letter: '#eafff6', line: '#3ee08f' }
    case 'gilded':
      return { pattern: '', letter: '#3a2604', line: '#fff1c2' }
    case 'orbit':
      return { pattern: '', letter: '#f4f0ff', line: '#8a90d8' }
    case 'ringed':
      return { pattern: '', letter: '#ffffff', line: '#f5b942' }
    case 'mission':
      return { pattern: '', letter: '#ffffff', line: '#f2813a' }
    case 'supernova':
      return { pattern: '', letter: '#1a1240', line: '#ffffff' }
    case 'eclipse':
      return { pattern: '', letter: '#f4f0ff', line: '#f5b942' }
    case 'blue-marble':
      return { pattern: '', letter: '#ffffff', line: '#ffffff' }
    case 'black-hole':
      return { pattern: '', letter: '#fff6e0', line: '#ffe7a3' }
    case 'glitter':
    case 'pixels':
      return { pattern: '', letter: inkOn(body, INK), line }
    default:
      return { pattern: mixColor(body, NAVY, 0.2), letter: inkOn(body, INK), line }
  }
}

/** A four-point twinkle. */
function sparkle(cx: number, cy: number, s: number) {
  return `M${cx} ${cy - s}Q${cx} ${cy} ${cx + s} ${cy}Q${cx} ${cy} ${cx} ${cy + s}Q${cx} ${cy} ${cx - s} ${cy}Q${cx} ${cy} ${cx} ${cy - s}Z`
}

const HOLO_SPARKS: [number, number, number][] = [
  [50, 17, 2.4],
  [14, 46, 1.7],
  [46, 52, 1.3],
]
const GLITTER_SPARKS: [number, number, number][] = [
  [14, 24, 2.6],
  [49, 15, 2],
  [53, 44, 2.8],
  [11, 44, 1.8],
  [21, 57, 1.6],
  [44, 57, 2],
  [32, 10, 1.5],
  [57, 30, 1.6],
]
const GLITTER_DOTS: [number, number, number][] = [
  [19, 16, 0.7],
  [40, 12, 0.6],
  [56, 38, 0.7],
  [8, 34, 0.6],
  [30, 60, 0.6],
  [52, 52, 0.6],
  [16, 50, 0.7],
  [46, 24, 0.5],
]
const STARS: [number, number, number][] = [
  [15, 22, 0.8],
  [24, 12, 0.6],
  [41, 11, 0.7],
  [52, 20, 0.9],
  [56, 36, 0.6],
  [49, 52, 0.8],
  [33, 59, 0.6],
  [18, 50, 0.7],
  [9, 36, 0.6],
  [27, 25, 0.4],
  [45, 33, 0.4],
]

/*
 * 8-bit: the disc in squares, ten across, shaded in four steps like a ball in
 * an old console game, lit from the top left. One path per step.
 */
const PIXEL = (27.6 * 2) / 10
const PIXEL_PATHS: string[] = (() => {
  const steps = ['', '', '', '']
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const x = 4.4 + col * PIXEL
      const y = 6.4 + row * PIXEL
      const dx = (x + PIXEL / 2 - 32) / 27.6
      const dy = (y + PIXEL / 2 - 34) / 27.6
      const r = Math.hypot(dx, dy)
      if (r > 1.1) continue
      const z = Math.sqrt(Math.max(0, 1 - Math.min(1, r) ** 2))
      const lit = -0.5 * dx - 0.62 * dy + 0.6 * z
      const step = lit > 0.66 ? 0 : lit > 0.38 ? 1 : lit > 0.06 ? 2 : 3
      steps[step] += `M${x.toFixed(2)} ${y.toFixed(2)}h${PIXEL.toFixed(2)}v${PIXEL.toFixed(2)}h${(-PIXEL).toFixed(2)}Z`
    }
  }
  return steps
})()

/** Lava: cracks through a dark crust, and the molten rock showing in them. */
const LAVA_CRACKS =
  'M8 31L14 28L19 31L24 26L31 28L37 33L43 30L49 33L56 30M24 26L22 19L26 13M43 30L46 22L52 19M37 33L35 41L39 47L36 55M35 41L28 44L21 42L15 47M21 42L17 36L10 38M39 47L46 50L52 45'
const LAVA_POOLS: [number, number, number][] = [
  [24, 26, 1.7],
  [37, 33, 1.5],
  [35, 41, 1.3],
  [21, 42, 1.2],
]

/** Aurora: curtains of light over a night sky, each a soft band with a bright line in it. */
const AURORA_BANDS: { d: string; colour: string }[] = [
  { d: 'M2 30C12 20 20 32 30 24S48 12 62 22', colour: '#3ee08f' },
  { d: 'M2 40C14 32 22 42 34 35S50 26 62 33', colour: '#2fe3cf' },
  { d: 'M2 20C10 14 22 22 32 15S50 8 62 12', colour: '#a178ff' },
]
const AURORA_STARS: [number, number, number][] = [
  [16, 12, 0.6],
  [44, 11, 0.7],
  [52, 46, 0.6],
  [12, 50, 0.7],
  [30, 55, 0.5],
  [26, 9, 0.45],
]

/*
 * Season 1's finishes (Space Race, its pass): a night sky with a moon going round, a ringed planet, a
 * mission patch, and a supernova at the top of the pass. Each stays inside the badge's edge.
 */
const SEASON_STARS: [number, number, number][] = [
  [14, 24, 0.7],
  [22, 13, 0.55],
  [40, 12, 0.6],
  [48, 50, 0.6],
  [17, 49, 0.55],
  [30, 58, 0.5],
  [10, 37, 0.5],
]

/*
 * Season 1's Pass+ finish, Eclipse: a black moon over the sun, the corona round it with soft streamers,
 * and the diamond of light where the sun last shows. The moon sits a little low so the line under a
 * monogram stays on it.
 */
const ECLIPSE_MOON = { cx: 32, cy: 35, r: 20 }
const ECLIPSE_RAYS: string = (() => {
  const { cx, cy, r } = ECLIPSE_MOON
  const rays: [number, number][] = [
    [-110, 7],
    [-78, 5],
    [-22, 7.5],
    [14, 5],
    [50, 6.5],
    [94, 5],
    [134, 7.5],
    [172, 5.5],
    [210, 7],
    [244, 5],
  ]
  const f = (v: number) => v.toFixed(2)
  let d = ''
  for (const [deg, len] of rays) {
    const a = (deg * Math.PI) / 180
    const ux = Math.cos(a)
    const uy = Math.sin(a)
    const bx = cx + ux * (r - 0.5)
    const by = cy + uy * (r - 0.5)
    d += `M${f(bx - uy * 1.8)} ${f(by + ux * 1.8)}L${f(cx + ux * (r + len))} ${f(cy + uy * (r + len))}L${f(bx + uy * 1.8)} ${f(by - ux * 1.8)}Z`
  }
  return d
})()
const ECLIPSE_DIAMOND = (() => {
  const a = (-50 * Math.PI) / 180
  return [Number((ECLIPSE_MOON.cx + Math.cos(a) * ECLIPSE_MOON.r).toFixed(2)), Number((ECLIPSE_MOON.cy + Math.sin(a) * ECLIPSE_MOON.r).toFixed(2))] as const
})()
/*
 * Blue marble: the Earth from space, lit from the top left. Its land and cloud keep to the edges, so the
 * monogram sits on open sea.
 */
const MARBLE_LAND: { d: string; fill: string }[] = [
  { d: 'M5 24C9 15 17 9 25 9C22 13 17 14 16 19C15 24 11 27 6 31Z', fill: '#4f9a4a' },
  { d: 'M11 19C13 16 16 15 17 17C15 19 13 21 11 19Z', fill: '#a8834a' },
  { d: 'M45 49C49 44 55 42 59 44C59 51 54 57 47 59C45 56 42 54 45 49Z', fill: '#4f9a4a' },
  { d: 'M51 47C54 46 57 47 57 49C55 51 52 51 51 47Z', fill: '#a8834a' },
  { d: 'M53 17C57 20 60 26 59 31C56 29 53 25 53 17Z', fill: '#a8834a' },
  { d: 'M6 42C10 44 13 50 11 55C8 52 6 48 6 42Z', fill: '#4f9a4a' },
]
const MARBLE_CLOUDS =
  'M13 13C21 8 33 7 44 11M8 47C11 44 15 46 14 50C13 53 9 53 9 50M51 24C56 27 58 33 55 37M22 59C29 61 37 61 43 58M44 16C49 17 51 20 49 22'

/*
 * Black hole: its shadow on the dark, the disc of burning gas across the front of it, and the far side of
 * the disc bent up over the top by its pull. The shadow sits high and the disc low, so a monogram keeps to
 * the black between them.
 */
const HOLE = { cx: 32, cy: 31, r: 17 }

const ECLIPSE_STARS: [number, number, number][] = [
  [12, 20, 0.6],
  [24, 10.5, 0.5],
  [11, 46, 0.55],
  [55, 26, 0.5],
]

function SeasonSurface({ badge, uid }: { badge: AvatarBadge; uid: string }) {
  const clip = (
    <clipPath id={`${uid}disc`}>
      <path d={BADGE_ART.disc} />
    </clipPath>
  )
  switch (badge) {
    case 'orbit':
      return (
        <>
          <defs>
            <radialGradient id={`${uid}orbit`} cx="0.4" cy="0.3" r="0.85">
              <stop offset="0" stopColor="#26306e" />
              <stop offset="0.6" stopColor="#141a40" />
              <stop offset="1" stopColor="#0a0d22" />
            </radialGradient>
            {clip}
          </defs>
          <path d={BADGE_ART.disc} fill={`url(#${uid}orbit)`} />
          {SEASON_STARS.map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#fff" opacity="0.8" />
          ))}
          <g clipPath={`url(#${uid}disc)`}>
            <ellipse cx="32" cy="36" rx="26" ry="8.5" fill="none" stroke="#8a90d8" strokeWidth="1" opacity="0.75" transform="rotate(-18 32 36)" />
          </g>
          <circle cx="53" cy="27.5" r="3.4" fill="#f4f0ff" />
          <circle cx="52.1" cy="26.6" r="0.9" fill="#c9c4e6" />
        </>
      )
    case 'ringed':
      return (
        <>
          <defs>
            <linearGradient id={`${uid}planet`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#b49cec" />
              <stop offset="0.55" stopColor="#8a6ad4" />
              <stop offset="1" stopColor="#4e3596" />
            </linearGradient>
            {clip}
          </defs>
          <path d={BADGE_ART.disc} fill={`url(#${uid}planet)`} />
          <g clipPath={`url(#${uid}disc)`} fill="none">
            <path d="M2 24Q32 17 62 24" stroke="#d6c8fa" strokeWidth="3" opacity="0.35" />
            <path d="M2 46Q32 39 62 46" stroke="#3d2780" strokeWidth="4" opacity="0.35" />
            <ellipse cx="32" cy="37" rx="31" ry="6.5" stroke="#c98a1c" strokeWidth="3.2" transform="rotate(-14 32 37)" />
            <ellipse cx="32" cy="37" rx="31" ry="6.5" stroke="#f5b942" strokeWidth="1.8" transform="rotate(-14 32 37)" />
          </g>
        </>
      )
    case 'mission':
      return (
        <>
          <defs>{clip}</defs>
          <path d={BADGE_ART.disc} fill="#101634" />
          <g clipPath={`url(#${uid}disc)`}>
            <path d="M4 50Q32 39 60 50V64H4Z" fill="#8a6ad4" />
          </g>
          <circle cx="32" cy="34" r="24.4" fill="none" stroke="#f2813a" strokeWidth="3.2" />
          <circle cx="32" cy="34" r="24.4" fill="none" stroke="#fff0e6" strokeWidth="0.7" strokeDasharray="1.4 1.6" />
          <path d={sparkle(18, 20, 2)} fill="#f5b942" />
          <path d={sparkle(47, 18, 1.5)} fill="#f4f0ff" />
        </>
      )
    case 'eclipse': {
      const { cx, cy, r } = ECLIPSE_MOON
      const [dx, dy] = ECLIPSE_DIAMOND
      return (
        <>
          <defs>
            <radialGradient id={`${uid}sky`} cx="0.5" cy="0.5" r="0.6">
              <stop offset="0" stopColor="#1a2252" />
              <stop offset="1" stopColor="#060818" />
            </radialGradient>
            <radialGradient id={`${uid}corona`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r="28">
              <stop offset="0.7" stopColor="#ffffff" />
              <stop offset="0.75" stopColor="#fff2cf" stopOpacity="0.9" />
              <stop offset="0.83" stopColor="#ffe7a3" stopOpacity="0.4" />
              <stop offset="0.93" stopColor="#f5b942" stopOpacity="0.08" />
              <stop offset="1" stopColor="#f5b942" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${uid}flare`}>
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.35" stopColor="#fff2cf" stopOpacity="0.8" />
              <stop offset="1" stopColor="#f5b942" stopOpacity="0" />
            </radialGradient>
            {clip}
          </defs>
          <path d={BADGE_ART.disc} fill={`url(#${uid}sky)`} />
          {ECLIPSE_STARS.map(([x, y, s]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={s} fill="#fff" opacity="0.75" />
          ))}
          <g clipPath={`url(#${uid}disc)`}>
            <path d={ECLIPSE_RAYS} fill="#ffe7a3" opacity="0.5" />
            <circle cx={cx} cy={cy} r="28" fill={`url(#${uid}corona)`} />
          </g>
          <circle cx={cx} cy={cy} r={r} fill="#05060f" />
          <circle cx={cx} cy={cy} r={r - 0.35} fill="none" stroke="#fff6e0" strokeWidth="0.7" opacity="0.85" />
          <circle cx={dx} cy={dy} r="6" fill={`url(#${uid}flare)`} />
          <path d={sparkle(dx, dy, 5.2)} fill="#ffffff" />
          <circle cx={dx} cy={dy} r="1.4" fill="#ffffff" />
        </>
      )
    }
    case 'blue-marble':
      return (
        <>
          <defs>
            <radialGradient id={`${uid}sea`} cx="0.3" cy="0.25" r="0.85">
              <stop offset="0" stopColor="#5fb4f0" />
              <stop offset="0.4" stopColor="#2466b8" />
              <stop offset="0.8" stopColor="#164a96" />
              <stop offset="1" stopColor="#0b2557" />
            </radialGradient>
            <linearGradient id={`${uid}night`} x1="0.2" y1="0.15" x2="0.9" y2="0.95">
              <stop offset="0.45" stopColor="#040a1e" stopOpacity="0" />
              <stop offset="1" stopColor="#040a1e" stopOpacity="0.5" />
            </linearGradient>
            {clip}
          </defs>
          <path d={BADGE_ART.disc} fill={`url(#${uid}sea)`} />
          <g clipPath={`url(#${uid}disc)`}>
            {MARBLE_LAND.map((l) => (
              <path key={l.d} d={l.d} fill={l.fill} />
            ))}
            <path d={MARBLE_CLOUDS} fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" opacity="0.85" />
            <ellipse cx="50" cy="31" rx="3" ry="1.6" fill="#ffffff" opacity="0.8" />
            <ellipse cx="9" cy="38" rx="2.2" ry="1.2" fill="#ffffff" opacity="0.75" />
            <path d={BADGE_ART.disc} fill={`url(#${uid}night)`} />
          </g>
          <circle cx="32" cy="34" r="26.8" fill="none" stroke="#9fd6ff" strokeWidth="1.4" opacity="0.55" />
        </>
      )
    case 'black-hole': {
      const { cx, cy, r } = HOLE
      return (
        <>
          <defs>
            <radialGradient id={`${uid}space`} cx="0.5" cy="0.45" r="0.6">
              <stop offset="0" stopColor="#1a1030" />
              <stop offset="1" stopColor="#05040c" />
            </radialGradient>
            <radialGradient id={`${uid}lens`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r="27">
              <stop offset="0.6" stopColor="#ffb347" stopOpacity="0.55" />
              <stop offset="0.8" stopColor="#f2813a" stopOpacity="0.2" />
              <stop offset="1" stopColor="#e8564f" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`${uid}disk`} gradientUnits="userSpaceOnUse" x1="4" y1="0" x2="60" y2="0">
              <stop offset="0" stopColor="#fff6e0" />
              <stop offset="0.45" stopColor="#ffb347" />
              <stop offset="1" stopColor="#c8402a" />
            </linearGradient>
            {clip}
          </defs>
          <path d={BADGE_ART.disc} fill={`url(#${uid}space)`} />
          <circle cx="12" cy="16" r="0.55" fill="#fff" opacity="0.7" />
          <circle cx="53" cy="15" r="0.5" fill="#fff" opacity="0.6" />
          <circle cx="10" cy="52" r="0.5" fill="#fff" opacity="0.6" />
          <g clipPath={`url(#${uid}disc)`} fill="none">
            <circle cx={cx} cy={cy} r="27" fill={`url(#${uid}lens)`} />
            <path d="M3 40A29 6.5 0 0 1 61 40" stroke={`url(#${uid}disk)`} strokeWidth="2.6" opacity="0.85" />
            <path d={`M${cx - r - 2} ${cy}A${r + 2} ${r + 2} 0 0 1 ${cx + r + 2} ${cy}`} stroke={`url(#${uid}disk)`} strokeWidth="3.4" strokeLinecap="round" />
          </g>
          <circle cx={cx} cy={cy} r={r} fill="#000000" />
          <circle cx={cx} cy={cy} r={r + 0.4} fill="none" stroke="#fff6e0" strokeWidth="0.7" opacity="0.9" />
          <g clipPath={`url(#${uid}disc)`} fill="none">
            <path d="M3 40A29 6.5 0 0 0 61 40" stroke={`url(#${uid}disk)`} strokeWidth="5.5" opacity="0.35" />
            <path d="M3 40A29 6.5 0 0 0 61 40" stroke={`url(#${uid}disk)`} strokeWidth="2.8" />
            <path d="M8 43.65A29 6.5 0 0 0 40 46.25" stroke="#ffffff" strokeWidth="0.8" strokeLinecap="round" opacity="0.8" />
          </g>
        </>
      )
    }
    default:
      // Supernova: the badge in the bright heart of a nebula, a comet going by.
      return (
        <>
          <defs>
            <radialGradient id={`${uid}nova`} cx="0.5" cy="0.47" r="0.62">
              <stop offset="0" stopColor="#fff6e0" />
              <stop offset="0.2" stopColor="#ffd27a" />
              <stop offset="0.45" stopColor="#e85d9a" />
              <stop offset="0.75" stopColor="#5b3fb0" />
              <stop offset="1" stopColor="#101634" />
            </radialGradient>
            {clip}
          </defs>
          <path d={BADGE_ART.disc} fill={`url(#${uid}nova)`} />
          <g clipPath={`url(#${uid}disc)`}>
            <ellipse cx="18" cy="48" rx="14" ry="6" fill="#6b74e8" opacity="0.35" transform="rotate(-20 18 48)" />
            <ellipse cx="48" cy="20" rx="12" ry="5" fill="#e85d9a" opacity="0.3" transform="rotate(25 48 20)" />
            <path d="M8 14L22 22" stroke="#ffffff" strokeWidth="1.1" strokeLinecap="round" opacity="0.6" />
          </g>
          <circle cx="22.5" cy="22.3" r="1.4" fill="#ffffff" />
          <path d={sparkle(50, 46, 2.2)} fill="#ffffff" />
          <path d={sparkle(14, 36, 1.4)} fill="#ffe7a3" />
        </>
      )
  }
}

/** A finish's surface: the disc in it, and what lies over the disc before the face. */
function FinishSurface({ avatar, uid }: { avatar: Avatar; uid: string }) {
  const body = avatarColor(avatar.body)
  // Season 2's (Cold Snap) are drawn in their own file.
  if (isWinterFinish(avatar.badge)) return <WinterSurface badge={avatar.badge} uid={uid} />
  switch (avatar.badge) {
    case 'orbit':
    case 'ringed':
    case 'mission':
    case 'supernova':
    case 'eclipse':
    case 'blue-marble':
    case 'black-hole':
      return <SeasonSurface badge={avatar.badge} uid={uid} />
    case 'pixels': {
      const steps = [mixColor(body, '#ffffff', 0.42), mixColor(body, '#ffffff', 0.16), body, mixColor(body, NAVY, 0.32)]
      return (
        <>
          <defs>
            <clipPath id={`${uid}disc`}>
              <path d={BADGE_ART.disc} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${uid}disc)`}>
            {PIXEL_PATHS.map((d, i) => (
              <path key={i} d={d} fill={steps[i]} />
            ))}
            <rect x={4.4 + 3 * PIXEL} y={6.4 + 2 * PIXEL} width={PIXEL} height={PIXEL} fill="#fff" opacity="0.85" />
          </g>
        </>
      )
    }
    case 'lava':
      return (
        <>
          <defs>
            <radialGradient id={`${uid}crust`} cx="0.45" cy="0.5" r="0.7">
              <stop offset="0" stopColor="#4a1f14" />
              <stop offset="1" stopColor="#1a0c09" />
            </radialGradient>
            <clipPath id={`${uid}disc`}>
              <path d={BADGE_ART.disc} />
            </clipPath>
          </defs>
          <path d={BADGE_ART.disc} fill={`url(#${uid}crust)`} />
          <g clipPath={`url(#${uid}disc)`} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={LAVA_CRACKS} stroke="rgba(255,90,31,0.35)" strokeWidth="3.6" />
            <path d={LAVA_CRACKS} stroke="#ff6a24" strokeWidth="1.5" />
            <path d={LAVA_CRACKS} stroke="#ffd08a" strokeWidth="0.5" />
          </g>
          {LAVA_POOLS.map(([x, y, r]) => (
            <g key={`${x}-${y}`}>
              <circle cx={x} cy={y} r={r * 1.7} fill="rgba(255,90,31,0.3)" />
              <circle cx={x} cy={y} r={r} fill="#ff8a3d" />
              <circle cx={x} cy={y} r={r * 0.45} fill="#ffe0a6" />
            </g>
          ))}
        </>
      )
    case 'aurora':
      return (
        <>
          <defs>
            <linearGradient id={`${uid}sky`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#10244a" />
              <stop offset="1" stopColor="#060d1a" />
            </linearGradient>
            <clipPath id={`${uid}disc`}>
              <path d={BADGE_ART.disc} />
            </clipPath>
          </defs>
          <path d={BADGE_ART.disc} fill={`url(#${uid}sky)`} />
          <g clipPath={`url(#${uid}disc)`} fill="none" strokeLinecap="round">
            {AURORA_BANDS.map((b) => (
              <g key={b.colour}>
                <path d={b.d} stroke={b.colour} strokeWidth="10" opacity="0.18" />
                <path d={b.d} stroke={b.colour} strokeWidth="4.5" opacity="0.32" />
                <path d={b.d} stroke={mixColor(b.colour, '#ffffff', 0.45)} strokeWidth="1.1" opacity="0.8" />
              </g>
            ))}
          </g>
          {AURORA_STARS.map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#fff" opacity="0.85" />
          ))}
        </>
      )
    case 'gilded':
      return (
        <>
          <defs>
            <linearGradient id={`${uid}gold`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff0b3" />
              <stop offset="0.35" stopColor="#f7c948" />
              <stop offset="0.7" stopColor="#d99a1e" />
              <stop offset="1" stopColor="#a8700c" />
            </linearGradient>
            <linearGradient id={`${uid}goldsheen`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0.34" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.46" stopColor="#fff" stopOpacity="0.65" />
              <stop offset="0.56" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={BADGE_ART.disc} fill={`url(#${uid}gold)`} />
          <path d={BADGE_ART.disc} fill={`url(#${uid}goldsheen)`} />
          <circle cx="32" cy="34" r="24.5" fill="none" stroke="rgba(120,78,6,0.35)" strokeWidth="1" />
          {HOLO_SPARKS.map(([x, y, s]) => (
            <path key={`${x}-${y}`} d={sparkle(x, y, s)} fill="#fffbe6" opacity="0.95" />
          ))}
        </>
      )
    case 'holo':
      return (
        <>
          <defs>
            <linearGradient id={`${uid}holo`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffb8e2" />
              <stop offset="0.28" stopColor="#b3d7ff" />
              <stop offset="0.52" stopColor="#b8ffe1" />
              <stop offset="0.76" stopColor="#ffeaa6" />
              <stop offset="1" stopColor="#d7b8ff" />
            </linearGradient>
            <linearGradient id={`${uid}sheen`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0.3" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.44" stopColor="#fff" stopOpacity="0.7" />
              <stop offset="0.54" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.66" stopColor="#fff" stopOpacity="0.3" />
              <stop offset="0.72" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={BADGE_ART.disc} fill={`url(#${uid}holo)`} />
          <path d={BADGE_ART.disc} fill={`url(#${uid}sheen)`} />
          {HOLO_SPARKS.map(([x, y, s]) => (
            <path key={`${x}-${y}`} d={sparkle(x, y, s)} fill="#fff" opacity="0.9" />
          ))}
        </>
      )
    case 'neon':
      return (
        <>
          <defs>
            <filter id={`${uid}glow`} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="1.1" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path d={BADGE_ART.disc} fill="#0b1016" />
          <circle cx="32" cy="34" r="23.4" fill="none" stroke={mixColor(body, '#ffffff', 0.3)} strokeWidth="1.5" filter={`url(#${uid}glow)`} />
        </>
      )
    case 'starfield':
      return (
        <>
          <defs>
            <radialGradient id={`${uid}night`} cx="0.35" cy="0.3" r="0.85">
              <stop offset="0" stopColor="#2d3f86" />
              <stop offset="0.55" stopColor="#16204a" />
              <stop offset="1" stopColor="#0a0f24" />
            </radialGradient>
          </defs>
          <path d={BADGE_ART.disc} fill={`url(#${uid}night)`} />
          {STARS.map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#fff" opacity="0.85" />
          ))}
          <path d={sparkle(50, 16, 2.2)} fill="#d9e6ff" />
          <path d={sparkle(13, 44, 1.6)} fill="#d9e6ff" />
        </>
      )
    default:
      // Glitter: the badge's own colour, lit from the top left, with sparkle in it.
      return (
        <>
          <defs>
            <radialGradient id={`${uid}shine`} cx="0.35" cy="0.3" r="0.75">
              <stop offset="0" stopColor="#fff" stopOpacity="0.38" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path d={BADGE_ART.disc} fill={badgeFill({ ...avatar, badge: 'bold' })} />
          <path d={BADGE_ART.disc} fill={`url(#${uid}shine)`} />
          {GLITTER_SPARKS.map(([x, y, s]) => (
            <path key={`${x}-${y}`} d={sparkle(x, y, s)} fill="#fff" opacity="0.92" />
          ))}
          {GLITTER_DOTS.map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#fff" opacity="0.8" />
          ))}
        </>
      )
  }
}

function Pin({ pin }: { pin: AvatarPin }) {
  const [x, y] = PIN_AT
  if (isGamePin(pin)) {
    const color = getGame(pin)?.accent ?? '#4aa8e8'
    return (
      <g transform={`translate(${x} ${y})`}>
        <path d={PIN_EDGE} fill="#0f1720" />
        <path d={PIN_DISC} fill={color} />
        <g transform="scale(0.37) translate(-16 -16)">
          <GameThumbGlyph slug={pin} color={inkOn(color, INK)} />
        </g>
      </g>
    )
  }
  const art = PIN_GLYPHS[pin]
  if (!art) return null
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={PIN_EDGE} fill="#0f1720" />
      <path d={PIN_DISC} fill={art.color} />
      {art.parts.map((d, i) => (
        <path key={i} d={d} fill={art.glyph} />
      ))}
    </g>
  )
}

/** The whole mark as SVG children on a 64-unit stage. */
export function AvatarArt({ avatar, name }: { avatar: Avatar; name: string }) {
  const uid = `av${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const ring = avatar.ring ? RING_ART[avatar.ring] : null
  const finish = isFinishBadge(avatar.badge)
  return (
    <>
      {ring?.map((p, i) => <path key={`r${i}`} d={p.d} fill={p.fill} />)}
      {finish ? <FinishSurface avatar={avatar} uid={uid} /> : <path d={BADGE_ART.disc} fill={badgeFill(avatar)} />}
      {avatar.kind === 'mono' ? (
        <MonoFace avatar={avatar} name={name} rim={finishRim(avatar.badge)} glow={avatar.badge === 'neon' ? `url(#${uid}glow)` : undefined} />
      ) : (
        <EmblemFace avatar={avatar} />
      )}
      {avatar.pin ? <Pin pin={avatar.pin} /> : null}
    </>
  )
}

function MonoFace({
  avatar,
  name,
  rim,
  glow,
}: {
  avatar: Extract<Avatar, { kind: 'mono' }>
  name: string
  rim: string
  /** Neon's glow, for the lit letter and line. */
  glow?: string
}) {
  const inks = monoInks(avatar)
  const pattern = inks.pattern ? PATTERN_ART[avatar.pattern] : ''
  const text = monogramText(name, avatar.letters)
  const two = text.length > 1
  return (
    <>
      {pattern ? <path d={pattern} fill={inks.pattern} /> : null}
      <path d={BADGE_ART.rim} fill={rim} />
      <path d={two ? BADGE_ART.line2 : BADGE_ART.line1} fill={inks.line} filter={glow} opacity={avatar.badge === 'holo' ? 0.8 : undefined} />
      <text
        className="player-avatar__letters"
        x="32"
        y={two ? 42.4 : 44.6}
        textAnchor="middle"
        fontSize={two ? 22 : 30}
        fill={glow ? 'none' : inks.letter}
        stroke={glow ? inks.letter : undefined}
        strokeWidth={glow ? 1.4 : undefined}
        filter={glow}
      >
        {text}
      </text>
    </>
  )
}

function EmblemFace({ avatar }: { avatar: Extract<Avatar, { kind: 'emblem' }> }) {
  const roles = emblemRoles(avatar)
  return (
    <>
      <path d={BADGE_ART.rim} fill={roles.rim} />
      <path d={BADGE_ART.drop} fill="rgba(4,8,14,0.28)" />
      {EMBLEM_ART[avatar.emblem]?.map((p, i) => <path key={i} d={p.d} fill={roles[p.role]} />)}
    </>
  )
}

/** One player's mark, drawn from their saved avatar or their tag's default. */
export function PlayerAvatar({ avatarId, name = '', avatar, size = 'md', className, title }: PlayerAvatarProps) {
  const resolved = avatar ?? resolveAvatar(avatarId, name)
  const style = { '--avatar-size': SIZE_REM[size] } as CSSProperties
  return (
    <span
      className={`player-avatar player-avatar--${size}${className ? ` ${className}` : ''}`}
      style={style}
      role="img"
      aria-label={title ?? (name ? `${name}'s avatar` : 'Avatar')}
    >
      <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <AvatarArt avatar={resolved} name={name} />
      </svg>
    </span>
  )
}
