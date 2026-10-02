/*
 * Season 1's card themes (Space Race, its pass), drawn to fill any box as the counter's themes are
 * (CardThemes.tsx): a deep field of stars with a ringed planet, the launch pad at dusk, and a nebula.
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
