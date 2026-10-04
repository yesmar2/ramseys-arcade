import type { ReactNode } from 'react'

/*
 * Season 1's card themes (Space Race, its pass), drawn to fill any box as the counter's themes are
 * (CardThemes.tsx): a deep field of stars with a ringed planet, the launch pad at dusk, and a nebula.
 * Its Pass+ adds mission control, a porthole looking down on the Earth, and a space station over it.
 */

type ThemeProps = { w: number; h: number; s: number; id: string }

function seeded(seed: number) {
  let v = seed
  return () => {
    v = (v * 1103515245 + 12345) % 2147483648
    return v / 2147483648
  }
}

const f1 = (v: number) => v.toFixed(1)
const sizeOf = (s: number, h: number, per: number) => Math.max(s, h / per)

function stars(w: number, h: number, count: number, r: number, seed: number) {
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

function sparkle(x: number, y: number, s: number) {
  const k = s * 0.18
  return `M${f1(x)} ${f1(y - s)}Q${f1(x + k)} ${f1(y - k)} ${f1(x + s)} ${f1(y)}Q${f1(x + k)} ${f1(y + k)} ${f1(x)} ${f1(y + s)}Q${f1(x - k)} ${f1(y + k)} ${f1(x - s)} ${f1(y)}Q${f1(x - k)} ${f1(y - k)} ${f1(x)} ${f1(y - s)}Z`
}

/** Deep field: a night full of stars, a ringed planet at its edge and a small moon. */
export function DeepField({ w, h, s, id }: ThemeProps) {
  const k = sizeOf(s, h, 120)
  const px = w * 0.88
  const py = h * 0.24
  const pr = 22 * k
  return (
    <>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#0b1030" />
          <stop offset="1" stopColor="#1c2150" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#${id}sky)`} />
      <path d={stars(w, h, Math.round((w * h) / (900 * s * s)), 1.1 * s, 11)} fill="#f4f0ff" opacity="0.75" />
      <path d={`${sparkle(w * 0.62, h * 0.14, 3.5 * k)}${sparkle(w * 0.72, h * 0.66, 3 * k)}`} fill="#f5b942" />
      <ellipse cx={px} cy={py} rx={pr * 1.85} ry={pr * 0.42} fill="none" stroke="#c98a1c" strokeWidth={3 * k} transform={`rotate(-14 ${f1(px)} ${f1(py)})`} />
      <circle cx={px} cy={py} r={pr} fill="#8a6ad4" />
      <path d={`M${f1(px - pr * 0.9)} ${f1(py - pr * 0.3)}Q${f1(px)} ${f1(py - pr * 0.6)} ${f1(px + pr * 0.95)} ${f1(py - pr * 0.15)}`} stroke="#b49cec" strokeWidth={4 * k} fill="none" opacity="0.5" />
      <path d={`M${f1(px - pr * 1.85)} ${f1(py)}A${f1(pr * 1.85)} ${f1(pr * 0.42)} 0 0 0 ${f1(px + pr * 1.85)} ${f1(py)}`} fill="none" stroke="#f5b942" strokeWidth={3 * k} transform={`rotate(-14 ${f1(px)} ${f1(py)})`} />
      <circle cx={w * 0.7} cy={h * 0.44} r={6 * k} fill="#d9d4f0" />
      <circle cx={w * 0.7 - 1.7 * k} cy={h * 0.44 - 1.4 * k} r={1.6 * k} fill="#b8b2d8" />
    </>
  )
}

/** Launch pad: the gantry and the rocket on the pad at dusk, smoke at its foot, stars coming out. */
export function LaunchPad({ w, h, id }: ThemeProps) {
  // Everything goes by the rocket, about two fifths of the card's height, whatever the card's size.
  const k = (h * 0.4) / 46 / 2.3
  const s = Math.max(0.4, k)
  const ground = h * 0.84
  const rx = w * 0.56
  const rh = 52 * k
  const gx = rx - 26 * k
  let lattice = ''
  for (let y = ground - rh * 1.3; y < ground; y += 7 * k) lattice += `M${f1(gx - 8 * k)} ${f1(y)}L${f1(gx)} ${f1(y + 7 * k)}M${f1(gx)} ${f1(y)}L${f1(gx - 8 * k)} ${f1(y + 7 * k)}`
  const rnd = seeded(5)
  const puffs = Array.from({ length: 9 }, (_, i) => ({
    x: rx + (i - 4) * 9 * k + (rnd() - 0.5) * 6 * k,
    y: ground - (2 + rnd() * 6) * k,
    r: (7 + rnd() * 7) * k,
  }))
  return (
    <>
      <defs>
        <linearGradient id={`${id}dusk`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#101634" />
          <stop offset="0.7" stopColor="#3a2f6e" />
          <stop offset="1" stopColor="#8a4a6e" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#${id}dusk)`} />
      <path d={stars(w, h * 0.55, Math.round((w * h) / (2200 * s * s)), 1 * s, 17)} fill="#f4f0ff" opacity="0.7" />
      <rect y={ground} width={w} height={h - ground} fill="#151a36" />
      <rect x={gx - 9 * k} y={ground - rh * 1.3} width={10 * k} height={rh * 1.3} fill="none" stroke="#5a5f8e" strokeWidth={1.4 * k} />
      <path d={lattice} stroke="#5a5f8e" strokeWidth={1 * k} />
      <path d={`M${f1(gx)} ${f1(ground - rh * 0.9)}H${f1(rx - 7 * k)}`} stroke="#5a5f8e" strokeWidth={2 * k} />
      <g transform={`translate(${f1(rx)} ${f1(ground - rh * 0.56)}) scale(${(k * 2.3).toFixed(3)})`}>
        <path d="M0 -22 C8 -14 8 2 6 12 H-6 C-8 2 -8 -14 0 -22z" fill="#f4f0ff" />
        <circle cx="0" cy="-6" r="3.4" fill="#6b74e8" />
        <path d="M-6 4 L-12 16 L-6 13z M6 4 L12 16 L6 13z" fill="#e8564f" />
        <path d="M-4 12 L0 22 L4 12z" fill="#f5b942" />
      </g>
      {puffs.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="#e9e4f7" opacity={0.75 - (i % 3) * 0.12} />
      ))}
      <path d={`M0 ${f1(ground)}H${w}`} stroke="#f2813a" strokeWidth={1.5 * k} opacity="0.7" />
    </>
  )
}

/** Nebula: clouds of pink, violet and blue, stars being born in them. */
export function NebulaCard({ w, h, s, id }: ThemeProps) {
  const k = sizeOf(s, h, 110)
  const clouds: [number, number, number, string][] = [
    [0.22, 0.4, 70, '#e85d9a'],
    [0.6, 0.62, 90, '#8a6ad4'],
    [0.82, 0.28, 60, '#6b74e8'],
    [0.4, 0.15, 50, '#c65bd9'],
  ]
  return (
    <>
      <defs>
        {clouds.map(([, , , c], i) => (
          <radialGradient key={i} id={`${id}c${i}`}>
            <stop offset="0" stopColor={c} stopOpacity="0.55" />
            <stop offset="1" stopColor={c} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      <rect width={w} height={h} fill="#120d2e" />
      {clouds.map(([fx, fy, r], i) => (
        <ellipse key={i} cx={fx * w} cy={fy * h} rx={r * k * 1.4} ry={r * k} fill={`url(#${id}c${i})`} />
      ))}
      <path d={stars(w, h, Math.round((w * h) / (1100 * s * s)), 1 * s, 29)} fill="#f4f0ff" opacity="0.7" />
      <path d={`${sparkle(w * 0.58, h * 0.4, 4 * k)}${sparkle(w * 0.7, h * 0.62, 3.2 * k)}${sparkle(w * 0.84, h * 0.22, 2.6 * k)}`} fill="#ffffff" />
    </>
  )
}

/** A point on a cubic curve, for the craft on its way to the moon. */
function onCurve(t: number, a: number[], b: number[], c: number[], d: number[]): [number, number] {
  const u = 1 - t
  const at = (i: number) => u * u * u * a[i]! + 3 * u * u * t * b[i]! + 3 * u * t * t * c[i]! + t * t * t * d[i]!
  return [at(0), at(1)]
}

/** What a small screen on the wall shows: lines of readout, a bar chart, a trace, or a scope. */
function readout(kind: number, x: number, y: number, sw: number, sh: number, k: number, rnd: () => number): ReactNode {
  const line = { strokeWidth: 2.4 * k, strokeLinecap: 'round' as const }
  if (kind === 0) {
    let green = ''
    for (let i = 0; i < 4; i++) {
      const ly = y + sh * (0.24 + i * 0.17)
      green += `M${f1(x + sw * 0.1)} ${f1(ly)}h${f1(sw * (0.25 + rnd() * 0.5))}`
    }
    return (
      <>
        <path d={green} stroke="#5fe0c8" opacity="0.8" {...line} />
        <path d={`M${f1(x + sw * 0.66)} ${f1(y + sh * 0.24)}h${f1(sw * 0.2)}`} stroke="#f2813a" {...line} />
      </>
    )
  }
  if (kind === 1) {
    const bars: ReactNode[] = []
    for (let i = 0; i < 6; i++) {
      const bh = sh * (0.15 + rnd() * 0.55)
      bars.push(<rect key={i} x={x + sw * (0.12 + i * 0.13)} y={y + sh * 0.84 - bh} width={sw * 0.08} height={bh} fill={i === 3 ? '#f5b942' : '#f2813a'} opacity="0.85" />)
    }
    return <>{bars}</>
  }
  if (kind === 2) {
    let trace = ''
    const phase = rnd() * 6
    for (let i = 0; i <= 20; i++) {
      const tx = x + sw * (0.08 + (i / 20) * 0.84)
      const ty = y + sh * (0.55 + Math.sin(phase + i * 0.9) * 0.22 * Math.sin((i / 20) * Math.PI))
      trace += `${i ? 'L' : 'M'}${f1(tx)} ${f1(ty)}`
    }
    return (
      <>
        <path d={`M${f1(x + sw * 0.08)} ${f1(y + sh * 0.55)}h${f1(sw * 0.84)}`} stroke="#5fe0c8" strokeWidth={k} opacity="0.3" />
        <path d={trace} fill="none" stroke="#5fe0c8" strokeWidth={1.8 * k} strokeLinejoin="round" />
      </>
    )
  }
  const cx = x + sw / 2
  const cy = y + sh / 2
  const r = sh * 0.36
  const a = rnd() * Math.PI * 2
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#8a6ad4" strokeWidth={1.4 * k} />
      <circle cx={cx} cy={cy} r={r * 0.5} fill="none" stroke="#8a6ad4" strokeWidth={k} opacity="0.6" />
      <path d={`M${f1(cx - r)} ${f1(cy)}h${f1(2 * r)}M${f1(cx)} ${f1(cy - r)}v${f1(2 * r)}`} stroke="#8a6ad4" strokeWidth={k} opacity="0.6" />
      <path d={`M${f1(cx)} ${f1(cy)}L${f1(cx + Math.cos(a) * r)} ${f1(cy + Math.sin(a) * r)}`} stroke="#5fe0c8" strokeWidth={1.6 * k} />
      <circle cx={cx + Math.cos(a + 2) * r * 0.62} cy={cy + Math.sin(a + 2) * r * 0.62} r={2.6 * k} fill="#f5b942" />
    </>
  )
}

/**
 * Mission control: the room darkened, its wall of screens lit. The big one plots the way to the moon,
 * another the ground track over a map, one counts down, and the rest are readouts; the desks and the
 * people at them sit dark along the bottom.
 */
export function MissionControl({ w, h, id }: ThemeProps) {
  // Everything goes by a screen's height, a quarter of the card's, whatever the card's size.
  const sh = h * 0.25
  const g = h * 0.04
  const sw = sh * 1.4
  const p = sw + g
  const k = sh / 60
  const rows = [h * 0.07, h * 0.07 + sh + g]
  const n = Math.ceil(w / p) + 1
  const x0 = (w - (n * p - g)) / 2
  // The big screen is two across and two high, its middle about seven tenths of the way over, always whole.
  const main = Math.max(0, Math.min(Math.round((w * 0.7 - x0 - p + g / 2) / p), Math.floor((w + g - x0) / p) - 2))
  const colX = (c: number) => x0 + c * p
  const rnd = seeded(37)

  const frame = (x: number, y: number, fw: number, fh: number, fill: string) => (
    <rect x={x} y={y} width={fw} height={fh} rx={3 * k} fill={fill} stroke="#2e3a78" strokeWidth={2 * k} />
  )

  // The big screen: Earth in its parking orbit, the moon on its own, and the way out to it.
  const mx = colX(main)
  const my = rows[0]!
  const mw = 2 * sw + g
  const mh = 2 * sh + g
  const ex = mx + mw * 0.28
  const ey = my + mh * 0.62
  const er = mh * 0.12
  const moonX = mx + mw * 0.8
  const moonY = my + mh * 0.3
  const moonR = mh * 0.065
  const reach = Math.hypot(moonX - ex, moonY - ey)
  // Out from the parking orbit in a long arc, under the moon and round its far side, and home.
  const way = [
    [ex + er * 1.5, ey - er * 0.6],
    [ex + mw * 0.26, ey + mh * 0.06],
    [moonX - mw * 0.04, moonY + mh * 0.4],
    [moonX + moonR * 0.4, moonY + moonR * 2],
  ]
  const craft = onCurve(0.58, way[0]!, way[1]!, way[2]!, way[3]!)
  let grid = ''
  for (let i = 1; i < 6; i++) grid += `M${f1(mx)} ${f1(my + (mh * i) / 6)}h${f1(mw)}M${f1(mx + (mw * i) / 6)} ${f1(my)}v${f1(mh)}`

  // The map: a ground track weaving over the continents.
  const ax = colX(main - 2)
  const ay = rows[0]!
  const aw = 2 * sw + g
  let lat = ''
  for (let i = 1; i < 4; i++) lat += `M${f1(ax)} ${f1(ay + (sh * i) / 4)}h${f1(aw)}`
  for (let i = 1; i < 8; i++) lat += `M${f1(ax + (aw * i) / 8)} ${f1(ay)}v${f1(sh)}`
  let track = ''
  for (let i = 0; i <= 32; i++) {
    const tx = ax + aw * (0.04 + (i / 32) * 0.92)
    track += `${i ? 'L' : 'M'}${f1(tx)} ${f1(ay + sh * (0.5 - 0.3 * Math.sin((i / 32) * Math.PI * 3 + 0.6)))}`
  }
  const dotT = 0.62
  const dot: [number, number] = [ax + aw * (0.04 + dotT * 0.92), ay + sh * (0.5 - 0.3 * Math.sin(dotT * Math.PI * 3 + 0.6))]
  const lands: [number, number, number, number, number][] = [
    [0.18, 0.4, 0.11, 0.24, -20],
    [0.3, 0.72, 0.06, 0.2, 15],
    [0.55, 0.36, 0.14, 0.2, 10],
    [0.6, 0.7, 0.05, 0.16, -10],
    [0.84, 0.55, 0.07, 0.14, 0],
  ]

  // The countdown, under the map.
  const cx = colX(main - 1)
  const cy = rows[1]!

  const screens: ReactNode[] = []
  for (let c = 0; c < n; c++) {
    for (let r = 0; r < 2; r++) {
      if (c === main || c === main + 1) continue
      if (r === 0 && (c === main - 2 || c === main - 1)) continue
      if (r === 1 && c === main - 1) continue
      const x = colX(c)
      const y = rows[r]!
      screens.push(
        <g key={`${c}-${r}`}>
          {frame(x, y, sw, sh, '#0a1028')}
          {readout((c + r * 3) % 4, x, y, sw, sh, k, rnd)}
        </g>,
      )
    }
  }

  const lights: ReactNode[] = []
  const desk = h * 0.7
  const lightColours = ['#5fe0c8', '#f2813a', '#e8564f', '#f5b942', '#5fe0c8']
  for (let x = sh * 0.3; x < w; x += sh * (0.16 + rnd() * 0.3)) {
    lights.push(<rect key={f1(x)} x={x} y={desk + sh * 0.07} width={sh * 0.07} height={sh * 0.035} rx={sh * 0.015} fill={lightColours[Math.floor(rnd() * lightColours.length)]} opacity={0.6 + rnd() * 0.4} />)
  }
  const people = [0.42, 0.63, 0.86].map((fx) => {
    const px = fx * w
    const top = desk + sh * 0.36
    const hr = sh * 0.17
    const hy = top - hr * 0.75
    return (
      <g key={fx}>
        <path
          d={`M${f1(px - sh * 0.44)} ${f1(h)}L${f1(px - sh * 0.4)} ${f1(top + sh * 0.2)}Q${f1(px - sh * 0.38)} ${f1(top)} ${f1(px - sh * 0.15)} ${f1(top)}H${f1(px + sh * 0.15)}Q${f1(px + sh * 0.38)} ${f1(top)} ${f1(px + sh * 0.4)} ${f1(top + sh * 0.2)}L${f1(px + sh * 0.44)} ${f1(h)}Z`}
          fill="#05071a"
        />
        <circle cx={px} cy={hy} r={hr} fill="#05071a" />
        <path d={`M${f1(px - hr * 1.05)} ${f1(hy)}A${f1(hr * 1.05)} ${f1(hr * 1.05)} 0 0 1 ${f1(px + hr * 1.05)} ${f1(hy)}`} fill="none" stroke="#3a4688" strokeWidth={2.2 * k} />
      </g>
    )
  })

  return (
    <>
      <defs>
        <linearGradient id={`${id}room`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#070a1c" />
          <stop offset="0.7" stopColor="#111737" />
          <stop offset="1" stopColor="#070a1c" />
        </linearGradient>
        <radialGradient id={`${id}glow`}>
          <stop offset="0" stopColor="#6b74e8" stopOpacity="0.3" />
          <stop offset="1" stopColor="#6b74e8" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}main`}>
          <rect x={mx} y={my} width={mw} height={mh} rx={3 * k} />
        </clipPath>
      </defs>
      <rect width={w} height={h} fill={`url(#${id}room)`} />
      <ellipse cx={mx + mw / 2} cy={my + mh / 2} rx={mw * 0.9} ry={mh * 0.8} fill={`url(#${id}glow)`} />
      {screens}
      {frame(mx, my, mw, mh, '#0b1438')}
      <g clipPath={`url(#${id}main)`}>
        <path d={grid} stroke="#2e3a78" strokeWidth={k} opacity="0.55" />
        <circle cx={ex} cy={ey} r={reach} fill="none" stroke="#8a6ad4" strokeWidth={1.4 * k} strokeDasharray={`${f1(4 * k)} ${f1(5 * k)}`} opacity="0.55" />
      </g>
      <ellipse cx={ex} cy={ey} rx={er * 1.75} ry={er * 0.7} fill="none" stroke="#8a6ad4" strokeWidth={1.6 * k} transform={`rotate(-14 ${f1(ex)} ${f1(ey)})`} />
      <circle cx={ex} cy={ey} r={er} fill="#6b74e8" />
      <path d={`M${f1(ex - er * 0.6)} ${f1(ey - er * 0.35)}q${f1(er * 0.4)} ${f1(-er * 0.35)} ${f1(er * 0.7)} ${f1(-er * 0.05)}t${f1(er * 0.5)} ${f1(er * 0.45)}`} fill="none" stroke="#5fe0c8" strokeWidth={3 * k} strokeLinecap="round" opacity="0.8" />
      <circle cx={moonX} cy={moonY} r={moonR} fill="#d9d4f0" />
      <circle cx={moonX - moonR * 0.3} cy={moonY - moonR * 0.25} r={moonR * 0.28} fill="#b8b2d8" />
      <path
        d={`M${way.map((pt, i) => `${i === 1 ? 'C' : ''}${f1(pt[0]!)} ${f1(pt[1]!)}`).join(' ')}A${f1(moonR * 2)} ${f1(moonR * 2)} 0 1 0 ${f1(moonX - moonR * 1.6)} ${f1(moonY - moonR * 1.2)}`}
        fill="none"
        stroke="#f2813a"
        strokeWidth={2 * k}
        strokeDasharray={`${f1(6 * k)} ${f1(4 * k)}`}
        strokeLinecap="round"
      />
      <circle cx={craft[0]} cy={craft[1]} r={7 * k} fill="#f5b942" opacity="0.3" />
      <path d={sparkle(craft[0], craft[1], 5 * k)} fill="#ffe7a3" />
      <path d={`M${f1(mx + mw * 0.05)} ${f1(my + mh * 0.09)}h${f1(mw * 0.16)}M${f1(mx + mw * 0.05)} ${f1(my + mh * 0.16)}h${f1(mw * 0.1)}`} stroke="#5fe0c8" strokeWidth={2.4 * k} strokeLinecap="round" opacity="0.8" />
      <path d={`M${f1(mx + mw * 0.82)} ${f1(my + mh * 0.88)}h${f1(mw * 0.12)}`} stroke="#f2813a" strokeWidth={2.4 * k} strokeLinecap="round" />
      {frame(ax, ay, aw, sh, '#061a1c')}
      <path d={lat} stroke="#5fe0c8" strokeWidth={k} opacity="0.2" />
      {lands.map(([fx, fy, rw, rh, rot]) => (
        <ellipse key={`${fx}-${fy}`} cx={ax + aw * fx} cy={ay + sh * fy} rx={aw * rw} ry={sh * rh} fill="#5fe0c8" opacity="0.18" transform={`rotate(${rot} ${f1(ax + aw * fx)} ${f1(ay + sh * fy)})`} />
      ))}
      <path d={track} fill="none" stroke="#f5b942" strokeWidth={1.8 * k} strokeDasharray={`${f1(5 * k)} ${f1(3 * k)}`} />
      <circle cx={dot[0]} cy={dot[1]} r={5 * k} fill="none" stroke="#f5b942" strokeWidth={1.4 * k} />
      <circle cx={dot[0]} cy={dot[1]} r={2.2 * k} fill="#ffe7a3" />
      {frame(cx, cy, sw, sh, '#07080f')}
      <path d={`M${f1(cx + sw * 0.11)} ${f1(cy + sh * 0.22)}h${f1(sw * 0.3)}`} stroke="#f2813a" strokeWidth={2.4 * k} strokeLinecap="round" opacity="0.7" />
      <text x={cx + sw / 2} y={cy + sh * 0.72} textAnchor="middle" fontFamily="Orbitron, ui-monospace, monospace" fontWeight={700} fontSize={sh * 0.34} textLength={sw * 0.78} lengthAdjust="spacingAndGlyphs" fill="none" stroke="#f2813a" strokeWidth={5 * k} opacity="0.35">
        T-00:10
      </text>
      <text x={cx + sw / 2} y={cy + sh * 0.72} textAnchor="middle" fontFamily="Orbitron, ui-monospace, monospace" fontWeight={700} fontSize={sh * 0.34} textLength={sw * 0.78} lengthAdjust="spacingAndGlyphs" fill="#ff9a52">
        T-00:10
      </text>
      <rect y={desk} width={w} height={h - desk} fill="#0b0f26" />
      <rect y={desk} width={w} height={sh * 0.18} fill="#1a2252" />
      <path d={`M0 ${f1(desk)}H${w}`} stroke="#3a4688" strokeWidth={2 * k} />
      <path d={`M0 ${f1(desk + sh * 0.18)}H${w}`} stroke="#f2813a" strokeWidth={1.4 * k} opacity="0.5" />
      {lights}
      {people}
    </>
  )
}

/* ---------- the Earth from orbit, for the porthole and the station ---------- */

/** Where the land is on the Earth's visible edge: across the span, down from the edge, how long, how deep, what colour. */
const EARTH_LAND: [number, number, number, number, string][] = [
  [0.1, 0.42, 0.55, 0.16, '#4f9a4a'],
  [0.2, 0.62, 0.3, 0.12, '#a8834a'],
  [0.46, 0.3, 0.42, 0.13, '#4f9a4a'],
  [0.58, 0.66, 0.36, 0.17, '#a8834a'],
  [0.68, 0.58, 0.3, 0.1, '#4f9a4a'],
  [0.86, 0.36, 0.4, 0.14, '#4f9a4a'],
]
/** Its cloud: bands along the edge from one point of the span to another, down from the edge; and swirls. */
const EARTH_CLOUD: [number, number, number][] = [
  [0.02, 0.3, 0.22],
  [0.36, 0.62, 0.5],
  [0.7, 0.98, 0.26],
  [0.14, 0.4, 0.8],
]
const EARTH_SWIRLS: [number, number, number][] = [
  [0.3, 0.38, 0.12],
  [0.8, 0.7, 0.1],
]

/**
 * The top of the Earth from orbit: a great disc centred at (ex, ey), radius R, of which the band `depth`
 * deep under its edge shows between x0 and x1. Ocean, land and cloud in it, the night coming on to the
 * right, and the air's thin blue line along the edge.
 */
function EarthLimb({ ex, ey, R, depth, x0, x1, k, id }: { ex: number; ey: number; R: number; depth: number; x0: number; x1: number; k: number; id: string }) {
  const edge = (x: number) => ey - Math.sqrt(Math.max(0, R * R - (x - ex) * (x - ex)))
  const tilt = (x: number) => (Math.atan2(x - ex, Math.sqrt(Math.max(1, R * R - (x - ex) * (x - ex)))) * 180) / Math.PI
  const at = (u: number) => x0 + u * (x1 - x0)
  const along = (u0: number, u1: number, v: number) => {
    let d = ''
    for (let i = 0; i <= 12; i++) {
      const x = at(u0 + ((u1 - u0) * i) / 12)
      d += `${i ? 'L' : 'M'}${f1(x)} ${f1(edge(x) + v * depth)}`
    }
    return d
  }
  return (
    <>
      <defs>
        <radialGradient id={`${id}sea`} gradientUnits="userSpaceOnUse" cx={ex} cy={ey - R} r={R * 0.5 + depth * 2}>
          <stop offset="0" stopColor="#3f8fe0" />
          <stop offset="0.6" stopColor="#1f5fb0" />
          <stop offset="1" stopColor="#123d80" />
        </radialGradient>
        <linearGradient id={`${id}dusk`} gradientUnits="userSpaceOnUse" x1={x0} y1="0" x2={x1} y2="0">
          <stop offset="0.55" stopColor="#040a1e" stopOpacity="0" />
          <stop offset="1" stopColor="#040a1e" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <circle cx={ex} cy={ey} r={R + depth * 0.18} fill="#4aa8e8" opacity="0.18" />
      <circle cx={ex} cy={ey} r={R + depth * 0.07} fill="#8fd0ff" opacity="0.25" />
      <circle cx={ex} cy={ey} r={R} fill={`url(#${id}sea)`} />
      {EARTH_LAND.map(([u, v, len, deep, fill]) => {
        const x = at(u)
        const y = edge(x) + v * depth
        return <ellipse key={u} cx={x} cy={y} rx={len * depth} ry={deep * depth} fill={fill} opacity="0.9" transform={`rotate(${tilt(x).toFixed(1)} ${f1(x)} ${f1(y)})`} />
      })}
      {EARTH_CLOUD.map(([u0, u1, v]) => (
        <path key={u0} d={along(u0, u1, v)} fill="none" stroke="#ffffff" strokeWidth={depth * 0.07} strokeLinecap="round" opacity="0.75" />
      ))}
      {EARTH_SWIRLS.map(([u, v, r]) => {
        const x = at(u)
        const y = edge(x) + v * depth
        const rr = r * depth
        return (
          <path
            key={u}
            d={`M${f1(x - rr)} ${f1(y)}A${f1(rr)} ${f1(rr * 0.5)} 0 1 1 ${f1(x + rr * 0.4)} ${f1(y + rr * 0.3)}A${f1(rr * 0.5)} ${f1(rr * 0.25)} 0 1 1 ${f1(x)} ${f1(y - rr * 0.05)}`}
            fill="none"
            stroke="#ffffff"
            strokeWidth={depth * 0.05}
            strokeLinecap="round"
            opacity="0.8"
            transform={`rotate(${tilt(x).toFixed(1)} ${f1(x)} ${f1(y)})`}
          />
        )
      })}
      <circle cx={ex} cy={ey} r={R} fill={`url(#${id}dusk)`} />
      <circle cx={ex} cy={ey} r={R - 0.6 * k} fill="none" stroke="#bfe6ff" strokeWidth={1.4 * k} opacity="0.85" />
    </>
  )
}

/** Porthole: the card seen through a spacecraft's round window, its riveted ring, the stars, and the Earth turning below. */
export function Porthole({ w, h, s, id }: ThemeProps) {
  const k = h / 120
  const rw = h * 0.36
  const ring = h * 0.085
  const cx = Math.min(w * 0.7, w - rw - ring - h * 0.05)
  const cy = h * 0.5
  const R = rw * 2.4
  const ex = cx - rw * 0.4
  const ey = cy + rw * 0.3 + R
  const dot = (x: number, y: number, r: number) => `M${f1(x - r)} ${f1(y)}a${f1(r)} ${f1(r)} 0 1 0 ${f1(2 * r)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-2 * r)} 0Z`
  let seams = ''
  let rivets = ''
  for (const y of [h * 0.2, h * 0.82]) {
    seams += `M0 ${f1(y)}H${w}`
    for (let x = h * 0.05; x < w; x += h * 0.07) rivets += dot(x, y - h * 0.035, 1.3 * k)
  }
  for (let x = h * 0.5; x < w; x += h * 0.75) seams += `M${f1(x)} 0V${h}`
  const bolts = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2
    return dot(cx + Math.cos(a) * (rw + ring / 2), cy + Math.sin(a) * (rw + ring / 2), ring * 0.11)
  }).join('')
  return (
    <>
      <defs>
        <linearGradient id={`${id}wall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#262c42" />
          <stop offset="1" stopColor="#141827" />
        </linearGradient>
        <linearGradient id={`${id}steel`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d8dee8" />
          <stop offset="0.45" stopColor="#7a8496" />
          <stop offset="1" stopColor="#3a4256" />
        </linearGradient>
        <clipPath id={`${id}glass`}>
          <circle cx={cx} cy={cy} r={rw} />
        </clipPath>
      </defs>
      <rect width={w} height={h} fill={`url(#${id}wall)`} />
      <path d={seams} stroke="#0b0e18" strokeWidth={2.4 * k} />
      <path d={seams} stroke="#3a4258" strokeWidth={0.8 * k} transform={`translate(${f1(1.4 * k)} ${f1(1.4 * k)})`} />
      <path d={rivets} fill="#4a5470" />
      <g clipPath={`url(#${id}glass)`}>
        <rect x={cx - rw} y={cy - rw} width={rw * 2} height={rw * 2} fill="#03051a" />
        <path d={stars(w, h, Math.round((w * h) / (700 * s * s)), 1 * s, 43)} fill="#f4f0ff" opacity="0.8" />
        <path d={sparkle(cx + rw * 0.45, cy - rw * 0.5, rw * 0.07)} fill="#ffe7a3" />
        <EarthLimb ex={ex} ey={ey} R={R} depth={rw * 0.75} x0={cx - rw} x1={cx + rw} k={k} id={`${id}e`} />
        <path d={`M${f1(cx - rw)} ${f1(cy - rw * 0.2)}L${f1(cx - rw * 0.2)} ${f1(cy - rw)}H${f1(cx + rw * 0.15)}L${f1(cx - rw)} ${f1(cy + rw * 0.15)}Z`} fill="#ffffff" opacity="0.06" />
        <circle cx={cx} cy={cy} r={rw} fill="none" stroke="#000000" strokeWidth={rw * 0.12} opacity="0.45" />
      </g>
      <circle cx={cx} cy={cy} r={rw + ring / 2} fill="none" stroke={`url(#${id}steel)`} strokeWidth={ring} />
      <circle cx={cx} cy={cy} r={rw + 0.5 * k} fill="none" stroke="#0b0e18" strokeWidth={1.6 * k} />
      <circle cx={cx} cy={cy} r={rw + ring} fill="none" stroke="#0b0e18" strokeWidth={1.6 * k} />
      <path d={bolts} fill="#2a3042" transform={`translate(${f1(0.6 * k)} ${f1(0.6 * k)})`} />
      <path d={bolts} fill="#e3e9f0" />
      <rect x={cx - rw - ring - h * 0.2} y={cy + rw * 0.55} width={h * 0.12} height={h * 0.05} rx={k} fill="#f2813a" opacity="0.85" />
      <path d={`M${f1(cx - rw - ring - h * 0.185)} ${f1(cy + rw * 0.55 + h * 0.025)}h${f1(h * 0.09)}`} stroke="#141827" strokeWidth={1.2 * k} />
    </>
  )
}

/** Space station: the station over the Earth's edge, its long solar wings out either side, the stars above. */
export function SpaceStation({ w, h, s, id }: ThemeProps) {
  const k = h / 120
  const R = Math.max(w * 1.6, h * 2.2)
  const ex = w * 0.42
  const top = h * 0.76
  const S = Math.min(h * 0.9, w * 0.6)
  const u = S / 100
  const panel = (x: number, y: number, pw: number, ph: number) => {
    let grid = ''
    for (let gy = y + 3; gy < y + ph; gy += 3) grid += `M${x} ${gy}h${pw}`
    return (
      <g key={`${x}-${y}`}>
        <rect x={x} y={y} width={pw} height={ph} fill={`url(#${id}cell)`} stroke="#c98a1c" strokeWidth="0.5" />
        <path d={grid} stroke="#8ea4f2" strokeWidth="0.25" opacity="0.45" />
        <path d={`M${x + pw / 2} ${y}v${ph}`} stroke="#c98a1c" strokeWidth="0.45" />
      </g>
    )
  }
  const wings: ReactNode[] = []
  for (const x of [-52, -32, 18, 38]) wings.push(panel(x, -31, 14, 28), panel(x, 3, 14, 28))
  let lattice = ''
  for (let x = -56; x < 56; x += 3) lattice += `M${x} -1.6L${x + 1.5} 1.6L${x + 3} -1.6`
  return (
    <>
      <defs>
        <linearGradient id={`${id}space`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#02030c" />
          <stop offset="0.75" stopColor="#0a1030" />
          <stop offset="1" stopColor="#14245a" />
        </linearGradient>
        <linearGradient id={`${id}cell`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b5bc4" />
          <stop offset="1" stopColor="#1c2a6a" />
        </linearGradient>
        <linearGradient id={`${id}hull`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4f6fa" />
          <stop offset="1" stopColor="#a9b2c2" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#${id}space)`} />
      <path d={stars(w, h * 0.75, Math.round((w * h) / (1300 * s * s)), 1 * s, 51)} fill="#f4f0ff" opacity="0.75" />
      <EarthLimb ex={ex} ey={top + R} R={R} depth={h * 0.3} x0={0} x1={w} k={k} id={`${id}e`} />
      <g transform={`translate(${f1(w * 0.62)} ${f1(h * 0.4)}) rotate(-8) scale(${u.toFixed(3)})`}>
        <rect x="-57" y="-1.6" width="114" height="3.2" fill="#aab3c2" />
        <path d={lattice} fill="none" stroke="#6b7486" strokeWidth="0.45" />
        {wings}
        <rect x="9" y="5" width="3" height="10" fill="#f4f6fa" opacity="0.9" transform="rotate(20 10.5 10)" />
        <rect x="-12" y="-15" width="3" height="10" fill="#f4f6fa" opacity="0.9" transform="rotate(20 -10.5 -10)" />
        <rect x="-3.5" y="-17" width="7" height="34" rx="3" fill={`url(#${id}hull)`} />
        <rect x="-15" y="-4.5" width="30" height="9" rx="4" fill={`url(#${id}hull)`} />
        <path d="M-8 -4.5v9M8 -4.5v9M-3.5 -10h7M-3.5 10h7" stroke="#8d97aa" strokeWidth="0.5" />
        <circle r="5" fill="#e8ecf4" stroke="#8d97aa" strokeWidth="0.5" />
        <path d="M-2.4 17L2.4 17L3.6 22L-3.6 22Z" fill="#e8ecf4" />
        <path d="M-3.6 22Q0 23.6 3.6 22Z" fill="#6a4a36" />
        <path d={sparkle(-38, -31, 3)} fill="#ffffff" />
      </g>
    </>
  )
}
