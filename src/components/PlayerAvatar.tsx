import type { CSSProperties } from 'react'
import { avatarColor, resolveAvatar, type Avatar, type AvatarShape } from '../lib/avatars'

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

const INK = '#141b24'
const SIZE_REM: Record<NonNullable<PlayerAvatarProps['size']>, string> = {
  sm: '1.45rem',
  md: '2rem',
  lg: '3.5rem',
  xl: '7rem',
}

/*
 * The cast, drawn on a 64×64 stage in the body colour `b` and accent `a`.
 * Flat shapes, small dark eyes, no grins: closer to a set of arcade marks
 * than a set of mascots. Some have no face at all — a gem, a bolt, a pad —
 * for people who'd rather have a symbol than a creature.
 */

function Dots({ x1, x2, y, r = 2.6 }: { x1: number; x2: number; y: number; r?: number }) {
  return (
    <>
      <circle cx={x1} cy={y} r={r} fill={INK} />
      <circle cx={x2} cy={y} r={r} fill={INK} />
    </>
  )
}

function shapeArt(shape: AvatarShape, b: string, a: string) {
  switch (shape) {
    case 'blob':
      return (
        <>
          <path d="M32 8c13 0 22 9 23 21 1 11-4 20-10 25-6 5-20 5-27 0C11 49 7 40 9 29 10 17 19 8 32 8z" fill={b} />
          <path d="M11 41c6 4 36 4 42 0v6c-6 5-36 5-42 0z" fill={a} opacity="0.9" />
          <Dots x1={24} x2={40} y={30} />
        </>
      )
    case 'bot':
      return (
        <>
          <path d="M32 6v8" stroke={a} strokeWidth="3" strokeLinecap="round" />
          <circle cx="32" cy="6" r="3.2" fill={a} />
          <rect x="11" y="14" width="42" height="40" rx="10" fill={b} />
          <rect x="17" y="24" width="30" height="13" rx="6.5" fill={INK} />
          <rect x="22" y="29" width="7" height="3" rx="1.5" fill={a} />
          <rect x="35" y="29" width="7" height="3" rx="1.5" fill={a} />
          <rect x="24" y="44" width="16" height="3" rx="1.5" fill={INK} opacity="0.6" />
        </>
      )
    case 'cat':
      return (
        <>
          <path d="M12 30 L10 8 L28 18z" fill={b} />
          <path d="M52 30 L54 8 L36 18z" fill={b} />
          <path d="M14 24 L13 12 L23 18z" fill={a} />
          <path d="M50 24 L51 12 L41 18z" fill={a} />
          <ellipse cx="32" cy="36" rx="23" ry="20" fill={b} />
          <ellipse cx="23" cy="34" rx="3.4" ry="2.6" fill={INK} />
          <ellipse cx="41" cy="34" rx="3.4" ry="2.6" fill={INK} />
          <path d="M30 42 L34 42 L32 44.5z" fill={INK} />
        </>
      )
    case 'ghost':
      return (
        <>
          <path d="M32 7c-13 0-21 9-21 22v26l7-5 7 5 7-5 7 5 7-5 7 5V29C53 16 45 7 32 7z" fill={b} />
          <path d="M11 44v-5h42v5H11z" fill={a} opacity="0.85" />
          <Dots x1={25} x2={39} y={29} r={3} />
        </>
      )
    case 'star':
      return (
        <>
          <path d="M32 5l7.6 15.9 17.4 2.3-12.7 12 3.3 17.3L32 44.2l-15.6 8.3 3.3-17.3-12.7-12 17.4-2.3z" fill={b} />
          <Dots x1={26.5} x2={37.5} y={31} r={2.4} />
          <path d="M14 10 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5z" fill={a} />
        </>
      )
    case 'drop':
      return (
        <>
          <path d="M32 5C32 5 12 29 12 40a20 20 0 0 0 40 0C52 29 32 5 32 5z" fill={b} />
          <path d="M22 31c-3 3-5 7-5 11" fill="none" stroke={a} strokeWidth="3" strokeLinecap="round" />
          <Dots x1={26} x2={38} y={40} r={2.6} />
        </>
      )
    case 'block':
      return (
        <>
          <rect x="9" y="12" width="46" height="44" rx="9" fill={b} />
          <rect x="9" y="12" width="46" height="9" rx="4.5" fill={a} />
          <rect x="20" y="31" width="7" height="7" rx="1.5" fill={INK} />
          <rect x="37" y="31" width="7" height="7" rx="1.5" fill={INK} />
        </>
      )
    case 'mush':
      return (
        <>
          <rect x="21" y="30" width="22" height="26" rx="8" fill="#e8e1d6" />
          <path d="M6 32c0-15 12-25 26-25s26 10 26 25c0 2-1 3-3 3H9c-2 0-3-1-3-3z" fill={b} />
          <circle cx="20" cy="20" r="4" fill={a} />
          <circle cx="36" cy="14" r="3" fill={a} />
          <circle cx="46" cy="24" r="3.5" fill={a} />
          <Dots x1={27.5} x2={36.5} y={43} r={2.2} />
        </>
      )
    case 'alien':
      return (
        <>
          <path d="M20 6 l4 10 M44 6 l-4 10" stroke={b} strokeWidth="3" strokeLinecap="round" />
          <circle cx="19.5" cy="5.5" r="3" fill={a} />
          <circle cx="44.5" cy="5.5" r="3" fill={a} />
          <path d="M32 14c14 0 22 9 22 20 0 12-11 24-22 24S10 46 10 34c0-11 8-20 22-20z" fill={b} />
          <ellipse cx="23.5" cy="34" rx="5" ry="7" fill={INK} transform="rotate(-18 23.5 34)" />
          <ellipse cx="40.5" cy="34" rx="5" ry="7" fill={INK} transform="rotate(18 40.5 34)" />
        </>
      )
    case 'fox':
      return (
        <>
          <path d="M9 12 L24 22 L14 34z" fill={b} />
          <path d="M55 12 L40 22 L50 34z" fill={b} />
          <path d="M12 16 L22 23 L15 31z" fill={a} />
          <path d="M52 16 L42 23 L49 31z" fill={a} />
          <path d="M12 30c0-8 9-14 20-14s20 6 20 14c0 12-9 26-20 28C21 56 12 42 12 30z" fill={b} />
          <path d="M20 40c3 5 8 9 12 10 4-1 9-5 12-10-3-2-8-3-12-3s-9 1-12 3z" fill={a} />
          <ellipse cx="24" cy="33" rx="3" ry="2.4" fill={INK} />
          <ellipse cx="40" cy="33" rx="3" ry="2.4" fill={INK} />
          <path d="M30 46 L34 46 L32 48.5z" fill={INK} />
        </>
      )
    case 'skull':
      return (
        <>
          <path d="M32 6c-14 0-24 10-24 23 0 8 4 14 9 18v7h30v-7c5-4 9-10 9-18C56 16 46 6 32 6z" fill={b} />
          <ellipse cx="23" cy="30" rx="6" ry="6.5" fill={INK} />
          <ellipse cx="41" cy="30" rx="6" ry="6.5" fill={INK} />
          <circle cx="23" cy="30" r="2" fill={a} />
          <circle cx="41" cy="30" r="2" fill={a} />
          <path d="M29 40 L32 44 L35 40z" fill={INK} />
          <path d="M25 54v-6 M29.5 54v-6 M34.5 54v-6 M39 54v-6" stroke={INK} strokeWidth="1.8" opacity="0.55" />
        </>
      )
    case 'slime':
      return (
        <>
          <path d="M8 46c0-14 10-28 24-28s24 14 24 28c0 5-4 8-9 8H17c-5 0-9-3-9-8z" fill={b} />
          <path d="M44 20c4 2 7 6 8 10" fill="none" stroke={a} strokeWidth="3" strokeLinecap="round" />
          <path d="M14 54c0 3 2 6 4 6s4-3 4-6z" fill={b} />
          <Dots x1={25} x2={39} y={38} r={2.8} />
        </>
      )
    case 'gem':
      return (
        <>
          <path d="M18 10h28l12 14-26 32L6 24z" fill={b} />
          <path d="M18 10 L32 24 L46 10z" fill={a} opacity="0.9" />
          <path d="M6 24h52L32 56z" fill={INK} opacity="0.18" />
          <path d="M18 10 L6 24 L32 24z M46 10 L58 24 L32 24z" fill="#fff" opacity="0.18" />
        </>
      )
    case 'bolt':
      return (
        <>
          <path d="M36 4 L14 36 h15 l-5 24 L50 26 H35z" fill={b} />
          <path d="M34 12 L22 32 h11 l-3 12 L42 28 h-9z" fill={a} opacity="0.9" />
        </>
      )
    case 'rocket':
      return (
        <>
          <path d="M32 4c9 8 13 18 13 30v10H19V34C19 22 23 12 32 4z" fill={b} />
          <path d="M19 32 L8 44 v6 l11 -4z M45 32 L56 44 v6 l-11 -4z" fill={a} />
          <path d="M26 44h12l-3 8h-6z" fill={a} />
          <path d="M28 56c1 4 3 6 4 6s3-2 4-6z" fill={INK} opacity="0.4" />
          <circle cx="32" cy="26" r="6" fill={INK} />
          <circle cx="32" cy="26" r="3.2" fill="#fff" opacity="0.25" />
        </>
      )
    case 'pad':
      return (
        <>
          <path d="M14 18h36c6 0 10 5 10 11v10c0 8-5 13-11 13-4 0-7-3-9-6H24c-2 3-5 6-9 6-6 0-11-5-11-13V29c0-6 4-11 10-11z" fill={b} />
          <path d="M18 27h4v4h4v4h-4v4h-4v-4h-4v-4h4z" fill={INK} opacity="0.7" />
          <circle cx="42" cy="28" r="3" fill={a} />
          <circle cx="48" cy="34" r="3" fill={a} />
          <circle cx="42" cy="40" r="3" fill={INK} opacity="0.5" />
          <circle cx="36" cy="34" r="3" fill={INK} opacity="0.5" />
        </>
      )
  }
}

/** One player's character, drawn from their saved avatar or their tag's default. */
export function PlayerAvatar({ avatarId, name = '', avatar, size = 'md', className, title }: PlayerAvatarProps) {
  const resolved = avatar ?? resolveAvatar(avatarId, name)
  const body = avatarColor(resolved.body)
  const accent = avatarColor(resolved.accent)
  const style = { '--avatar-size': SIZE_REM[size] } as CSSProperties
  return (
    <span
      className={`player-avatar player-avatar--${size}${className ? ` ${className}` : ''}`}
      style={style}
      role="img"
      aria-label={title ?? (name ? `${name}'s avatar` : 'Avatar')}
    >
      <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        {shapeArt(resolved.shape, body, accent)}
      </svg>
    </span>
  )
}
