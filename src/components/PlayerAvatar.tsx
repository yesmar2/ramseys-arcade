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

const INK = '#1b2430'
const SIZE_REM: Record<NonNullable<PlayerAvatarProps['size']>, string> = {
  sm: '1.45rem',
  md: '2rem',
  lg: '3.5rem',
  xl: '7rem',
}

/**
 * The cast. Every character is drawn on a 64×64 stage, body colour `b`,
 * accent colour `a`, and the same two eyes so they read as one family.
 */
function Eyes({ cx1, cx2, cy, r = 4.2 }: { cx1: number; cx2: number; cy: number; r?: number }) {
  return (
    <>
      <circle cx={cx1} cy={cy} r={r} fill="#fff" />
      <circle cx={cx2} cy={cy} r={r} fill="#fff" />
      <circle cx={cx1 + 0.8} cy={cy + 0.6} r={r * 0.5} fill={INK} />
      <circle cx={cx2 + 0.8} cy={cy + 0.6} r={r * 0.5} fill={INK} />
    </>
  )
}

function Smile({ cx, cy, w = 8 }: { cx: number; cy: number; w?: number }) {
  return (
    <path
      d={`M${cx - w / 2} ${cy} q${w / 2} ${w * 0.55} ${w} 0`}
      fill="none"
      stroke={INK}
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  )
}

function Cheeks({ cx1, cx2, cy, a }: { cx1: number; cx2: number; cy: number; a: string }) {
  return (
    <>
      <circle cx={cx1} cy={cy} r="3" fill={a} opacity="0.85" />
      <circle cx={cx2} cy={cy} r="3" fill={a} opacity="0.85" />
    </>
  )
}

function shapeArt(shape: AvatarShape, b: string, a: string) {
  switch (shape) {
    case 'blob':
      return (
        <>
          <path
            d="M32 8c13 0 22 9 23 21 1 11-4 20-10 25-6 5-20 5-27 0C11 49 7 40 9 29 10 17 19 8 32 8z"
            fill={b}
          />
          <Eyes cx1={24} cx2={40} cy={30} />
          <Smile cx={32} cy={40} />
          <Cheeks cx1={18} cx2={46} cy={38} a={a} />
        </>
      )
    case 'bot':
      return (
        <>
          <path d="M32 6v8" stroke={a} strokeWidth="3" strokeLinecap="round" />
          <circle cx="32" cy="6" r="3.5" fill={a} />
          <rect x="11" y="14" width="42" height="40" rx="11" fill={b} />
          <rect x="17" y="24" width="30" height="14" rx="7" fill={INK} />
          <circle cx="25" cy="31" r="3.6" fill="#fff" />
          <circle cx="39" cy="31" r="3.6" fill="#fff" />
          <circle cx="25.8" cy="31.6" r="1.8" fill={INK} />
          <circle cx="39.8" cy="31.6" r="1.8" fill={INK} />
          <rect x="22" y="44" width="20" height="4" rx="2" fill={a} />
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
          <Eyes cx1={23} cx2={41} cy={33} r={4} />
          <path d="M29.5 41.5 L34.5 41.5 L32 44.5z" fill={INK} />
          <path d="M32 44.5 v3 M32 47.5 q-4 2 -6 -1 M32 47.5 q4 2 6 -1" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M6 37 L17 39 M6 44 L17 42 M58 37 L47 39 M58 44 L47 42" stroke={INK} strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
        </>
      )
    case 'ghost':
      return (
        <>
          <path
            d="M32 7c-13 0-21 9-21 22v26l7-5 7 5 7-5 7 5 7-5 7 5V29C53 16 45 7 32 7z"
            fill={b}
          />
          <Eyes cx1={24} cx2={40} cy={28} r={4.6} />
          <ellipse cx="32" cy="40" rx="4" ry="3" fill={INK} />
          <Cheeks cx1={17} cx2={47} cy={36} a={a} />
        </>
      )
    case 'star':
      return (
        <>
          <path
            d="M32 5l7.6 15.9 17.4 2.3-12.7 12 3.3 17.3L32 44.2l-15.6 8.3 3.3-17.3-12.7-12 17.4-2.3z"
            fill={b}
            strokeLinejoin="round"
          />
          <Eyes cx1={26} cx2={38} cy={30} r={3.6} />
          <Smile cx={32} cy={38} w={7} />
          <path d="M14 10 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5z" fill={a} />
        </>
      )
    case 'drop':
      return (
        <>
          <path d="M32 5C32 5 12 29 12 40a20 20 0 0 0 40 0C52 29 32 5 32 5z" fill={b} />
          <Eyes cx1={25} cx2={39} cy={38} r={4} />
          <Smile cx={32} cy={47} w={7} />
          <path d="M22 30c-3 3-5 7-5 11" fill="none" stroke={a} strokeWidth="3" strokeLinecap="round" opacity="0.9" />
        </>
      )
    case 'block':
      return (
        <>
          <rect x="9" y="12" width="46" height="44" rx="9" fill={b} />
          <rect x="9" y="12" width="46" height="9" rx="4.5" fill={a} />
          <rect x="20" y="30" width="7" height="8" rx="1.5" fill={INK} />
          <rect x="37" y="30" width="7" height="8" rx="1.5" fill={INK} />
          <rect x="21" y="31" width="2.5" height="2.5" fill="#fff" />
          <rect x="38" y="31" width="2.5" height="2.5" fill="#fff" />
          <rect x="25" y="45" width="14" height="3" rx="1.5" fill={INK} />
        </>
      )
    case 'mush':
      return (
        <>
          <rect x="21" y="30" width="22" height="26" rx="8" fill="#f2e6d4" />
          <path d="M6 32c0-15 12-25 26-25s26 10 26 25c0 2-1 3-3 3H9c-2 0-3-1-3-3z" fill={b} />
          <circle cx="20" cy="20" r="4" fill={a} />
          <circle cx="36" cy="14" r="3" fill={a} />
          <circle cx="46" cy="24" r="3.5" fill={a} />
          <Eyes cx1={27} cx2={37} cy={42} r={3} />
          <Smile cx={32} cy={49} w={6} />
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
