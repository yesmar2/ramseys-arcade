import type { CSSProperties } from 'react'
import { getGame } from '../data/games'
import { BADGE_ART, EMBLEM_ART, PATTERN_ART, PIN_AT, PIN_DISC, PIN_EDGE, PIN_GLYPHS, RING_ART, type ArtRole } from '../lib/avatarArt'
import { avatarColor, isGamePin, monogramText, resolveAvatar, type Avatar, type AvatarPin } from '../lib/avatars'
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
 */

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
    rim: avatar.badge === 'paper' ? 'rgba(18,28,38,0.14)' : 'rgba(255,255,255,0.12)',
  }
}

function badgeFill(avatar: Avatar): string {
  const body = avatarColor(avatar.body)
  switch (avatar.badge) {
    case 'bold':
      return avatar.kind === 'mono' ? body : mixColor(avatarColor(avatar.detail), NAVY, 0.18)
    case 'deep':
      return mixColor(body, NAVY, 0.6)
    case 'night':
      return '#101923'
    case 'paper':
      return '#f4efe6'
  }
}

function monoInks(avatar: Avatar): { pattern: string; letter: string } {
  const body = avatarColor(avatar.body)
  switch (avatar.badge) {
    case 'bold':
      return { pattern: mixColor(body, NAVY, 0.2), letter: inkOn(body, INK) }
    case 'deep':
      return { pattern: mixColor(body, NAVY, 0.5), letter: body }
    case 'night':
      return { pattern: '#18232f', letter: body }
    case 'paper':
      return { pattern: '#e9e1d3', letter: mixColor(body, NAVY, 0.18) }
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
  const ring = avatar.ring ? RING_ART[avatar.ring] : null
  const rim = avatar.badge === 'paper' ? 'rgba(18,28,38,0.14)' : 'rgba(255,255,255,0.14)'
  return (
    <>
      {ring?.map((p, i) => <path key={`r${i}`} d={p.d} fill={p.fill} />)}
      <path d={BADGE_ART.disc} fill={badgeFill(avatar)} />
      {avatar.kind === 'mono' ? (
        <MonoFace avatar={avatar} name={name} rim={rim} />
      ) : (
        <EmblemFace avatar={avatar} />
      )}
      {avatar.pin ? <Pin pin={avatar.pin} /> : null}
    </>
  )
}

function MonoFace({ avatar, name, rim }: { avatar: Extract<Avatar, { kind: 'mono' }>; name: string; rim: string }) {
  const inks = monoInks(avatar)
  const pattern = PATTERN_ART[avatar.pattern]
  const text = monogramText(name, avatar.letters)
  const two = text.length > 1
  return (
    <>
      {pattern ? <path d={pattern} fill={inks.pattern} /> : null}
      <path d={BADGE_ART.rim} fill={rim} />
      <path d={two ? BADGE_ART.line2 : BADGE_ART.line1} fill={avatarColor(avatar.detail)} />
      <text
        className="player-avatar__letters"
        x="32"
        y={two ? 42.4 : 44.6}
        textAnchor="middle"
        fontSize={two ? 22 : 30}
        fill={inks.letter}
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
