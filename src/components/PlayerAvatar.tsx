import type { CSSProperties } from 'react'
import { resolveAvatarId, type AvatarId } from '../lib/avatars'

type PlayerAvatarProps = {
  avatarId?: string | null
  name?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

function glyph(id: AvatarId) {
  switch (id) {
    case 'orb':
      return (
        <>
          <circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="2.2" fill="currentColor" />
        </>
      )
    case 'bolt':
      return (
        <path
          d="M13 3L5.5 13.5h5L10 21l8-11h-5.5L13 3z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      )
    case 'ship':
      return (
        <path
          d="M12 4l6 14H6L12 4z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      )
    case 'star':
      return (
        <path
          d="M12 3.5l2.1 5.2 5.6.4-4.3 3.6 1.4 5.4L12 15.4 7.2 18.1l1.4-5.4L4.3 9.1l5.6-.4L12 3.5z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      )
    case 'pulse':
      return (
        <path
          d="M3 12h4l2-5 3 10 2-5h7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    case 'chip':
      return (
        <>
          <rect x="7" y="7" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M10 4v3M14 4v3M10 17v3M14 17v3M4 10h3M4 14h3M17 10h3M17 14h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </>
      )
    case 'ring':
      return (
        <>
          <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </>
      )
    case 'wave':
      return (
        <path
          d="M3 14c2.5-4 5-4 7.5 0s5 4 7.5 0 5-4 7.5 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )
    case 'coin':
      return (
        <>
          <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 8v8M9.5 10.2c.6-1 1.5-1.5 2.5-1.5s2 .7 2 1.8-1 1.7-2.5 2.1-2.5.9-2.5 2.2 1.1 1.9 2.6 1.9 2-.6 2.5-1.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )
    case 'spark':
      return (
        <path
          d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      )
    case 'cube':
      return (
        <path
          d="M12 4l7 4v8l-7 4-7-4V8l7-4zM12 12l7-4M12 12v8M12 12L5 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      )
    case 'nova':
      return (
        <path
          d="M12 5l1.2 4.3L17.5 9l-3.4 2.8L15.2 17 12 14.4 8.8 17l1.1-5.2L6.5 9l4.3-.7L12 5z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      )
    case 'pixel':
      return (
        <>
          <rect x="5" y="5" width="5" height="5" fill="currentColor" opacity="0.9" />
          <rect x="14" y="5" width="5" height="5" fill="currentColor" opacity="0.55" />
          <rect x="5" y="14" width="5" height="5" fill="currentColor" opacity="0.55" />
          <rect x="14" y="14" width="5" height="5" fill="currentColor" opacity="0.9" />
        </>
      )
    case 'arrow':
      return (
        <path
          d="M12 4v16M12 4l-5 5M12 4l5 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    case 'hex':
      return (
        <path
          d="M12 3.5l6.5 3.8v7.4L12 18.5l-6.5-3.8V7.3L12 3.5z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      )
    case 'glow':
      return (
        <>
          <circle cx="12" cy="12" r="3" fill="currentColor" />
          <circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
        </>
      )
    case 'disc':
      return (
        <>
          <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
          <path d="M12 4.5v3M12 16.5v3M4.5 12h3M16.5 12h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )
    case 'beam':
      return (
        <path
          d="M5 19L12 5l7 14H5z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      )
    case 'core':
      return (
        <>
          <rect x="6" y="6" width="12" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" />
        </>
      )
    case 'flare':
      return (
        <path
          d="M12 3c2 4.5 5.5 7 9 7-3.5 0-7 2.5-9 7-2-4.5-5.5-7-9-7 3.5 0 7-2.5 9-7z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      )
  }
}

export function PlayerAvatar({
  avatarId,
  name = '',
  size = 'md',
  className = '',
}: PlayerAvatarProps) {
  const id = resolveAvatarId(avatarId, name)
  const dim = size === 'sm' ? '1.2rem' : size === 'lg' ? '2.1rem' : '1.45rem'
  const style = { '--avatar-size': dim } as CSSProperties
  return (
    <span
      className={`player-avatar player-avatar--${size}${className ? ` ${className}` : ''}`}
      style={style}
      aria-hidden="true"
      data-avatar={id}
    >
      <svg viewBox="0 0 24 24" fill="none">
        {glyph(id)}
      </svg>
    </span>
  )
}
