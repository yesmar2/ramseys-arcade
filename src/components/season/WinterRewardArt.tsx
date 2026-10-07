import { useId, type ReactNode } from 'react'
import { flakeStrokes } from './WinterFinishes'

/*
 * The pass's pictures of Season 2's looks (Cold Snap), on RewardArt's 100-wide board: its name styles on a
 * plate, its confetti, and its wall sign. Its finishes and card themes are drawn as they're worn, by
 * RewardArt itself, and its skins from their games' own drawings.
 */

function Board({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {children}
    </svg>
  )
}

const PLATE = '#0b1830'
const FONT = 'Outfit, sans-serif'
const at = { x: 50, y: 61, textAnchor: 'middle' as const, fontFamily: FONT, fontWeight: 800, fontSize: 26 }

function Plate({ children, fill = PLATE }: { children: ReactNode; fill?: string }) {
  return (
    <>
      <rect x="4" y="26" width="92" height="48" rx="10" fill={fill} />
      {children}
    </>
  )
}

function useUid() {
  return `wr${useId().replace(/[^a-zA-Z0-9]/g, '')}`
}

function GradientName({ size, stops, glow, angle = 'down' }: { size: number; stops: [number, string][]; glow?: string; angle?: 'down' | 'across' }) {
  const id = useUid()
  return (
    <Board size={size}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2={angle === 'across' ? '1' : '0'} y2={angle === 'across' ? '1' : '1'}>
          {stops.map(([o, c], i) => (
            <stop key={i} offset={o} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      <Plate>
        {glow ? (
          <text {...at} fill="none" stroke={glow} strokeWidth="4" opacity="0.45">
            ACE
          </text>
        ) : null}
        <text {...at} fill={`url(#${id})`}>
          ACE
        </text>
      </Plate>
    </Board>
  )
}

const FLAKES: [number, number, number, number][] = [
  [20, 22, 7, 0],
  [56, 14, 5, 20],
  [82, 30, 8, 10],
  [34, 50, 6, 30],
  [70, 58, 7, 5],
  [16, 78, 6, 15],
  [50, 84, 8, 25],
  [86, 82, 5, 40],
]

export const WINTER_LOOKS_DRAW: Record<string, (size: number) => ReactNode> = {
  'nm-frost': (size) => (
    <Board size={size}>
      <Plate>
        <text {...at} fill="none" stroke="#7fc8ff" strokeWidth="5" opacity="0.4">
          ACE
        </text>
        <text {...at} fill="#f4fbff">
          ACE
        </text>
        <path d={flakeStrokes(16, 38, 5)} fill="none" stroke="#bfe6ff" strokeWidth="1.2" strokeLinecap="round" />
      </Plate>
    </Board>
  ),
  'nm-frostbite': (size) => (
    <GradientName
      size={size}
      stops={[
        [0, '#ffffff'],
        [0.4, '#ffffff'],
        [0.55, '#7fd0ff'],
        [1, '#3fa0e8'],
      ]}
    />
  ),
  'nm-glacier': (size) => (
    <GradientName
      size={size}
      glow="#3a7fd0"
      stops={[
        [0, '#dff4ff'],
        [0.5, '#7fc8ff'],
        [1, '#3a7fd0'],
      ]}
    />
  ),
  'nm-hoarfrost': (size) => (
    <Board size={size}>
      <Plate>
        <text {...at} fill="none" stroke="#ffffff" strokeWidth="2.6" strokeDasharray="0.8 1.6" strokeLinecap="round" opacity="0.9">
          ACE
        </text>
        <text {...at} fill="#dff2ff">
          ACE
        </text>
      </Plate>
    </Board>
  ),
  'nm-polar': (size) => (
    <Board size={size}>
      <Plate>
        <text {...at} fill="none" stroke="#4aa8e8" strokeWidth="6" opacity="0.35">
          ACE
        </text>
        <text {...at} fill="#ffffff" stroke="#4aa8e8" strokeWidth="2" paintOrder="stroke" strokeLinejoin="round">
          ACE
        </text>
      </Plate>
    </Board>
  ),
  'nm-crystal': (size) => (
    <GradientName
      size={size}
      angle="across"
      glow="#e86bd0"
      stops={[
        [0, '#e8f8ff'],
        [0.25, '#e8f8ff'],
        [0.25, '#7fd0ff'],
        [0.45, '#7fd0ff'],
        [0.45, '#dff4ff'],
        [0.6, '#dff4ff'],
        [0.6, '#4aa8e8'],
        [0.8, '#4aa8e8'],
        [0.8, '#c9eeff'],
      ]}
    />
  ),
  'cf-snowfall': (size) => (
    <Board size={size}>
      {FLAKES.map(([x, y, r, turn]) => (
        <path key={`${x}-${y}`} d={flakeStrokes(x, y, r, turn)} fill="none" stroke={x % 3 ? '#bfe6ff' : '#4aa8e8'} strokeWidth="1.6" strokeLinecap="round" />
      ))}
    </Board>
  ),
  'cf-snowballs': (size) => (
    <Board size={size}>
      {([[30, 34, 11], [70, 56, 9], [40, 78, 7]] as const).map(([x, y, r]) => (
        <g key={x}>
          <circle cx={x - r * 1.7} cy={y + r * 0.7} r={r * 0.5} fill="#cfe2f2" opacity="0.6" />
          <circle cx={x - r * 2.6} cy={y + r * 1.1} r={r * 0.32} fill="#cfe2f2" opacity="0.4" />
          <circle cx={x} cy={y} r={r} fill="#ffffff" stroke="#8fb2d4" strokeWidth="1.5" />
          <circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.3} fill="#ffffff" />
        </g>
      ))}
    </Board>
  ),
  'cf-icicles': (size) => (
    <Board size={size}>
      {([[22, 14, 36], [44, 24, 30], [64, 10, 44], [84, 30, 28], [34, 58, 26], [72, 64, 30]] as const).map(([x, y, len]) => (
        <g key={`${x}-${y}`}>
          <path d={`M${x - 5} ${y}H${x + 5}L${x} ${y + len}Z`} fill="#dff4ff" stroke="#4aa8e8" strokeWidth="1.2" strokeLinejoin="round" />
          <path d={`M${x - 1.5} ${y + 3}L${x} ${y + len * 0.6}`} stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      ))}
    </Board>
  ),
  'cf-flurry': (size) => (
    <Board size={size}>
      <path d="M10 70C20 40 50 30 64 44S60 72 44 64S40 40 62 34S92 40 94 24" fill="none" stroke="#9fd4f7" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      {([[16, 66, 6, 0], [30, 44, 5, 20], [52, 34, 7, 10], [66, 50, 5, 35], [48, 66, 6, 15], [80, 30, 6, 5], [90, 18, 4, 25]] as const).map(([x, y, r, turn]) => (
        <path key={`${x}-${y}`} d={flakeStrokes(x, y, r, turn)} fill="none" stroke="#4aa8e8" strokeWidth="1.5" strokeLinecap="round" />
      ))}
    </Board>
  ),
  'sign-cold-snap': (size) => (
    <Board size={size}>
      <rect x="5" y="24" width="90" height="52" rx="8" fill="#0b1830" stroke="#9fd8ff" strokeWidth="2.5" />
      <path d="M5 33V31Q5 24 12 24H88Q95 24 95 31V33Q86 29 76 32Q64 28 52 32Q40 28 28 32Q16 29 5 33Z" fill="#ffffff" />
      <path d="M14 76L17 84L20 76ZM30 76L32.5 82L35 76ZM48 76L51 86L54 76ZM66 76L68.5 82L71 76ZM82 76L85 84L88 76Z" fill="#dff4ff" />
      <text x="50" y="52" textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize="15" fill="#ffffff">
        COLD
      </text>
      <text x="50" y="68" textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize="15" fill="#9fd8ff">
        SNAP
      </text>
    </Board>
  ),
}
