import type { ReactNode } from 'react'

/*
 * The card themes from the prize counter, drawn to fill any box: the whole
 * back of a player card, the small card in a prize's panel, or the one on the
 * counter's shelf. `s` scales what's in them, so a big card doesn't get a
 * thousand tiny squiggles. The two drawn from games follow those games' own
 * pictures (components/GameArt.tsx): Frenzy's fish, Asteroids' rocks and ship,
 * Fireflies' lanterns and lake.
 */

type ThemeProps = { w: number; h: number; s: number; id: string }

/** Seeded, so a drawing is the same every time it's drawn. */
function seeded(seed: number) {
  let v = seed
  return () => {
    v = (v * 1103515245 + 12345) % 2147483648
    return v / 2147483648
  }
}

const f1 = (v: number) => v.toFixed(1)

/**
 * How big the things in a scene are: its scale, or more on a big card, so the
 * fish and rocks and lanterns behind a whole player card aren't specks.
 */
const sizeOf = (s: number, h: number, per: number) => Math.max(s, h / per)

/** Stars scattered over a box, as one path. */
function starPath(w: number, h: number, count: number, r: number, seed: number) {
  const rnd = seeded(seed)
  let d = ''
  for (let i = 0; i < count; i++) {
    const x = rnd() * w
    const y = rnd() * h
    const rr = r * (0.5 + rnd() * 0.8)
    d += `M${f1(x - rr)} ${f1(y)}a${rr.toFixed(2)} ${rr.toFixed(2)} 0 1 0 ${(2 * rr).toFixed(2)} 0a${rr.toFixed(2)} ${rr.toFixed(2)} 0 1 0 ${(-2 * rr).toFixed(2)} 0Z`
  }
  return d
}

/* ---------- the arcade carpet ---------- */

const CARPET_COLOURS = ['#ff4fa8', '#2fe3cf', '#ffd23f', '#6c8cff', '#b86bff']

/** The old arcade carpet: neon squiggles, bolts, rings and triangles on deep purple. */
function Carpet({ w, h, s }: ThemeProps) {
  const rnd = seeded(23)
  const bits: ReactNode[] = []
  const step = 26 * s
  let row = 0
  for (let y = step / 3; y < h + step / 2; y += step * 0.86, row++) {
    for (let x = (row % 2 ? step / 2 : 0) + step / 4; x < w + step / 2; x += step) {
      const kind = Math.floor(rnd() * 5)
      const c = CARPET_COLOURS[Math.floor(rnd() * CARPET_COLOURS.length)]!
      const rot = Math.floor(rnd() * 360)
      const cx = x + (rnd() - 0.5) * step * 0.4
      const cy = y + (rnd() - 0.5) * step * 0.4
      const key = `${row}-${Math.round(x)}`
      const at = `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${rot})`
      const line = { fill: 'none', stroke: c, strokeWidth: 2.2 * s, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
      if (kind === 0) bits.push(<path key={key} transform={at} d={`M${-9 * s} 0q${3 * s} ${-5 * s} ${6 * s} 0t${6 * s} 0t${6 * s} 0`} {...line} />)
      else if (kind === 1) bits.push(<path key={key} transform={at} d={`M${-7 * s} ${-4 * s}L${-1 * s} ${-1.2 * s}L${-3 * s} ${2 * s}L${7 * s} ${4.5 * s}`} {...line} />)
      else if (kind === 2) bits.push(<circle key={key} transform={at} r={4.4 * s} {...line} />)
      else if (kind === 3) bits.push(<path key={key} transform={at} d={`M0 ${-5 * s}L${5 * s} ${4 * s}L${-5 * s} ${4 * s}Z`} {...line} />)
      else
        bits.push(
          <g key={key} transform={at}>
            <circle r={1.2 * s} fill="#fff" opacity="0.8" />
            <circle cx={5 * s} cy={2 * s} r={1.1 * s} fill={c} />
            <circle cx={-4 * s} cy={3.5 * s} r={s} fill={c} />
          </g>,
        )
    }
  }
  return (
    <>
      <rect width={w} height={h} fill="#170c2e" />
      {bits}
    </>
  )
}

/* ---------- Frenzy's aquarium ---------- */

/** A Frenzy fish, its mouth at +x. */
export function Fish({ x, y, scale, hue, flip = false, glow = false }: { x: number; y: number; scale: number; hue: number; flip?: boolean; glow?: boolean }) {
  const stroke = `hsl(${hue} 80% 64%)`
  const wash = `hsl(${hue} 80% 64% / ${glow ? 0.5 : 0.34})`
  const fin = { fill: wash, stroke, strokeWidth: 1, strokeLinejoin: 'round' as const }
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}>
      <path d="M-7.2 0 L-12.6 -5 Q-10.8 0 -12.6 5 Z" {...fin} />
      <path d="M-3.8 -5.2 L-0.8 -9.6 L2.8 -6.5 Z" {...fin} />
      <path
        d="M8.6 -1.4 C7.4 -6.2 -0.6 -7.4 -5 -4.6 C-7 -3.3 -8.4 -1.4 -8.4 0 C-8.4 1.4 -7 3.3 -5 4.6 C-0.6 7.4 7.4 6.2 8.6 1.4 L5.8 0 Z"
        {...fin}
        strokeWidth={1.1}
      />
      <circle cx="3.6" cy="-2.4" r="1.4" fill="#fff" />
      <circle cx="3.9" cy="-2.3" r="0.7" fill="#1a2b3c" />
    </g>
  )
}

/** Frenzy's water behind the card: light coming down, fish, bubbles. */
function Aquarium({ w, h, s, id }: ThemeProps) {
  const k = sizeOf(s, h, 180)
  return (
    <>
      <defs>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c5f80" />
          <stop offset="1" stopColor="#0a2236" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#${id}w)`} />
      {[0.16, 0.44, 0.72].map((rx) => (
        <path key={rx} d={`M${w * rx} 0 L${w * rx + 10 * s} 0 L${w * rx + 34 * s} ${h} L${w * rx + 16 * s} ${h} Z`} fill="#fff" opacity="0.06" />
      ))}
      <Fish x={w * 0.34} y={h * 0.4} scale={0.95 * k} hue={295} glow />
      <Fish x={w * 0.74} y={h * 0.26} scale={0.7 * k} hue={205} flip />
      <Fish x={w * 0.64} y={h * 0.62} scale={0.55 * k} hue={40} />
      <Fish x={w * 0.14} y={h * 0.68} scale={0.5 * k} hue={175} flip />
      {[
        [0.52, 0.2, 1.6],
        [0.55, 0.12, 1.1],
        [0.9, 0.56, 1.4],
        [0.24, 0.22, 1.2],
      ].map(([bx, by, br]) => (
        <circle key={`${bx}-${by}`} cx={w * bx!} cy={h * by!} r={br! * k * 1.4} fill="none" stroke="#fff" strokeWidth={0.7 * Math.max(1, k / 2)} opacity="0.45" />
      ))}
    </>
  )
}

/* ---------- a checked floor ---------- */

/** A floor seen from standing on it: rows from the bottom edge into the distance, as how far off each is. */
const FLOOR_DEPTHS = [1, 1.32, 1.75, 2.3, 3.05, 4.05, 5.4, 7.2, 9.6, 13]

function Checker({ w, h, s, id }: ThemeProps) {
  const hy = h * 0.4
  const vx = w * 0.62
  const tile = 92 * s
  const n = Math.ceil(Math.max(vx, w - vx) / tile) + 1
  let light = ''
  for (let j = 0; j < FLOOR_DEPTHS.length - 1; j++) {
    const z0 = FLOOR_DEPTHS[j]!
    const z1 = FLOOR_DEPTHS[j + 1]!
    const y0 = hy + (h - hy) / z0
    const y1 = hy + (h - hy) / z1
    for (let i = -n; i < n; i++) {
      if ((((i + j) % 2) + 2) % 2) continue
      const xa = vx + i * tile
      const xb = xa + tile
      light += `M${f1(vx + (xa - vx) / z0)} ${f1(y0)}L${f1(vx + (xb - vx) / z0)} ${f1(y0)}L${f1(vx + (xb - vx) / z1)} ${f1(y1)}L${f1(vx + (xa - vx) / z1)} ${f1(y1)}Z`
    }
  }
  const stripe = (y: number, colour: string, core: string) => (
    <>
      <path d={`M0 ${f1(y)}H${w}`} stroke={colour} strokeWidth={9 * s} opacity="0.22" />
      <path d={`M0 ${f1(y)}H${w}`} stroke={colour} strokeWidth={2.6 * s} />
      <path d={`M0 ${f1(y)}H${w}`} stroke={core} strokeWidth={0.9 * s} />
    </>
  )
  return (
    <>
      <defs>
        <linearGradient id={`${id}wall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a1a4e" />
          <stop offset="1" stopColor="#150e2a" />
        </linearGradient>
        <linearGradient id={`${id}fog`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#150e2a" stopOpacity="1" />
          <stop offset="1" stopColor="#150e2a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width={w} height={hy} fill={`url(#${id}wall)`} />
      <rect y={hy} width={w} height={h - hy} fill="#1b1430" />
      <path d={light} fill="#e7e1f1" />
      <rect y={hy} width={w} height={(h - hy) * 0.55} fill={`url(#${id}fog)`} />
      {stripe(h * 0.13, '#2fe3cf', '#d7fffa')}
      {stripe(hy - 5 * s, '#ff4fa8', '#ffd6ea')}
    </>
  )
}

/* ---------- a sunset over a neon grid ---------- */

function Sunset({ w, h, s, id }: ThemeProps) {
  const hy = h * 0.62
  const r = Math.min(h * 0.4, w * 0.2)
  const cx = w * 0.66
  const cy = hy - r * 0.2
  const vx = cx
  const bars: ReactNode[] = []
  // Bars cut across the sun's lower half, thicker toward the horizon.
  for (let k = 0; k < 5; k++) {
    const y = cy - r * 0.34 + k * r * 0.12
    bars.push(<rect key={k} x={cx - r - 2} y={f1(y)} width={2 * r + 4} height={f1(r * (0.022 + k * 0.016))} fill="#000" />)
  }
  let grid = ''
  for (const z of [1, 1.35, 1.85, 2.6, 3.7, 5.4, 8, 12]) grid += `M0 ${f1(hy + (h - hy) / z)}H${w}`
  const step = 70 * s
  const n = Math.ceil(Math.max(vx, w - vx) / (step * 0.2)) + 1
  for (let i = -n; i <= n; i++) grid += `M${f1(vx + i * step * 0.2)} ${f1(hy)}L${f1(vx + i * step * 2.6)} ${f1(h + step)}`
  return (
    <>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#12082e" />
          <stop offset="0.6" stopColor="#3a1466" />
          <stop offset="1" stopColor="#c23a86" />
        </linearGradient>
        <linearGradient id={`${id}sun`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe27a" />
          <stop offset="0.55" stopColor="#ff8a4a" />
          <stop offset="1" stopColor="#ff3f8e" />
        </linearGradient>
        <linearGradient id={`${id}fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#12062a" stopOpacity="0.95" />
          <stop offset="1" stopColor="#12062a" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}m`}>
          <rect width={w} height={h} fill="#fff" />
          {bars}
        </mask>
        <clipPath id={`${id}ground`}>
          <rect y={hy} width={w} height={h - hy} />
        </clipPath>
      </defs>
      <rect width={w} height={hy} fill={`url(#${id}sky)`} />
      <path d={starPath(w, hy * 0.6, Math.round((w * hy) / (2600 * s * s)), 1.1 * s, 5)} fill="#fff" opacity="0.7" />
      <circle cx={cx} cy={cy} r={r * 1.18} fill="#ff4f8b" opacity="0.18" />
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id}sun)`} mask={`url(#${id}m)`} />
      <rect y={hy} width={w} height={h - hy} fill="#12062a" />
      <g clipPath={`url(#${id}ground)`}>
        <path d={grid} stroke="#ff4fa8" strokeWidth={5 * s} opacity="0.2" fill="none" />
        <path d={grid} stroke="#ff6fb8" strokeWidth={1.5 * s} fill="none" />
        <rect y={hy} width={w} height={(h - hy) * 0.4} fill={`url(#${id}fade)`} />
      </g>
      <path d={`M0 ${f1(hy)}H${w}`} stroke="#ffb3d9" strokeWidth={1.6 * s} />
    </>
  )
}

/* ---------- Asteroids' rocks, drifting ---------- */

/** A rock's outline, as Asteroids draws them, around (0, 0) at radius 1. */
const ROCK: [number, number][] = [
  [-0.66, -0.89],
  [0.2, -1.03],
  [0.86, -0.51],
  [0.97, 0.26],
  [0.49, 0.94],
  [-0.34, 1.03],
  [-0.94, 0.51],
  [-1, -0.26],
]

/** Where the rocks are in the box, how big, in which of the game's colours, and turned how far. */
const ROCKS: [number, number, number, [number, number, number], number][] = [
  [0.56, 0.3, 40, [176, 58, 60], 10],
  [0.84, 0.64, 56, [176, 58, 60], -24],
  [0.95, 0.16, 26, [10, 64, 64], 40],
  [0.7, 0.86, 20, [40, 82, 60], 12],
  [0.4, 0.8, 24, [176, 58, 60], 70],
  [0.24, 0.2, 18, [176, 58, 60], -40],
  [0.1, 0.72, 30, [10, 64, 64], 15],
  [0.44, 0.1, 13, [40, 82, 60], 0],
]

const hsl = (h: number, sat: number, l: number, a = 1) => `hsl(${h} ${sat}% ${l}% / ${a})`

function AsteroidBelt({ w, h, s, id }: ThemeProps) {
  const k = sizeOf(s, h, 260)
  return (
    <>
      <defs>
        <linearGradient id={`${id}space`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#17213a" />
          <stop offset="1" stopColor="#0b111b" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#${id}space)`} />
      <path d={starPath(w, h, Math.round((w * h) / (2200 * s * s)), 1.1 * s, 11)} fill="#fff" opacity="0.65" />
      {ROCKS.map(([fx, fy, size, [hu, sa, li], rot]) => {
        const r = size * k
        const d = `M${ROCK.map(([x, y]) => `${f1(x * r)} ${f1(y * r)}`).join('L')}Z`
        return (
          <g key={`${fx}-${fy}`} transform={`translate(${f1(fx * w)} ${f1(fy * h)}) rotate(${rot})`}>
            <path d={d} fill={hsl(hu, sa, li, 0.26)} stroke={hsl(hu, sa, li)} strokeWidth={1.8 * k} strokeLinejoin="round" />
            {size > 22 ? (
              <>
                <circle cx={r * 0.1} cy={-r * 0.12} r={r * 0.28} fill={hsl(hu, sa, li, 0.2)} stroke={hsl(hu, sa, li)} strokeWidth={1.1 * k} />
                <circle cx={-r * 0.34} cy={r * 0.44} r={r * 0.15} fill={hsl(hu, sa, li, 0.2)} stroke={hsl(hu, sa, li)} strokeWidth={k} />
              </>
            ) : null}
          </g>
        )
      })}
      <path d={`M${f1(w * 0.44)} ${f1(h * 0.5)}l${f1(9 * k)} ${f1(-5 * k)}M${f1(w * 0.49)} ${f1(h * 0.44)}l${f1(9 * k)} ${f1(-5 * k)}`} stroke={hsl(204, 95, 72)} strokeWidth={2.6 * k} strokeLinecap="round" />
      <g transform={`translate(${f1(w * 0.34)} ${f1(h * 0.6)}) rotate(-30) scale(${(4.4 * k).toFixed(2)})`}>
        <path d="M-3 -1.3 L-7.4 0 L-3 1.3 Z" fill="#f2813a" opacity="0.9" />
        <path d="M-3 -0.7 L-5.6 0 L-3 0.7 Z" fill="#ffd37a" />
        <path d="M4.6 0 L-3.6 -3.3 L-2.1 0 L-3.6 3.3 Z" fill={hsl(236, 74, 70, 0.36)} stroke={hsl(236, 74, 70)} strokeWidth="0.45" strokeLinejoin="round" />
        <path d="M3 -0.35 L-1.6 -1.9" stroke="#fff" strokeWidth="0.3" strokeLinecap="round" opacity="0.55" />
      </g>
    </>
  )
}

/* ---------- Fireflies' lake at night ---------- */

function FireflyLake({ w, h, s, id }: ThemeProps) {
  const k = sizeOf(s, h, 260)
  const hy = h * 0.58
  const rnd = seeded(41)
  // The string of lanterns sags across the top.
  const y0 = h * 0.08
  const mid = h * 0.24
  const cy = 2 * mid - y0
  const at = (t: number): [number, number] => {
    const x = (1 - t) * (1 - t) * -10 + 2 * (1 - t) * t * (w / 2) + t * t * (w + 10)
    const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y0
    return [x, y]
  }
  const count = Math.max(4, Math.round(w / (150 * k)))
  const lanterns = Array.from({ length: count }, (_, i) => at((i + 0.5) / count))
  let trees = `M0 ${f1(hy)}`
  for (let x = 0; x <= w + 20 * s; x += 16 * s) trees += `L${f1(x)} ${f1(hy - (6 + rnd() * 22) * s)}L${f1(x + 8 * s)} ${f1(hy - rnd() * 8 * s)}`
  trees += `L${w} ${f1(hy)}Z`
  let ripples = ''
  for (let i = 0; i < 9; i++) {
    const y = hy + (h - hy) * (0.12 + i * 0.1)
    const x = rnd() * w * 0.8
    ripples += `M${f1(x)} ${f1(y)}h${f1((40 + rnd() * 90) * s)}`
  }
  const flies: [number, number, string][] = [
    [0.52, 0.72, 'y'],
    [0.78, 0.8, 'y'],
    [0.9, 0.62, 'c'],
    [0.64, 0.5, 'y'],
    [0.36, 0.86, 'p'],
    [0.22, 0.64, 'y'],
    [0.96, 0.9, 'p'],
    [0.7, 0.66, 'c'],
  ]
  const core: Record<string, string> = { y: '#fff4c2', p: '#ffd0ea', c: '#d4fbff' }
  return (
    <>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1540" />
          <stop offset="1" stopColor="#3d2c68" />
        </linearGradient>
        <linearGradient id={`${id}lake`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#261e4e" />
          <stop offset="1" stopColor="#120e2a" />
        </linearGradient>
        {(
          [
            ['o', '#f4a64a'],
            ['y', '#ffe27a'],
            ['p', '#e86bb0'],
            ['c', '#5ee0e6'],
          ] as const
        ).map(([name, c]) => (
          <radialGradient key={name} id={`${id}${name}`}>
            <stop offset="0" stopColor={c} stopOpacity="0.7" />
            <stop offset="1" stopColor={c} stopOpacity="0" />
          </radialGradient>
        ))}
        <mask id={`${id}moon`}>
          <rect width={w} height={h} fill="#fff" />
          <circle cx={w * 0.93 + 9 * k} cy={h * 0.34 - 6 * k} r={14 * k} fill="#000" />
        </mask>
      </defs>
      <rect width={w} height={hy} fill={`url(#${id}sky)`} />
      <path d={starPath(w, hy * 0.85, Math.round((w * hy) / (2600 * s * s)), 1 * s, 3)} fill="#fff" opacity="0.6" />
      <circle cx={w * 0.93} cy={h * 0.34} r={15 * k} fill="#f3ecd2" mask={`url(#${id}moon)`} />
      <path d={`M-10 ${f1(y0)}Q${f1(w / 2)} ${f1(cy)} ${w + 10} ${f1(y0)}`} fill="none" stroke="hsl(40 30% 72% / 0.45)" strokeWidth={1.2 * s} />
      {lanterns.map(([x, y]) => (
        <g key={`${f1(x)}`}>
          <circle cx={x} cy={y + 12 * k} r={30 * k} fill={`url(#${id}o)`} />
          <path d={`M${f1(x)} ${f1(y)}V${f1(y + 3 * k)}`} stroke="hsl(40 30% 72% / 0.6)" strokeWidth={k} />
          <rect x={x - 6 * k} y={y + 3 * k} width={12 * k} height={16 * k} rx={5 * k} fill="#f6b25a" />
        </g>
      ))}
      <path d={trees} fill="#150f2c" />
      <rect y={hy} width={w} height={h - hy} fill={`url(#${id}lake)`} />
      <path d={ripples} stroke="hsl(262 40% 72% / 0.16)" strokeWidth={1.4 * s} strokeLinecap="round" />
      {lanterns.map(([x]) => (
        <path key={`r${f1(x)}`} d={`M${f1(x)} ${f1(hy + 6 * k)}V${f1(hy + 34 * k)}`} stroke="#f4a64a" strokeWidth={5 * k} strokeLinecap="round" opacity="0.22" />
      ))}
      {[
        [0.3, 0.78, 22],
        [0.82, 0.92, 18],
        [0.58, 0.9, 14],
      ].map(([fx, fy, r]) => (
        <g key={`${fx}`}>
          <ellipse cx={fx! * w} cy={fy! * h} rx={r! * k} ry={r! * k * 0.32} fill="#2f6b4a" opacity="0.85" />
          <path d={`M${f1(fx! * w)} ${f1(fy! * h)}l${f1(r! * k * 0.9)} ${f1(-r! * k * 0.12)}`} stroke="#150f2c" strokeWidth={1.4 * k} />
        </g>
      ))}
      {flies.map(([fx, fy, kind]) => (
        <g key={`${fx}-${fy}`}>
          <circle cx={fx * w} cy={fy * h} r={16 * k} fill={`url(#${id}${kind})`} />
          <circle cx={fx * w} cy={fy * h} r={2.2 * k} fill={core[kind]} />
        </g>
      ))}
    </>
  )
}

/** A card theme's drawing, filling a w × h box. */
export function ThemeDrawing({ theme, w, h, s, id }: ThemeProps & { theme: string }) {
  switch (theme) {
    case 'cd-aquarium':
      return <Aquarium w={w} h={h} s={s} id={id} />
    case 'cd-checker':
      return <Checker w={w} h={h} s={s} id={id} />
    case 'cd-sunset':
      return <Sunset w={w} h={h} s={s} id={id} />
    case 'cd-asteroids':
      return <AsteroidBelt w={w} h={h} s={s} id={id} />
    case 'cd-fireflies':
      return <FireflyLake w={w} h={h} s={s} id={id} />
    default:
      return <Carpet w={w} h={h} s={s} id={id} />
  }
}
