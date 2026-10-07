import { useId } from 'react'
import { FROST, seeded } from '../../lib/seasonArt'
import { ICE_BREAKER } from '../../lib/skinArt'
import { ArtShapes } from './SeasonArt'

/*
 * Season 2's pictures (Cold Snap, Northern Lights: Ramsey picked A, 2026-10-06): the patch every level is shown
 * on, aurora over snowy peaks behind a level's number, and the banner's scene of the Ice Breaker coming down
 * over a frozen lake under the northern lights, a cabin with its light on. In the season's own colours, so they
 * look the same on a light page or a dark one, as Space Race's do (SeasonArt.tsx).
 */

/** The level badge: an embroidered patch, its ring aurora green, the lights and a snowy ridge on it, the level (or "S2"). */
export function FrostPatch({ label, size, className }: { label?: string; size: number; className?: string }) {
  const long = (label?.length ?? 0) > 1
  const id = `fp${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <circle cx="50" cy="50" r="38" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="48" fill={FROST.night} />
      <circle cx="50" cy="50" r="43" fill="none" stroke={FROST.green} strokeWidth="7" />
      <circle cx="50" cy="50" r="43" fill="none" stroke="#eafff6" strokeWidth="1.3" strokeDasharray="2 3" />
      <circle cx="50" cy="50" r="38" fill={FROST.panel} />
      <g clipPath={`url(#${id})`}>
        <path d="M10 44C28 28 50 50 90 32" stroke={FROST.green} strokeWidth="7" fill="none" opacity="0.5" />
        <path d="M10 54C32 42 56 60 90 44" stroke={FROST.violet} strokeWidth="6" fill="none" opacity="0.4" />
        <path d="M10 70L30 56L42 64L56 50L70 62L90 56V100H10Z" fill={FROST.snow} />
        <path d="M30 56L26 60L31 59ZM56 50L51 55L57 54Z" fill={FROST.ice} />
      </g>
      <circle cx="30" cy="27" r="1.4" fill="#ffffff" />
      <circle cx="68" cy="22" r="1.2" fill="#ffffff" />
      {label ? (
        <text
          x="50"
          y={long ? 61 : 63}
          textAnchor="middle"
          fontFamily="'Russo One', Outfit, sans-serif"
          fontSize={long ? 30 : 36}
          fill="#ffffff"
          stroke={FROST.night}
          strokeWidth="3"
          paintOrder="stroke"
        >
          {label}
        </text>
      ) : (
        <g transform="translate(25 22) scale(0.5)">
          <ArtShapes shapes={ICE_BREAKER.body} />
        </g>
      )}
    </svg>
  )
}

/** The season banner's picture: the Ice Breaker coming down over a frozen lake under the northern lights. */
export function AuroraScene({ seed = 11 }: { seed?: number }) {
  const id = `as${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const r = seeded(seed)
  const stars: { x: number; y: number; r: number; o: number }[] = []
  for (let i = 0; i < 60; i++) stars.push({ x: r() * 614, y: r() * 170, r: 0.5 + r() * 1.2, o: 0.3 + r() * 0.6 })
  return (
    <svg width="100%" height="100%" viewBox="0 0 614 329" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#081226" />
          <stop offset="1" stopColor="#16325a" />
        </linearGradient>
        <filter id={`${id}blur`} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <linearGradient id={`${id}lake`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b3a63" />
          <stop offset="1" stopColor={FROST.night} />
        </linearGradient>
      </defs>
      <rect width="614" height="329" fill={`url(#${id}sky)`} />
      {stars.map((s, i) => (
        <circle key={i} cx={s.x.toFixed(0)} cy={s.y.toFixed(0)} r={s.r.toFixed(1)} fill={FROST.snow} opacity={s.o.toFixed(2)} />
      ))}
      <g filter={`url(#${id}blur)`} opacity="0.9" fill="none">
        <path d="M-30 120C70 40 170 150 300 70S520 20 650 96" stroke={FROST.green} strokeWidth="34" opacity="0.55" />
        <path d="M-30 150C90 90 200 170 330 110S540 70 650 130" stroke={FROST.teal} strokeWidth="24" opacity="0.45" />
        <path d="M-30 90C80 20 200 110 320 40S540 0 650 60" stroke={FROST.violet} strokeWidth="22" opacity="0.4" />
      </g>
      <path d="M-30 120C70 40 170 150 300 70S520 20 650 96" stroke="#c8ffe8" strokeWidth="2" fill="none" opacity="0.6" />
      <path d="M0 214L70 160L120 190L190 128L260 186L330 140L410 196L480 150L560 186L614 160V250H0Z" fill="#1d3a63" />
      <path d="M190 128L170 146L186 144L196 152L206 140ZM330 140L314 154L328 152L338 160L348 150ZM480 150L466 162L480 160L490 166L498 158Z" fill={FROST.snow} opacity="0.9" />
      <path d="M0 236L60 206L130 226L210 196L290 222L380 200L460 224L540 204L614 220V260H0Z" fill={FROST.line} />
      <rect y="246" width="614" height="83" fill={`url(#${id}lake)`} />
      <path d="M40 268H210M260 284H420M120 300H300M440 266H580" stroke={FROST.green} strokeWidth="2" opacity="0.35" strokeLinecap="round" />
      <path d="M90 276H170M300 296H380" stroke={FROST.violet} strokeWidth="2" opacity="0.3" strokeLinecap="round" />
      <g fill={FROST.night}>
        <path d="M24 248L36 212L48 248Z" />
        <path d="M44 250L58 202L72 250Z" />
        <path d="M520 250L534 206L548 250Z" />
        <path d="M546 248L558 218L570 248Z" />
      </g>
      <g transform="translate(86 222)">
        <path d="M0 26V8L16 -4L32 8V26Z" fill="#3a2a22" />
        <path d="M-4 9L16 -7L36 9" stroke={FROST.snow} strokeWidth="5" fill="none" strokeLinejoin="round" />
        <rect x="10" y="12" width="12" height="9" fill={FROST.amber} />
        <path d="M26 -2V-14" stroke="#3a2a22" strokeWidth="5" />
        <path d="M26 -18C22 -26 34 -30 30 -40" stroke={FROST.muted} strokeWidth="3" fill="none" opacity="0.5" strokeLinecap="round" />
      </g>
      <path d="M100 248L132 248" stroke={FROST.amber} strokeWidth="2" opacity="0.4" />
      <g transform="translate(262 70) scale(1.25)">
        <ArtShapes shapes={ICE_BREAKER.flame} />
        <ArtShapes shapes={ICE_BREAKER.body} />
      </g>
      <path d="M326 186C330 210 322 228 330 246" stroke={FROST.teal} strokeWidth="2" strokeDasharray="2 6" fill="none" opacity="0.6" />
    </svg>
  )
}
