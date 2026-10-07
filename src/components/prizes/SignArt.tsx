import { useId, type ReactNode } from 'react'
import { askForOrbitronFont } from '../../lib/nameStyle'
import { SIGN_W, signHeight, sparkle } from '../../lib/prizeArt'

/*
 * The signs on the wall above the prize counter, each of which puts a tag in
 * lights on its owner's player card: an LED board, a marquee ringed in bulbs,
 * the neon sign, and a neon sign on a rooftop over the city. Each draws on a
 * 440-wide board, hung from two wires on the wall (214 high) or bare on a card
 * (178 high), and sizes the tag to fit however long it is.
 */

const FONT = 'Outfit, system-ui, sans-serif'

function Glow({ id, blur }: { id: string; blur: number }) {
  return (
    <filter id={id} x="-40%" y="-60%" width="180%" height="220%">
      <feGaussianBlur stdDeviation={blur} result="b" />
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  )
}

function Wires() {
  return <path d="M128 0 L156 42 M312 0 L284 42" stroke="rgba(231,238,243,0.35)" strokeWidth="1.5" />
}

/** Letters sized to a board `room` wide, however long the tag. */
function fitSize(tag: string, room: number, most: number) {
  return Math.min(most, room / (tag.length * 0.66 + 0.2))
}

/* ---------- the neon sign ---------- */

function Neon({ tag, id, top }: { tag: string; id: string; top: number }) {
  const size = fitSize(tag, 300, 100)
  return (
    <>
      <defs>
        <Glow id={`${id}l`} blur={6} />
        <Glow id={`${id}s`} blur={2.4} />
      </defs>
      <rect x="28" y={top} width="384" height="162" rx="22" fill="#120b16" stroke="rgba(255,111,181,0.28)" strokeWidth="1.5" />
      {[48, 392].map((x) => (
        <g key={x}>
          <circle cx={x} cy={top + 20} r="3" fill="#3a2a3e" />
          <circle cx={x} cy={top + 142} r="3" fill="#3a2a3e" />
        </g>
      ))}
      <text x="220" y={top + 106} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={size} letterSpacing={size * 0.08} fill="none" stroke="#ff5fa2" strokeWidth="7" filter={`url(#${id}l)`} opacity="0.9">
        {tag}
      </text>
      <text x="220" y={top + 106} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={size} letterSpacing={size * 0.08} fill="none" stroke="#ffd6ea" strokeWidth="2.2">
        {tag}
      </text>
      <path d={`M116 ${top + 132} H324`} stroke="#3ee0c8" strokeWidth="5" strokeLinecap="round" filter={`url(#${id}l)`} />
      <path d={`M116 ${top + 132} H324`} stroke="#cffff5" strokeWidth="1.6" strokeLinecap="round" />
      <path d={sparkle(362, top + 38, 12)} fill="#3ee0c8" filter={`url(#${id}s)`} />
      <path d={sparkle(362, top + 38, 5)} fill="#e9fffb" />
    </>
  )
}

/* ---------- the LED board ---------- */

/** A 5 × 7 dot font, a row of five bits to a line, top line first. */
const DOTS: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 17, 25, 21, 19, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 21, 10],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  '0': [14, 17, 19, 21, 25, 17, 14],
  '1': [4, 12, 4, 4, 4, 4, 14],
  '2': [14, 17, 1, 2, 4, 8, 31],
  '3': [31, 2, 4, 2, 1, 17, 14],
  '4': [2, 6, 10, 18, 31, 2, 2],
  '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [6, 8, 16, 30, 17, 17, 14],
  '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14],
  '9': [14, 17, 17, 15, 1, 2, 12],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '-': [0, 0, 0, 31, 0, 0, 0],
  _: [0, 0, 0, 0, 0, 0, 31],
  '.': [0, 0, 0, 0, 0, 12, 12],
  '!': [4, 4, 4, 4, 4, 0, 4],
  '?': [14, 17, 1, 2, 4, 0, 4],
  "'": [4, 4, 8, 0, 0, 0, 0],
  '&': [12, 18, 20, 8, 21, 18, 13],
  '#': [10, 10, 31, 10, 31, 10, 10],
  '+': [0, 4, 4, 31, 4, 4, 0],
  ':': [0, 12, 12, 0, 12, 12, 0],
  '/': [1, 1, 2, 4, 8, 16, 16],
  '*': [0, 4, 21, 14, 21, 4, 0],
}

/** Anything the font hasn't a shape for shows as a block, so a tag never loses a letter. */
const BLOCK = [0, 31, 31, 31, 31, 31, 0]

function Led({ tag, id, top }: { tag: string; id: string; top: number }) {
  const chars = [...tag]
  // The whole board is a grid of dots, lit where the letters are and dim
  // everywhere else, as fine as it has to be for the tag to fit.
  const tagCols = chars.length * 6 - 1
  const pitch = Math.min(12.4, 352 / (tagCols + 4))
  const cols = Math.floor(358 / pitch)
  let rows = Math.max(9, Math.floor(148 / pitch))
  if (rows % 2 === 0) rows -= 1
  const r = pitch * 0.36
  const x0 = 220 - (cols * pitch) / 2 + pitch / 2
  const y0 = top + 81 - (rows * pitch) / 2 + pitch / 2
  const first = Math.floor((cols - tagCols) / 2)
  const firstRow = (rows - 7) / 2
  const lit = new Set<string>()
  chars.forEach((ch, i) => {
    const rowsOf = DOTS[ch] ?? BLOCK
    rowsOf.forEach((bits, row) => {
      for (let b = 0; b < 5; b++) if (bits & (16 >> b)) lit.add(`${first + i * 6 + b},${firstRow + row}`)
    })
  })
  const dim: string[] = []
  const on: string[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = x0 + col * pitch
      const cy = y0 + row * pitch
      const dot = `M${(cx - r).toFixed(1)} ${cy.toFixed(1)}a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(2 * r).toFixed(2)} 0a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(-2 * r).toFixed(2)} 0Z`
      ;(lit.has(`${col},${row}`) ? on : dim).push(dot)
    }
  }
  return (
    <>
      <defs>
        <Glow id={`${id}g`} blur={3} />
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a4048" />
          <stop offset="1" stopColor="#1d2127" />
        </linearGradient>
      </defs>
      <rect x="22" y={top - 6} width="396" height="174" rx="16" fill={`url(#${id}b)`} />
      <rect x="32" y={top + 4} width="376" height="154" rx="8" fill="#08090c" />
      {[34, 406].map((x) => (
        <g key={x}>
          <circle cx={x - 2} cy={top + 1} r="2.6" fill="#59616b" />
          <circle cx={x - 2} cy={top + 161} r="2.6" fill="#59616b" />
        </g>
      ))}
      <path d={dim.join('')} fill="#2a1710" />
      <path d={on.join('')} fill="#ff6a3d" filter={`url(#${id}g)`} />
      <path d={on.join('')} fill="#ffc3a6" opacity="0.55" />
      <rect x="32" y={top + 4} width="376" height="40" rx="8" fill="#fff" opacity="0.035" />
    </>
  )
}

/* ---------- the marquee ---------- */

function Marquee({ tag, id, top }: { tag: string; id: string; top: number }) {
  const size = fitSize(tag, 262, 82)
  // Bulbs all the way round the board's edge, every other one a little brighter.
  const bulbs: ReactNode[] = []
  const x0 = 40
  const x1 = 400
  const y0 = top + 12
  const y1 = top + 150
  const along = (from: [number, number], to: [number, number], n: number, start: number) => {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n
      const x = from[0] + (to[0] - from[0]) * t
      const y = from[1] + (to[1] - from[1]) * t
      const k = start + i
      bulbs.push(
        <g key={`b${k}`}>
          <circle cx={x} cy={y} r="7.5" fill="#ffd98a" opacity={k % 2 ? 0.16 : 0.34} />
          <circle cx={x} cy={y} r="4.2" fill={k % 2 ? '#f1d59c' : '#fff6dc'} />
        </g>,
      )
    }
  }
  along([x0, y0], [x1, y0], 16, 0)
  along([x1, y0], [x1, y1], 6, 16)
  along([x1, y1], [x0, y1], 16, 22)
  along([x0, y1], [x0, y0], 6, 38)
  return (
    <>
      <defs>
        <Glow id={`${id}g`} blur={4} />
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8e1733" />
          <stop offset="1" stopColor="#5a0c22" />
        </linearGradient>
        <linearGradient id={`${id}t`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="1" stopColor="#ffd9a3" />
        </linearGradient>
      </defs>
      <rect x="24" y={top - 4} width="392" height="170" rx="24" fill={`url(#${id}f)`} stroke="#3a0715" strokeWidth="3" />
      <rect x="56" y={top + 26} width="328" height="110" rx="12" fill="#1e0610" />
      {bulbs}
      <text x="220" y={top + 81 + size * 0.36} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={size} letterSpacing={size * 0.06} fill="#ffcf7a" opacity="0.55" filter={`url(#${id}g)`}>
        {tag}
      </text>
      <text x="220" y={top + 81 + size * 0.36} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={size} letterSpacing={size * 0.06} fill={`url(#${id}t)`} stroke="#3a0715" strokeWidth="1.2" paintOrder="stroke">
        {tag}
      </text>
    </>
  )
}

/* ---------- Liftoff, from Season 1's pass ---------- */

const LIFTOFF_STARS: [number, number, number][] = [
  [52, 22, 1.4],
  [140, 30, 1],
  [200, 18, 1.3],
  [300, 26, 1],
  [380, 20, 1.5],
  [350, 140, 1.1],
  [160, 150, 1],
  [400, 96, 1.2],
  [128, 92, 0.9],
]

/** The tag in lights beside a rocket lifting off its pad, on a board of night sky. */
function Liftoff({ tag, id, top }: { tag: string; id: string; top: number }) {
  askForOrbitronFont()
  const size = fitSize(tag, 230, 64)
  const y = top + 74 + size * 0.36
  return (
    <>
      <defs>
        <Glow id={`${id}g`} blur={5} />
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a2252" />
          <stop offset="1" stopColor="#101634" />
        </linearGradient>
      </defs>
      <rect x="24" y={top - 4} width="392" height="170" rx="22" fill={`url(#${id}b)`} stroke="#f2813a" strokeWidth="3" />
      {LIFTOFF_STARS.map(([x, sy, r]) => (
        <circle key={`${x}-${sy}`} cx={x} cy={top + sy} r={r} fill="#f4f0ff" opacity="0.8" />
      ))}
      {[
        [68, 152, 12],
        [86, 156, 14],
        [106, 152, 11],
        [78, 146, 9],
      ].map(([x, sy, r]) => (
        <circle key={`p${x}-${sy}`} cx={x} cy={top + sy - 4} r={r} fill="#e9e4f7" opacity="0.75" />
      ))}
      <g transform={`translate(88 ${top + 70}) scale(2.4)`}>
        <path d="M-4 12 L0 30 L4 12z" fill="#f2813a" />
        <path d="M-2.5 12 L0 22 L2.5 12z" fill="#f5b942" />
        <path d="M0 -22 C8 -14 8 2 6 12 H-6 C-8 2 -8 -14 0 -22z" fill="#f4f0ff" />
        <circle cx="0" cy="-6" r="3.4" fill="#6b74e8" />
        <path d="M-6 4 L-12 16 L-6 13z M6 4 L12 16 L6 13z" fill="#e8564f" />
      </g>
      <text x="268" y={y} textAnchor="middle" fontFamily="Orbitron, Outfit, sans-serif" fontWeight={800} fontSize={size} letterSpacing={size * 0.06} fill="#f2813a" opacity="0.7" filter={`url(#${id}g)`}>
        {tag}
      </text>
      <text x="268" y={y} textAnchor="middle" fontFamily="Orbitron, Outfit, sans-serif" fontWeight={800} fontSize={size} letterSpacing={size * 0.06} fill="#ffffff">
        {tag}
      </text>
      <path d={`M164 ${top + 116} H372`} stroke="#f2813a" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
      <text x="268" y={top + 140} textAnchor="middle" fontFamily="Orbitron, Outfit, sans-serif" fontWeight={700} fontSize="12" letterSpacing="5" fill="#a5abd6">
        LIFTOFF
      </text>
    </>
  )
}

/* ---------- Cold Snap, from Season 2's pass ---------- */

const COLD_FLAKES: [number, number, number][] = [
  [48, 34, 1.6],
  [120, 22, 1.2],
  [196, 40, 1.4],
  [262, 18, 1.1],
  [330, 36, 1.5],
  [392, 24, 1.2],
  [70, 120, 1.3],
  [150, 140, 1],
  [384, 132, 1.4],
  [300, 150, 1.1],
]

/** A six-armed snowflake's strokes round cx, cy. */
function snowflake(cx: number, cy: number, r: number) {
  let d = ''
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 - Math.PI / 2
    const ex = cx + Math.cos(a) * r
    const ey = cy + Math.sin(a) * r
    d += `M${cx} ${cy}L${ex.toFixed(1)} ${ey.toFixed(1)}`
    const bx = cx + Math.cos(a) * r * 0.55
    const by = cy + Math.sin(a) * r * 0.55
    for (const s of [-1, 1]) {
      const b = a + (s * Math.PI) / 4
      d += `M${bx.toFixed(1)} ${by.toFixed(1)}L${(bx + Math.cos(b) * r * 0.34).toFixed(1)} ${(by + Math.sin(b) * r * 0.34).toFixed(1)}`
    }
  }
  return d
}

/** The tag in lights on a winter night's board, snow lying along its top and icicles hanging off its bottom. */
function ColdSnap({ tag, id, top }: { tag: string; id: string; top: number }) {
  const size = fitSize(tag, 250, 64)
  const y = top + 76 + size * 0.36
  const bottom = top + 166
  let icicles = ''
  for (let x = 40; x < 404; x += 22) {
    const len = 8 + ((x * 37) % 17)
    icicles += `M${x - 5} ${bottom}L${x} ${bottom + len}L${x + 5} ${bottom}Z`
  }
  return (
    <>
      <defs>
        <Glow id={`${id}g`} blur={5} />
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#163463" />
          <stop offset="1" stopColor="#0b1830" />
        </linearGradient>
      </defs>
      <rect x="24" y={top - 4} width="392" height="170" rx="22" fill={`url(#${id}b)`} stroke="#9fd8ff" strokeWidth="3" />
      <path d={icicles} fill="#dff4ff" opacity="0.9" />
      <path
        d={`M24 ${top + 18}V${top + 14}Q24 ${top - 4} 46 ${top - 4}H394Q416 ${top - 4} 416 ${top + 14}V${top + 18}Q404 ${top + 10} 392 ${top + 15}Q360 ${top + 7} 330 ${top + 14}Q296 ${top + 6} 262 ${top + 13}Q226 ${top + 5} 190 ${top + 13}Q150 ${top + 6} 116 ${top + 14}Q80 ${top + 7} 48 ${top + 15}Q36 ${top + 11} 24 ${top + 18}Z`}
        fill="#ffffff"
      />
      {COLD_FLAKES.map(([x, sy, r]) => (
        <circle key={`${x}-${sy}`} cx={x} cy={top + sy} r={r} fill="#ffffff" opacity="0.85" />
      ))}
      <path d={`${snowflake(62, top + 78, 16)}${snowflake(380, top + 78, 12)}`} fill="none" stroke="#bfe6ff" strokeWidth="2.4" strokeLinecap="round" />
      <text x="220" y={y} textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight={800} fontSize={size} letterSpacing={size * 0.04} fill="#7fc8ff" opacity="0.75" filter={`url(#${id}g)`}>
        {tag}
      </text>
      <text x="220" y={y} textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight={800} fontSize={size} letterSpacing={size * 0.04} fill="#ffffff">
        {tag}
      </text>
      <path d={`M120 ${top + 118} H320`} stroke="#9fd8ff" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
      <text x="220" y={top + 142} textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight={800} fontSize="12" letterSpacing="5" fill="#9fb4d6">
        COLD SNAP
      </text>
    </>
  )
}

/* ---------- the rooftop ---------- */

/** Windows lit here and there in a block, the same every time it's drawn. */
function windows(x: number, y: number, w: number, h: number, seed: number) {
  let s = seed
  const rnd = () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
  let d = ''
  for (let wy = y + 6; wy < y + h - 6; wy += 9) {
    for (let wx = x + 5; wx < x + w - 6; wx += 8) {
      if (rnd() < 0.36) d += `M${wx} ${wy}h3.6v4.6h-3.6Z`
    }
  }
  return d
}

const SKYLINE: [number, number, number, number][] = [
  [8, 96, 34, 90],
  [38, 70, 30, 116],
  [64, 104, 40, 82],
  [100, 84, 26, 102],
  [306, 88, 30, 98],
  [332, 64, 36, 122],
  [364, 98, 34, 88],
  [394, 80, 40, 106],
]

function Rooftop({ tag, id, h }: { tag: string; id: string; h: number }) {
  const size = fitSize(tag, 286, 84)
  const base = h - 34
  const text = base - 36
  return (
    <>
      <defs>
        <Glow id={`${id}l`} blur={5.5} />
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1030" />
          <stop offset="0.7" stopColor="#2a1850" />
          <stop offset="1" stopColor="#5a2360" />
        </linearGradient>
        <clipPath id={`${id}c`}>
          <rect x="6" y="4" width="428" height={h - 8} rx="20" />
        </clipPath>
        <mask id={`${id}m`}>
          <rect width="440" height={h} fill="#fff" />
          <circle cx="384" cy="22" r="13" fill="#000" />
        </mask>
      </defs>
      <g clipPath={`url(#${id}c)`}>
        <rect x="0" y="0" width="440" height={h} fill={`url(#${id}sky)`} />
        {[
          [30, 18, 1.1],
          [74, 34, 0.9],
          [118, 14, 1.2],
          [166, 30, 0.8],
          [214, 12, 1],
          [262, 26, 0.9],
          [300, 10, 1.1],
          [338, 38, 0.8],
          [420, 44, 1],
          [142, 52, 0.7],
          [248, 48, 0.7],
        ].map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#fff" opacity="0.8" />
        ))}
        <circle cx="376" cy="28" r="14" fill="#f3ecd2" mask={`url(#${id}m)`} />
        {SKYLINE.map(([x, top, w, bh], i) => (
          <g key={x}>
            <rect x={x} y={h - bh} width={w} height={bh} fill={i % 2 ? '#150d2c' : '#1c1238'} />
            <path d={windows(x, h - bh, w, bh, 7 + i * 13)} fill="#ffd98a" opacity="0.55" />
            {top < 72 ? <path d={`M${x + w / 2} ${h - bh} V${h - bh - 14}`} stroke="#150d2c" strokeWidth="2" /> : null}
          </g>
        ))}
        {/* The roof the sign stands on, and its scaffold. */}
        <path d={`M92 ${base + 2} H348 V${h} H92 Z`} fill="#0d0820" />
        <path d={`M86 ${base} H354`} stroke="#2a2346" strokeWidth="4" strokeLinecap="round" />
        <g stroke="#3a3160" strokeWidth="2">
          {[118, 170, 220, 270, 322].map((x) => (
            <path key={x} d={`M${x} ${base} V${text - size * 0.78}`} />
          ))}
          <path d={`M110 ${text - size * 0.4} H330 M110 ${text + 12} H330`} />
          <path d={`M118 ${base} L170 ${text + 12} M170 ${base} L220 ${text + 12} M220 ${base} L270 ${text + 12} M270 ${base} L322 ${text + 12}`} opacity="0.7" />
        </g>
        <text x="220" y={text} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={size} letterSpacing={size * 0.08} fill="none" stroke="#2fe3cf" strokeWidth="6.5" filter={`url(#${id}l)`} opacity="0.9">
          {tag}
        </text>
        <text x="220" y={text} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={size} letterSpacing={size * 0.08} fill="none" stroke="#dcfffa" strokeWidth="2">
          {tag}
        </text>
        <path d={`M150 ${text + 22} H290`} stroke="#ff5fa2" strokeWidth="4.5" strokeLinecap="round" filter={`url(#${id}l)`} />
        <path d={`M150 ${text + 22} H290`} stroke="#ffe3f1" strokeWidth="1.4" strokeLinecap="round" />
        <rect x="0" y={base + 4} width="440" height={h - base} fill="#2fe3cf" opacity="0.05" />
      </g>
      <rect x="6" y="4" width="428" height={h - 8} rx="20" fill="none" stroke="rgba(47,227,207,0.3)" strokeWidth="1.5" />
    </>
  )
}

/** A sign's drawing on a 440-wide stage, for inside another SVG. */
export function SignDrawing({ sign, name, id, wires }: { sign: string; name: string; id: string; wires: boolean }) {
  const tag = name.trim().toUpperCase() || 'YOU'
  const h = signHeight(wires)
  const top = wires ? 40 : 4
  if (sign === 'sign-rooftop') return <Rooftop tag={tag} id={id} h={h} />
  return (
    <>
      {wires ? <Wires /> : null}
      {sign === 'sign-led' ? (
        <Led tag={tag} id={id} top={top} />
      ) : sign === 'sign-marquee' ? (
        <Marquee tag={tag} id={id} top={top} />
      ) : sign === 'sign-liftoff' ? (
        <Liftoff tag={tag} id={id} top={top} />
      ) : sign === 'sign-cold-snap' ? (
        <ColdSnap tag={tag} id={id} top={top} />
      ) : (
        <Neon tag={tag} id={id} top={top} />
      )}
    </>
  )
}

const WORDS: Record<string, string> = {
  sign: 'in neon',
  'sign-led': 'on an LED board',
  'sign-marquee': 'in marquee lights',
  'sign-rooftop': 'in neon on a rooftop',
  'sign-liftoff': 'in lights beside a rocket lifting off',
  'sign-cold-snap': 'in lights, hung with icicles',
}

/** A sign from the wall with a tag on it: `sign` is its prize id. */
export function SignArt({ sign, name, width = 400, wires = true }: { sign: string; name: string; width?: number; wires?: boolean }) {
  const id = `sg${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const tag = name.trim().toUpperCase() || 'YOU'
  const h = signHeight(wires)
  return (
    <svg
      viewBox={`0 0 ${SIGN_W} ${h}`}
      width={width}
      height={(width * h) / SIGN_W}
      role="img"
      aria-label={`${tag} ${WORDS[sign] ?? 'in lights'}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <SignDrawing sign={sign} name={name} id={id} wires={wires} />
    </svg>
  )
}
