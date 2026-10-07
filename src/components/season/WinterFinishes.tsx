import { BADGE_ART } from '../../lib/avatarArt'

/*
 * Season 2's finishes (Cold Snap): its pass gives a snowflake on a winter night, an igloo lit from inside, a
 * snowman's face and a blizzard at the top; its Pass+ a polar bear, diamond dust round a winter sun and a
 * crown of ice. Drawn on the badge's 64-unit stage like Season 1's (PlayerAvatar's SeasonSurface): each keeps
 * the middle clear for the monogram or the emblem, and stays inside the badge's edge.
 */

export const WINTER_FINISHES = ['snowflake', 'igloo', 'snowman', 'blizzard', 'polar-bear', 'diamond-dust', 'ice-crown'] as const
export type WinterFinish = (typeof WINTER_FINISHES)[number]

export function isWinterFinish(badge: string): badge is WinterFinish {
  return (WINTER_FINISHES as readonly string[]).includes(badge)
}

/** The rim's light round the face. */
export function winterRim(badge: WinterFinish): string {
  switch (badge) {
    case 'snowflake':
      return 'rgba(191,230,255,0.4)'
    case 'igloo':
      return 'rgba(255,255,255,0.45)'
    case 'snowman':
      return 'rgba(20,40,77,0.18)'
    case 'blizzard':
      return 'rgba(220,240,255,0.45)'
    case 'polar-bear':
      return 'rgba(20,40,77,0.16)'
    case 'diamond-dust':
      return 'rgba(255,255,255,0.6)'
    case 'ice-crown':
      return 'rgba(127,227,255,0.45)'
  }
}

/** The monogram's letter and the line under it. */
export function winterInks(badge: WinterFinish): { pattern: string; letter: string; line: string } {
  switch (badge) {
    case 'snowflake':
      return { pattern: '', letter: '#ffffff', line: '#9fe3ff' }
    case 'igloo':
      return { pattern: '', letter: '#14284d', line: '#4aa8e8' }
    case 'snowman':
      return { pattern: '', letter: '#14284d', line: '#e8564f' }
    case 'blizzard':
      return { pattern: '', letter: '#ffffff', line: '#bfe6ff' }
    case 'polar-bear':
      return { pattern: '', letter: '#1a2b3c', line: '#1a2b3c' }
    case 'diamond-dust':
      return { pattern: '', letter: '#14284d', line: '#ffffff' }
    case 'ice-crown':
      return { pattern: '', letter: '#ffffff', line: '#7fe3ff' }
  }
}

const f = (v: number) => v.toFixed(2)

/** A six-armed snowflake's strokes round cx, cy, r long, each arm with a pair of side branches. */
export function flakeStrokes(cx: number, cy: number, r: number, turn = 0): string {
  let d = ''
  for (let i = 0; i < 6; i++) {
    const a = ((i * 60 + turn - 90) * Math.PI) / 180
    d += `M${f(cx)} ${f(cy)}L${f(cx + Math.cos(a) * r)} ${f(cy + Math.sin(a) * r)}`
    for (const t of [0.42, 0.68]) {
      const bx = cx + Math.cos(a) * r * t
      const by = cy + Math.sin(a) * r * t
      const len = r * (t < 0.5 ? 0.3 : 0.22)
      for (const s of [-1, 1]) {
        const b = a + (s * Math.PI) / 3.4
        d += `M${f(bx)} ${f(by)}L${f(bx + Math.cos(b) * len)} ${f(by + Math.sin(b) * len)}`
      }
    }
  }
  return d
}

/** A four-point glint. */
function glint(cx: number, cy: number, s: number) {
  return `M${cx} ${cy - s}Q${cx} ${cy} ${cx + s} ${cy}Q${cx} ${cy} ${cx} ${cy + s}Q${cx} ${cy} ${cx - s} ${cy}Q${cx} ${cy} ${cx} ${cy - s}Z`
}

const FLAKE_DOTS: [number, number, number][] = [
  [12, 22, 0.9],
  [20, 11.5, 0.7],
  [46, 10.5, 0.8],
  [54, 22, 0.6],
  [9, 42, 0.7],
  [55, 47, 0.9],
  [18, 55, 0.6],
  [44, 58, 0.7],
]

/** The blizzard's whirl: arcs round the middle, longer and fainter out to the edge. */
const BLIZZARD_ARCS: { d: string; w: number; o: number }[] = (() => {
  const arcs: { d: string; w: number; o: number }[] = []
  const rings = [
    [12, 20, 120, 2.2, 0.9],
    [15, 170, 300, 1.8, 0.75],
    [19, 60, 200, 2, 0.6],
    [22, 230, 380, 1.6, 0.55],
    [25, 110, 230, 1.4, 0.45],
    [26.5, 300, 420, 1.2, 0.4],
  ] as const
  for (const [r, a0, a1, w, o] of rings) {
    const p = (deg: number, rr: number) => [32 + Math.cos((deg * Math.PI) / 180) * rr, 34 + Math.sin((deg * Math.PI) / 180) * rr] as const
    // A spiral: the radius shrinks a little along the arc, so it reads as wind going round.
    const steps = 8
    let d = ''
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const [x, y] = p(a0 + (a1 - a0) * t, r - 3 * t)
      d += `${i ? 'L' : 'M'}${f(x)} ${f(y)}`
    }
    arcs.push({ d, w, o })
  }
  return arcs
})()

/** The ice crown: spikes of frost from the edge in, all the way round, longest at the top. */
const CROWN_SPIKES: string = (() => {
  let d = ''
  const n = 16
  for (let i = 0; i < n; i++) {
    const deg = (i * 360) / n - 90
    const a = (deg * Math.PI) / 180
    const len = 6 + 5 * Math.max(0, -Math.sin(a))
    const half = 0.12
    const r = 27.6
    const x1 = 32 + Math.cos(a - half) * r
    const y1 = 34 + Math.sin(a - half) * r
    const x2 = 32 + Math.cos(a + half) * r
    const y2 = 34 + Math.sin(a + half) * r
    const tx = 32 + Math.cos(a) * (r - len)
    const ty = 34 + Math.sin(a) * (r - len)
    d += `M${f(x1)} ${f(y1)}L${f(tx)} ${f(ty)}L${f(x2)} ${f(y2)}Z`
  }
  return d
})()

export function WinterSurface({ badge, uid }: { badge: WinterFinish; uid: string }) {
  const clip = (
    <clipPath id={`${uid}disc`}>
      <path d={BADGE_ART.disc} />
    </clipPath>
  )
  switch (badge) {
    case 'snowflake':
      return (
        <>
          <defs>
            <radialGradient id={`${uid}night`} cx="0.45" cy="0.35" r="0.8">
              <stop offset="0" stopColor="#2a5a94" />
              <stop offset="0.6" stopColor="#163463" />
              <stop offset="1" stopColor="#0b1830" />
            </radialGradient>
            {clip}
          </defs>
          <path d={BADGE_ART.disc} fill={`url(#${uid}night)`} />
          <g clipPath={`url(#${uid}disc)`}>
            <path d={flakeStrokes(32, 34, 25, 8)} fill="none" stroke="#dff2ff" strokeWidth="2" strokeLinecap="round" opacity="0.32" />
          </g>
          {FLAKE_DOTS.map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#ffffff" opacity="0.85" />
          ))}
          <path d={flakeStrokes(50, 15.5, 4.2)} fill="none" stroke="#ffffff" strokeWidth="0.9" strokeLinecap="round" />
        </>
      )
    case 'igloo':
      return (
        <>
          <defs>
            <linearGradient id={`${uid}dusk`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3a6fb0" />
              <stop offset="0.55" stopColor="#8fc4ec" />
              <stop offset="1" stopColor="#dff2ff" />
            </linearGradient>
            {clip}
          </defs>
          <path d={BADGE_ART.disc} fill={`url(#${uid}dusk)`} />
          <g clipPath={`url(#${uid}disc)`}>
            <path d="M3 52Q32 46 61 52V64H3Z" fill="#ffffff" />
            <path d="M7 52A25 25 0 0 1 57 52Z" fill="#f4faff" />
            <path
              d="M8.5 44H55.5M11.5 36H52.5M16.5 28.5H47.5M22 22.5H42M20 52V44M32 52V44M44 52V44M14 44V36M26 44V36M38 44V36M50 44V36M20 36V28.5M32 36V28.5M44 36V28.5M26 28.5V22.5M38 28.5V22.5"
              fill="none"
              stroke="#a9cbe6"
              strokeWidth="0.8"
            />
            <path d="M44 52V47A4.5 4.5 0 0 1 53 47V52Z" fill="#f5b942" />
            <path d="M45.5 52V47.5A3 3 0 0 1 51.5 47.5V52Z" fill="#ffd27a" />
          </g>
          <circle cx="15" cy="15" r="0.8" fill="#ffffff" opacity="0.8" />
          <circle cx="49" cy="12" r="0.7" fill="#ffffff" opacity="0.7" />
        </>
      )
    case 'snowman':
      return (
        <>
          <defs>
            <radialGradient id={`${uid}snow`} cx="0.38" cy="0.3" r="0.8">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.7" stopColor="#eef6fc" />
              <stop offset="1" stopColor="#c8e0f2" />
            </radialGradient>
            {clip}
          </defs>
          <path d={BADGE_ART.disc} fill={`url(#${uid}snow)`} />
          <circle cx="23" cy="17" r="2.3" fill="#1d2430" />
          <circle cx="41" cy="17" r="2.3" fill="#1d2430" />
          <circle cx="22.4" cy="16.4" r="0.7" fill="#ffffff" />
          <circle cx="40.4" cy="16.4" r="0.7" fill="#ffffff" />
          <path d="M48 24L60 26.2L48 28Z" fill="#f2813a" />
          <path d="M51 24.6L51.6 27.4M54 25.2L54.4 26.8" stroke="#c45a14" strokeWidth="0.6" />
          <circle cx="13" cy="27" r="3" fill="#ffb3b8" opacity="0.6" />
          <g clipPath={`url(#${uid}disc)`}>
            <path d="M2 52Q32 46 62 52V60Q32 54 2 60Z" fill="#e8564f" />
            <path d="M8 51.5V58.5M16 50.3V57.3M24 49.6V56.6M32 49.4V56.4M40 49.6V56.6M48 50.3V57.3M56 51.5V58.5" stroke="#ffffff" strokeWidth="2.4" opacity="0.85" />
          </g>
        </>
      )
    case 'blizzard':
      return (
        <>
          <defs>
            <radialGradient id={`${uid}eye`} cx="0.5" cy="0.5" r="0.6">
              <stop offset="0" stopColor="#bfe6ff" />
              <stop offset="0.35" stopColor="#4a86c8" />
              <stop offset="0.8" stopColor="#1d3f6e" />
              <stop offset="1" stopColor="#0b1830" />
            </radialGradient>
            {clip}
          </defs>
          <path d={BADGE_ART.disc} fill={`url(#${uid}eye)`} />
          <g clipPath={`url(#${uid}disc)`} fill="none" strokeLinecap="round">
            {BLIZZARD_ARCS.map((a) => (
              <path key={a.d} d={a.d} stroke="#ffffff" strokeWidth={a.w} opacity={a.o} />
            ))}
          </g>
          {[
            [10, 26, 1.2],
            [16, 12, 0.9],
            [50, 10, 1.1],
            [57, 32, 0.9],
            [52, 54, 1.2],
            [12, 50, 1],
            [30, 60, 0.8],
          ].map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#ffffff" />
          ))}
          <path d={flakeStrokes(15, 19, 3.6)} fill="none" stroke="#ffffff" strokeWidth="0.8" strokeLinecap="round" />
          <path d={flakeStrokes(51, 47, 3)} fill="none" stroke="#ffffff" strokeWidth="0.8" strokeLinecap="round" />
        </>
      )
    case 'polar-bear':
      return (
        <>
          <defs>
            <radialGradient id={`${uid}fur`} cx="0.42" cy="0.35" r="0.8">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.75" stopColor="#f2f5f7" />
              <stop offset="1" stopColor="#d6dee6" />
            </radialGradient>
            {clip}
          </defs>
          <path d={BADGE_ART.disc} fill={`url(#${uid}fur)`} />
          <circle cx="13" cy="15" r="6.2" fill="#e6ecf1" />
          <circle cx="13" cy="15" r="3.4" fill="#c7d2dc" />
          <circle cx="51" cy="15" r="6.2" fill="#e6ecf1" />
          <circle cx="51" cy="15" r="3.4" fill="#c7d2dc" />
          <circle cx="21" cy="22" r="1.9" fill="#1d2430" />
          <circle cx="43" cy="22" r="1.9" fill="#1d2430" />
          <path d="M26 53.5C26 51 38 51 38 53.5C38 56.5 34 58.5 32 58.5C30 58.5 26 56.5 26 53.5Z" fill="#1d2430" />
          <ellipse cx="30" cy="53" rx="1.6" ry="0.8" fill="#ffffff" opacity="0.6" />
        </>
      )
    case 'diamond-dust':
      return (
        <>
          <defs>
            <radialGradient id={`${uid}cold`} cx="0.5" cy="0.28" r="0.85">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.25" stopColor="#e6f6ff" />
              <stop offset="0.7" stopColor="#9fd4f7" />
              <stop offset="1" stopColor="#5aa7e0" />
            </radialGradient>
            <radialGradient id={`${uid}sun`}>
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.4" stopColor="#fff7d6" stopOpacity="0.9" />
              <stop offset="1" stopColor="#fff7d6" stopOpacity="0" />
            </radialGradient>
            {clip}
          </defs>
          <path d={BADGE_ART.disc} fill={`url(#${uid}cold)`} />
          <g clipPath={`url(#${uid}disc)`}>
            <circle cx="32" cy="13" r="18" fill="none" stroke="#ffffff" strokeWidth="1.6" opacity="0.75" />
            <circle cx="32" cy="13" r="18" fill="none" stroke="#ffd9a8" strokeWidth="0.6" opacity="0.7" />
            <circle cx="32" cy="13" r="6" fill={`url(#${uid}sun)`} />
          </g>
          <path d={glint(14, 13, 2.2)} fill="#ffffff" />
          <path d={glint(50, 13, 2.2)} fill="#ffffff" />
          {[
            [10, 34, 1.4],
            [18, 50, 1.1],
            [54, 38, 1.5],
            [46, 55, 1.1],
            [32, 60, 0.9],
            [24, 6.5, 0.8],
          ].map(([x, y, s]) => (
            <path key={`${x}-${y}`} d={glint(x, y, s)} fill="#ffffff" />
          ))}
        </>
      )
    case 'ice-crown':
      return (
        <>
          <defs>
            <radialGradient id={`${uid}deep`} cx="0.5" cy="0.45" r="0.6">
              <stop offset="0" stopColor="#2a4f9a" />
              <stop offset="0.7" stopColor="#1b2a66" />
              <stop offset="1" stopColor="#0e1440" />
            </radialGradient>
            <linearGradient id={`${uid}ice`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="#7fe3ff" />
            </linearGradient>
            {clip}
          </defs>
          <path d={BADGE_ART.disc} fill={`url(#${uid}deep)`} />
          <g clipPath={`url(#${uid}disc)`}>
            <path d={CROWN_SPIKES} fill={`url(#${uid}ice)`} opacity="0.92" />
          </g>
          <circle cx="32" cy="34" r="26.6" fill="none" stroke="#bff3ff" strokeWidth="1.2" opacity="0.8" />
          <path d={glint(32, 10, 2.6)} fill="#ffffff" />
          <path d={glint(16, 15.5, 1.6)} fill="#e86bd0" />
          <path d={glint(48, 15.5, 1.6)} fill="#e86bd0" />
        </>
      )
  }
}
