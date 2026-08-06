import type { JSX } from 'react'

/** Project world (x,y,z) → screen like Stacker’s renderer. */
function p(x: number, y: number, z: number, cx: number, cy: number) {
  return {
    x: cx + (x - z) * 0.9,
    y: cy + (x + z) * 0.5 - y,
  }
}

function pts(...points: { x: number; y: number }[]) {
  return points.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ')
}

function IsoSlab({
  cx,
  cy,
  x = 0,
  z = 0,
  w,
  d,
  h,
  hue,
}: {
  cx: number
  cy: number
  x?: number
  z?: number
  w: number
  d: number
  h: number
  hue: number
}) {
  const hw = w / 2
  const hd = d / 2
  const top = [
    p(x - hw, h, z - hd, cx, cy),
    p(x + hw, h, z - hd, cx, cy),
    p(x + hw, h, z + hd, cx, cy),
    p(x - hw, h, z + hd, cx, cy),
  ]
  const midR = [
    p(x + hw, h, z - hd, cx, cy),
    p(x + hw, h, z + hd, cx, cy),
    p(x + hw, 0, z + hd, cx, cy),
    p(x + hw, 0, z - hd, cx, cy),
  ]
  const midL = [
    p(x - hw, h, z + hd, cx, cy),
    p(x + hw, h, z + hd, cx, cy),
    p(x + hw, 0, z + hd, cx, cy),
    p(x - hw, 0, z + hd, cx, cy),
  ]

  return (
    <g>
      <polygon points={pts(...midR)} fill={`hsla(${hue}, 58%, 52%, 1)`} />
      <polygon points={pts(...midL)} fill={`hsla(${hue}, 58%, 42%, 1)`} />
      <polygon points={pts(...top)} fill={`hsla(${hue}, 58%, 68%, 1)`} />
      <polygon
        points={pts(...top)}
        fill="none"
        stroke={`hsla(${hue}, 30%, 90%, 0.4)`}
        strokeWidth="1.2"
      />
    </g>
  )
}

export function StackerArt() {
  // Match in-game hues: hueFor(i) = (178 + i * 22) % 360
  const baseCy = 78
  const cx = 80

  return (
    <svg
      className="game-tile__art-svg"
      viewBox="0 0 160 96"
      fill="none"
      aria-hidden="true"
    >
      <rect width="160" height="96" rx="14" fill="#edf7f4" />
      <circle cx="22" cy="18" r="1.4" fill="rgba(74,168,232,0.3)" />
      <circle cx="140" cy="22" r="1.4" fill="rgba(46,184,160,0.28)" />
      <circle cx="128" cy="40" r="1.4" fill="rgba(74,168,232,0.22)" />

      {/* Soft ground shadow */}
      <ellipse cx="80" cy="84" rx="48" ry="8" fill="rgba(26,43,60,0.08)" />

      {/* Stacked isometric slabs */}
      <g transform={`translate(0, ${-0 * 12})`}>
        <IsoSlab cx={cx} cy={baseCy} w={56} d={56} h={12} hue={178} />
      </g>
      <g transform="translate(0, -12)">
        <IsoSlab cx={cx} cy={baseCy} w={48} d={48} h={12} hue={200} />
      </g>
      <g transform="translate(0, -24)">
        <IsoSlab cx={cx} cy={baseCy} w={40} d={40} h={12} hue={222} />
      </g>
      {/* Moving piece offset on x */}
      <g transform="translate(0, -36)">
        <IsoSlab cx={cx} cy={baseCy} x={18} w={40} d={40} h={12} hue={42} />
      </g>
    </svg>
  )
}

export function PatriotArt() {
  return (
    <svg
      className="game-tile__art-svg"
      viewBox="0 0 160 96"
      fill="none"
      aria-hidden="true"
    >
      <rect width="160" height="96" rx="14" fill="#edf7f4" />
      <circle cx="24" cy="20" r="1.4" fill="rgba(74,168,232,0.35)" />
      <circle cx="140" cy="16" r="1.4" fill="rgba(74,168,232,0.3)" />
      <circle cx="118" cy="28" r="1.4" fill="rgba(46,184,160,0.28)" />

      <rect x="0" y="78" width="160" height="18" fill="#cfe8d8" />
      <rect x="0" y="78" width="160" height="2.5" fill="rgba(46,184,160,0.45)" />

      <rect x="14" y="54" width="28" height="24" rx="4" fill="#4aa8e8" />
      <path d="M12 56 L28 42 L44 56 Z" fill="#4aa8e8" />
      <rect x="18" y="62" width="7" height="7" rx="1.5" fill="rgba(255,255,255,0.5)" />
      <rect x="31" y="62" width="7" height="7" rx="1.5" fill="rgba(255,255,255,0.5)" />

      <rect x="118" y="52" width="28" height="26" rx="4" fill="#2eb8a0" />
      <path d="M116 54 L132 38 L148 54 Z" fill="#2eb8a0" />
      <rect x="122" y="62" width="7" height="7" rx="1.5" fill="rgba(255,255,255,0.5)" />
      <rect x="135" y="62" width="7" height="7" rx="1.5" fill="rgba(255,255,255,0.5)" />

      <rect x="68" y="64" width="26" height="14" rx="4" fill="#4aa8e8" />
      <rect x="75" y="50" width="12" height="16" rx="3" fill="#2eb8a0" />
      <rect x="77" y="52" width="8" height="4" rx="1.5" fill="rgba(255,255,255,0.3)" />

      <line
        x1="118"
        y1="8"
        x2="92"
        y2="42"
        stroke="rgba(232,93,117,0.4)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="92" cy="42" r="3.2" fill="#e85d75" />

      <circle cx="64" cy="28" r="14" fill="rgba(245,185,66,0.28)" stroke="#2eb8a0" strokeWidth="1.5" />
      <circle cx="64" cy="28" r="5" fill="rgba(245,185,66,0.45)" />

      <circle cx="64" cy="28" r="7" stroke="rgba(26,43,60,0.4)" strokeWidth="1.4" />
      <line x1="54" y1="28" x2="74" y2="28" stroke="rgba(26,43,60,0.4)" strokeWidth="1.4" />
      <line x1="64" y1="18" x2="64" y2="38" stroke="rgba(26,43,60,0.4)" strokeWidth="1.4" />
    </svg>
  )
}

export function SnakeArt() {
  return (
    <svg
      className="game-tile__art-svg"
      viewBox="0 0 160 96"
      fill="none"
      aria-hidden="true"
    >
      <rect width="160" height="96" rx="14" fill="#edf7f4" />
      <circle cx="22" cy="18" r="1.4" fill="rgba(74,168,232,0.3)" />
      <circle cx="138" cy="22" r="1.4" fill="rgba(46,184,160,0.28)" />
      <circle cx="120" cy="40" r="1.4" fill="rgba(74,168,232,0.22)" />

      <rect x="18" y="16" width="124" height="64" rx="12" fill="rgba(255,255,255,0.55)" />
      <rect
        x="18"
        y="16"
        width="124"
        height="64"
        rx="12"
        stroke="rgba(26,43,60,0.06)"
        strokeWidth="1"
      />

      {/* Soft grid dots */}
      <circle cx="40" cy="32" r="1.2" fill="rgba(46,184,160,0.18)" />
      <circle cx="56" cy="32" r="1.2" fill="rgba(46,184,160,0.18)" />
      <circle cx="72" cy="32" r="1.2" fill="rgba(46,184,160,0.18)" />
      <circle cx="88" cy="32" r="1.2" fill="rgba(46,184,160,0.18)" />
      <circle cx="40" cy="48" r="1.2" fill="rgba(46,184,160,0.18)" />
      <circle cx="56" cy="48" r="1.2" fill="rgba(46,184,160,0.18)" />
      <circle cx="72" cy="48" r="1.2" fill="rgba(46,184,160,0.18)" />
      <circle cx="88" cy="48" r="1.2" fill="rgba(46,184,160,0.18)" />
      <circle cx="104" cy="48" r="1.2" fill="rgba(46,184,160,0.18)" />
      <circle cx="120" cy="48" r="1.2" fill="rgba(46,184,160,0.18)" />

      {/* Snake body */}
      <rect x="34" y="40" width="14" height="14" rx="4" fill="#2eb8a0" />
      <rect x="48" y="40" width="14" height="14" rx="4" fill="#3ecf8e" />
      <rect x="62" y="40" width="14" height="14" rx="4" fill="#2eb8a0" />
      <rect x="76" y="40" width="14" height="14" rx="4" fill="#3ecf8e" />
      <rect x="90" y="40" width="14" height="14" rx="4" fill="#2eb8a0" />
      {/* Head */}
      <rect x="104" y="40" width="16" height="14" rx="5" fill="#1fa888" />
      <circle cx="109" cy="44.5" r="1.6" fill="#fff" />
      <circle cx="115" cy="44.5" r="1.6" fill="#fff" />
      <circle cx="109.4" cy="44.5" r="0.7" fill="#1a2b3c" />
      <circle cx="115.4" cy="44.5" r="0.7" fill="#1a2b3c" />

      {/* Food */}
      <circle cx="126" cy="30" r="7" fill="rgba(245,185,66,0.35)" />
      <circle cx="126" cy="30" r="4.5" fill="#f5b942" />
      <circle cx="124.5" cy="28.5" r="1.3" fill="rgba(255,255,255,0.55)" />
    </svg>
  )
}

const artBySlug: Record<string, () => JSX.Element> = {
  stacker: StackerArt,
  patriot: PatriotArt,
  snake: SnakeArt,
}

export function GameTileArt({ slug }: { slug: string }) {
  const Art = artBySlug[slug]
  if (!Art) return <div className="game-tile__swatch" aria-hidden="true" />
  return (
    <div className="game-tile__art" aria-hidden="true">
      <Art />
    </div>
  )
}
