import type { ReactNode } from 'react'

/*
 * The stickers' pictures, each on a 64 × 64 square, die-cut: the white edge and the drop under it are the
 * `.sticker` class's (stickers.css), drawn around whatever shape the sticker is. The list is data/stickers.ts.
 */

const STAR = 'M0 -10 L2.4 -3.2 L9.5 -3.1 L3.8 1.2 L5.9 8.1 L0 4 L-5.9 8.1 L-3.8 1.2 L-9.5 -3.1 L-2.4 -3.2 Z'
const FLAME = 'M32 6 C 38 16, 48 22, 48 36 A 16 16 0 0 1 16 36 C 16 26, 22 22, 24 14 C 26 22, 30 24, 32 24 C 30 18, 30 12, 32 6 Z'

function Medal({ fill, edge, mark }: { fill: string; edge: string; mark?: ReactNode }) {
  return (
    <>
      <path d="M22 4 H 30 L 34 22 H 26 Z" fill="#5a7bd6" />
      <path d="M42 4 H 34 L 30 22 H 38 Z" fill="#3f5fbf" />
      <circle cx="32" cy="38" r="18" fill={fill} />
      <circle cx="32" cy="38" r="13" fill="none" stroke={edge} strokeWidth="2.5" />
      {mark}
    </>
  )
}

function Rocket({ x = 32, y = 32, s = 1, turn = 0 }: { x?: number; y?: number; s?: number; turn?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${turn}) scale(${s})`}>
      <path d="M0 -24 C 9 -14, 11 0, 9 10 L -9 10 C -11 0, -9 -14, 0 -24 Z" fill="#eef4f8" />
      <circle cx="0" cy="-6" r="5" fill="#5a7bd6" stroke="#2b3d8e" strokeWidth="1.5" />
      <path d="M-9 4 L -16 16 L -8 12 Z M 9 4 L 16 16 L 8 12 Z" fill="#ff7a59" />
      <path d="M-5 11 L 0 26 L 5 11 Z" fill="#ffc24a" />
    </g>
  )
}

const DRAW: Record<string, () => ReactNode> = {
  // ---------- Space Race ----------
  's1-liftoff': () => (
    <>
      <circle cx="32" cy="32" r="28" fill="#1d2350" />
      <path d="M8 50 Q 32 40 56 50 L 56 60 L 8 60 Z" fill="#3a4060" />
      <circle cx="22" cy="54" r="7" fill="#c9d3dc" />
      <circle cx="42" cy="55" r="8" fill="#dfe6ee" />
      <Rocket y={28} s={0.9} />
    </>
  ),
  's1-moon': () => (
    <>
      <circle cx="32" cy="32" r="27" fill="#e9eef4" />
      <circle cx="24" cy="24" r="6" fill="#c9d1da" />
      <circle cx="40" cy="38" r="8" fill="#c9d1da" />
      <circle cx="40" cy="20" r="3.5" fill="#c9d1da" />
      <circle cx="22" cy="42" r="4" fill="#c9d1da" />
      <path d="M14 22 A 22 22 0 0 0 38 56" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.6" />
    </>
  ),
  's1-ringed': () => (
    <>
      <ellipse cx="32" cy="34" rx="30" ry="9" fill="none" stroke="#f2c14e" strokeWidth="5" transform="rotate(-18 32 34)" />
      <circle cx="32" cy="32" r="18" fill="#8a6ad4" />
      <path d="M16 26 Q 32 22 48 28" stroke="#b39cf0" strokeWidth="3" fill="none" />
      <path d="M16 40 Q 32 36 48 42" stroke="#6a4fb8" strokeWidth="3" fill="none" />
      {/* The ring's near half, over the planet. */}
      <path d="M2 34 A 30 9 0 0 0 62 34" fill="none" stroke="#f2c14e" strokeWidth="5" transform="rotate(-18 32 34)" />
    </>
  ),
  's1-comet': () => (
    <>
      <path d="M6 50 L 40 22 L 46 30 Z" fill="#ff8a4c" opacity="0.5" />
      <path d="M10 56 L 42 26 L 46 32 Z" fill="#ffc24a" opacity="0.8" />
      <circle cx="46" cy="22" r="12" fill="#fff3c4" />
      <circle cx="46" cy="22" r="7" fill="#ffffff" />
    </>
  ),
  's1-satellite': () => (
    <>
      <rect x="2" y="24" width="18" height="16" rx="2" fill="#2b5fbf" />
      <rect x="44" y="24" width="18" height="16" rx="2" fill="#2b5fbf" />
      <path d="M11 24 V 40 M 53 24 V 40" stroke="#7fb0ff" strokeWidth="1.5" />
      <rect x="20" y="30" width="24" height="4" fill="#a6aeb8" />
      <rect x="24" y="20" width="16" height="24" rx="4" fill="#dfe6ee" />
      <circle cx="32" cy="14" r="5" fill="none" stroke="#dfe6ee" strokeWidth="3" />
      <path d="M32 19 V 20" stroke="#dfe6ee" strokeWidth="3" />
    </>
  ),
  's1-astronaut': () => (
    <>
      <circle cx="32" cy="30" r="22" fill="#eef4f8" />
      <rect x="18" y="20" width="28" height="20" rx="10" fill="#1d2350" />
      <path d="M22 26 Q 28 22 34 26" stroke="#7fb0ff" strokeWidth="3" fill="none" strokeLinecap="round" />
      <rect x="20" y="50" width="24" height="10" rx="5" fill="#eef4f8" />
      <circle cx="12" cy="30" r="4" fill="#ff7a59" />
      <circle cx="52" cy="30" r="4" fill="#ff7a59" />
    </>
  ),
  's1-supernova': () => (
    <>
      <circle cx="32" cy="32" r="26" fill="#5b2a9a" />
      <circle cx="32" cy="32" r="18" fill="#ff7ac6" />
      <circle cx="32" cy="32" r="9" fill="#fff3c4" />
      <path d="M32 2 V 14 M 32 50 V 62 M 2 32 H 14 M 50 32 H 62 M 11 11 L 19 19 M 45 45 L 53 53 M 53 11 L 45 19 M 11 53 L 19 45" stroke="#fff3c4" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  's1-medals': () => <Medal fill="#c9d3dc" edge="#8495a3" mark={<g transform="translate(32 38) scale(0.8)"><path d={STAR} fill="#5a7bd6" /></g>} />,
  's1-gold': () => (
    <>
      <ellipse cx="32" cy="32" rx="29" ry="10" fill="none" stroke="#f2c14e" strokeWidth="3" transform="rotate(-20 32 32)" />
      <circle cx="32" cy="32" r="15" fill="#f2c14e" />
      <circle cx="32" cy="32" r="10" fill="none" stroke="#b8862b" strokeWidth="2.5" />
      <g transform="translate(32 32) scale(0.7)">
        <path d={STAR} fill="#b8862b" />
      </g>
      <circle cx="56" cy="22" r="3" fill="#fff3c4" />
    </>
  ),
  's1-dailies': () => (
    <>
      <rect x="10" y="8" width="44" height="50" rx="6" fill="#f3ecdc" />
      <rect x="10" y="8" width="44" height="12" rx="6" fill="#ff7a59" />
      <path d="M18 30 l4 4 l8 -8 M 18 44 l4 4 l8 -8" stroke="#16a36a" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M34 31 H 46 M 34 45 H 46" stroke="#b8a888" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  's1-topten': () => (
    <>
      <g transform="translate(32 32) scale(2.6)">
        <path d={STAR} fill="#ffd36b" />
      </g>
      <text x="32" y="38" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight={800} fontSize="15" fill="#7a5410">10</text>
    </>
  ),
  's1-legend': () => (
    <>
      <path d="M14 20 H 50 V 30 A 18 18 0 0 1 14 30 Z" fill="#f2c14e" />
      <path d="M14 22 H 6 Q 6 34 16 36 M 50 22 H 58 Q 58 34 48 36" fill="none" stroke="#f2c14e" strokeWidth="4" />
      <rect x="27" y="46" width="10" height="8" fill="#b8862b" />
      <rect x="20" y="54" width="24" height="6" rx="2" fill="#7a5410" />
      <Rocket x={32} y={28} s={0.42} />
    </>
  ),

  // ---------- the arcade ----------
  'a-first': () => (
    <>
      <rect x="6" y="18" width="52" height="30" rx="15" fill="#ff8552" />
      <path d="M17 33 h 10 M 22 28 v 10" stroke="#3a1406" strokeWidth="4" strokeLinecap="round" />
      <circle cx="40" cy="30" r="4" fill="#3a1406" />
      <circle cx="47" cy="37" r="4" fill="#3a1406" />
    </>
  ),
  'a-explorer': () => (
    <>
      <circle cx="32" cy="32" r="27" fill="#2eb8a0" />
      <circle cx="32" cy="32" r="20" fill="#f3ecdc" />
      <path d="M32 14 L 37 32 L 32 50 L 27 32 Z" fill="#ff5f6d" />
      <path d="M32 32 L 37 32 L 32 50 L 27 32 Z" fill="#3a4060" />
      <circle cx="32" cy="32" r="3" fill="#1a2b3c" />
    </>
  ),
  'a-week': () => (
    <>
      <rect x="6" y="12" width="52" height="44" rx="8" fill="#eef4f8" />
      <rect x="6" y="12" width="52" height="12" rx="6" fill="#5a7bd6" />
      <text x="32" y="48" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight={800} fontSize="22" fill="#1d2350">7</text>
      <path d="M44 34 l 3 3 l 6 -6" stroke="#16a36a" strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  ),
  'a-fire': () => (
    <>
      <path d={FLAME} fill="#ff8552" />
      <path d="M32 30 C 36 36, 40 38, 40 44 A 8 8 0 0 1 24 44 C 24 38, 28 36, 32 30 Z" fill="#ffd36b" />
    </>
  ),
  'a-medal': () => <Medal fill="#d08a4f" edge="#8a5228" />,
  'a-goldrush': () => (
    <>
      <g transform="translate(-8 4)">
        <Medal fill="#f2c14e" edge="#b8862b" />
      </g>
      <g transform="translate(10 6)">
        <Medal fill="#f2c14e" edge="#b8862b" mark={<text x="32" y="44" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight={800} fontSize="14" fill="#7a5410">10</text>} />
      </g>
    </>
  ),
  'a-platinum': () => (
    <Medal
      fill="#dbe6f0"
      edge="#8fb2cf"
      mark={
        <g transform="translate(32 38) scale(0.9)">
          <path d={STAR} fill="#ffffff" stroke="#8fb2cf" strokeWidth="1" />
        </g>
      }
    />
  ),
  'a-topten': () => (
    <>
      <path d="M18 34 L 12 60 L 22 54 L 28 62 L 30 36 Z M 46 34 L 52 60 L 42 54 L 36 62 L 34 36 Z" fill="#45d3ba" />
      <circle cx="32" cy="26" r="20" fill="#15806f" />
      <circle cx="32" cy="26" r="15" fill="none" stroke="#45d3ba" strokeWidth="2.5" />
      <text x="32" y="32" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight={800} fontSize="15" fill="#ffffff">10</text>
    </>
  ),
  'a-podium': () => (
    <>
      <rect x="24" y="22" width="16" height="36" fill="#f2c14e" />
      <rect x="8" y="34" width="16" height="24" fill="#c9d3dc" />
      <rect x="40" y="40" width="16" height="18" fill="#d08a4f" />
      <text x="32" y="38" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight={800} fontSize="13" fill="#7a5410">1</text>
      <text x="16" y="50" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight={800} fontSize="12" fill="#4a5866">2</text>
      <text x="48" y="54" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight={800} fontSize="12" fill="#5a3210">3</text>
      <g transform="translate(32 12) scale(0.7)">
        <path d={STAR} fill="#ffd36b" />
      </g>
    </>
  ),
  'a-champ': () => (
    <>
      <path d="M8 22 L 18 40 L 32 16 L 46 40 L 56 22 L 52 50 H 12 Z" fill="#f2c14e" />
      <rect x="12" y="48" width="40" height="8" rx="2" fill="#b8862b" />
      <circle cx="8" cy="20" r="4" fill="#ff5f6d" />
      <circle cx="32" cy="14" r="4" fill="#5a7bd6" />
      <circle cx="56" cy="20" r="4" fill="#16a36a" />
    </>
  ),
  'a-bug': () => (
    <>
      <path d="M22 12 L 16 4 M 42 12 L 48 4 M 16 30 H 6 M 48 30 H 58 M 16 42 L 8 50 M 48 42 L 56 50" stroke="#2f7a3e" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="32" cy="36" rx="17" ry="20" fill="#3fa356" />
      <circle cx="32" cy="16" r="10" fill="#3fa356" />
      <path d="M32 18 V 56" stroke="#2f7a3e" strokeWidth="2" />
      <circle cx="28" cy="15" r="2.5" fill="#0c1218" />
      <circle cx="36" cy="15" r="2.5" fill="#0c1218" />
      <circle cx="24" cy="34" r="3" fill="#8be08f" />
      <circle cx="40" cy="44" r="3" fill="#8be08f" />
    </>
  ),
  'a-secret': () => (
    <>
      <rect x="10" y="26" width="44" height="32" rx="6" fill="#c13b7f" />
      <path d="M20 26 V 18 A 12 12 0 0 1 44 18 V 26" fill="none" stroke="#ff8cc8" strokeWidth="6" />
      <text x="32" y="50" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight={800} fontSize="20" fill="#ffffff">?</text>
    </>
  ),
}

/** A sticker's picture, die-cut, `size` pixels square. */
export function StickerArt({ id, size = 48, className }: { id: string; size?: number; className?: string }) {
  const draw = DRAW[id]
  if (!draw) return null
  return (
    <svg className={`sticker${className ? ` ${className}` : ''}`} viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
      {draw()}
    </svg>
  )
}
