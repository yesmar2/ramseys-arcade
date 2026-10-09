import { useId } from 'react'

/*
 * Blip, the site's mascot (Ramsey, 2026-10-09: "i like the idea of having blip be the 'mascot' of the site"):
 * Wobble Run's runner as GameArt.tsx draws it, round and mint with his spark floating over his head, here on
 * his own for the pages. `mood` 'happy' closes his eyes in a grin (an answer given); `wave` lifts an arm.
 */

const BODY = '#34c6a8'
const SHADE = '#1f9b84'
const FEET = '#167a69'
const GLOW = '#9ff7e2'
const INK = '#0f2f2a'

export function BlipFigure({
  mood = 'hi',
  wave = false,
  className,
  size,
}: {
  mood?: 'hi' | 'happy'
  wave?: boolean
  className?: string
  /** Its height in px; else the stylesheet's. */
  size?: number
}) {
  const glow = `blip-glow-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <svg
      className={className}
      viewBox="-11 -12 22 23"
      width={size ? (size * 22) / 23 : undefined}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={glow}>
          <stop offset="0" stopColor={GLOW} stopOpacity="0.9" />
          <stop offset="1" stopColor={GLOW} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="0" cy="-7.98" r="2.7" fill={`url(#${glow})`} />
      <circle cx="0" cy="-7.98" r="0.85" fill="#f2fffb" />
      <ellipse cx="-2.31" cy="8.82" rx="1.79" ry="0.95" fill={FEET} />
      <ellipse cx="2.31" cy="8.82" rx="1.79" ry="0.95" fill={FEET} />
      {wave ? <ellipse className="blip-figure__arm" cx="-6.3" cy="-1.9" rx="1.25" ry="2.4" fill={BODY} transform="rotate(-35 -6.3 -1.9)" /> : null}
      <circle cx="0" cy="1.26" r="7.35" fill={BODY} />
      <path d="M-5.88 4.2 A7.35 7.35 0 0 0 5.88 4.2 A8.4 6.3 0 0 1 -5.88 4.2 Z" fill={SHADE} />
      <ellipse cx="-2.52" cy="-2.94" rx="2.52" ry="1.26" fill="#fff" opacity="0.35" transform="rotate(-24 -2.52 -2.94)" />
      {mood === 'happy' ? (
        <>
          <path d="M-2.9 1.1 Q-1.9 -0.2 -0.9 1.1" fill="none" stroke={INK} strokeWidth="0.55" strokeLinecap="round" />
          <path d="M0.9 1.1 Q1.9 -0.2 2.9 1.1" fill="none" stroke={INK} strokeWidth="0.55" strokeLinecap="round" />
          <path d="M-1.6 3.4 Q0 5.3 1.6 3.4 Z" fill={INK} />
        </>
      ) : (
        <>
          <ellipse cx="-1.89" cy="1.05" rx="0.95" ry="1.58" fill={INK} />
          <ellipse cx="1.89" cy="1.05" rx="0.95" ry="1.58" fill={INK} />
          <circle cx="-1.58" cy="0.32" r="0.36" fill="#fff" />
          <circle cx="2.2" cy="0.32" r="0.36" fill="#fff" />
          <path d="M-1.26 3.57 Q0 4.73 1.26 3.57" fill="none" stroke={INK} strokeWidth="0.47" strokeLinecap="round" />
        </>
      )}
      <ellipse cx="-3.57" cy="3.15" rx="0.95" ry="0.53" fill="#ff8fb3" opacity={mood === 'happy' ? 0.85 : 0.7} />
      <ellipse cx="3.57" cy="3.15" rx="0.95" ry="0.53" fill="#ff8fb3" opacity={mood === 'happy' ? 0.85 : 0.7} />
    </svg>
  )
}
