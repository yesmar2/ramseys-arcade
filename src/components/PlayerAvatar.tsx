import { useId, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { BADGE_ART, EMBLEM_ART, PATTERN_ART, PIN_AT, PIN_DISC, PIN_EDGE, PIN_GLYPHS, RING_ART, type ArtRole } from '../lib/avatarArt'
import { avatarColor, isFinishBadge, isGamePin, monogramText, resolveAvatar, type Avatar, type AvatarBadge, type AvatarPin } from '../lib/avatars'
import { inkOn, mixColor } from '../lib/color'
import { GameThumbGlyph } from './GameThumbArt'

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
 * A finish from the prize counter (Glitter, Starfield, Neon, Holo) is the
 * badge's own surface, inside its edge, so it never reads as a ring or a pin.
 * Its gradients and glow need ids, made per avatar so any number can share a
 * page.
 */

function finishRim(badge: AvatarBadge): string {
  switch (badge) {
    case 'holo':
      return 'rgba(255,255,255,0.55)'
    case 'glitter':
      return 'rgba(255,255,255,0.3)'
    case 'neon':
      return 'rgba(255,255,255,0.12)'
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
    case 'glitter':
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

/** A finish's surface: the disc in it, and what lies over the disc before the face. */
function FinishSurface({ avatar, uid }: { avatar: Avatar; uid: string }) {
  const body = avatarColor(avatar.body)
  switch (avatar.badge) {
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
