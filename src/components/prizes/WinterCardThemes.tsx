/*
 * Season 2's card themes (Cold Snap, its pass), drawn to fill any box as the counter's themes are
 * (CardThemes.tsx): a snowfield under a winter sky, a ski lodge at night and a pine forest deep in snow. Its
 * Pass+ adds a frozen lake at dusk, a glacier's ice cave and the northern lights. Each keeps its scene to
 * the right and its ground low, so the card's name reads on the left, and is dark enough that a themed card's
 * name styles (shown in their dark-board colours) stand out.
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
const dot = (x: number, y: number, r: number) => `M${f1(x - r)} ${f1(y)}a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(2 * r).toFixed(2)} 0a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(-2 * r).toFixed(2)} 0Z`

/** Snow coming down: dots over the whole box, about one to every `per` square units at scale 1. */
function snow(w: number, h: number, s: number, seed: number, per = 1400, size = 1) {
  const rnd = seeded(seed)
  let d = ''
  for (let i = 0, n = Math.round((w * h) / (per * s * s)); i < n; i++) d += dot(rnd() * w, rnd() * h, (0.5 + rnd() * 0.9) * s * size)
  return d
}

function stars(w: number, h: number, s: number, seed: number, per = 1100) {
  const rnd = seeded(seed)
  let d = ''
  for (let i = 0, n = Math.round((w * h) / (per * s * s)); i < n; i++) d += dot(rnd() * w, rnd() * h * 0.6, (0.4 + rnd() * 0.6) * s)
  return d
}

/** A snowy pine, its foot at x, y, `t` tall. */
function pine(x: number, y: number, t: number, fill: string, cap: string) {
  const wd = t * 0.36
  const tier = (top: number, bottom: number, half: number) => `M${f1(x)} ${f1(y - t * top)}L${f1(x + wd * half)} ${f1(y - t * bottom)}H${f1(x - wd * half)}Z`
  const body = tier(1, 0.62, 0.62) + tier(0.8, 0.36, 0.82) + tier(0.58, 0.08, 1)
  const caps =
    `M${f1(x)} ${f1(y - t)}L${f1(x + wd * 0.26)} ${f1(y - t * 0.84)}L${f1(x)} ${f1(y - t * 0.87)}L${f1(x - wd * 0.26)} ${f1(y - t * 0.84)}Z` +
    `M${f1(x - wd * 0.62)} ${f1(y - t * 0.62)}Q${f1(x)} ${f1(y - t * 0.7)} ${f1(x + wd * 0.62)} ${f1(y - t * 0.62)}Q${f1(x)} ${f1(y - t * 0.66)} ${f1(x - wd * 0.62)} ${f1(y - t * 0.62)}Z` +
    `M${f1(x - wd * 0.82)} ${f1(y - t * 0.36)}Q${f1(x)} ${f1(y - t * 0.45)} ${f1(x + wd * 0.82)} ${f1(y - t * 0.36)}Q${f1(x)} ${f1(y - t * 0.41)} ${f1(x - wd * 0.82)} ${f1(y - t * 0.36)}Z`
  return (
    <>
      <path d={body} fill={fill} />
      <path d={caps} fill={cap} />
      <rect x={x - t * 0.03} y={y - t * 0.08} width={t * 0.06} height={t * 0.08} fill="#2a1c14" />
    </>
  )
}

/** Snowfield: fresh snow in long drifts under a deep winter sky, the snow still coming down, a moon at the edge. */
export function Snowfield({ w, h, s, id }: ThemeProps) {
  const k = sizeOf(s, h, 120)
  return (
    <>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d1f3c" />
          <stop offset="0.65" stopColor="#24497a" />
          <stop offset="1" stopColor="#4a7fb4" />
        </linearGradient>
        <linearGradient id={`${id}snow`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eaf4fc" />
          <stop offset="1" stopColor="#a9c8e4" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#${id}sky)`} />
      <path d={stars(w, h, s, 5)} fill="#ffffff" opacity="0.55" />
      <circle cx={w * 0.86} cy={h * 0.22} r={13 * k} fill="#f4f8ff" />
      <circle cx={w * 0.86} cy={h * 0.22} r={22 * k} fill="#f4f8ff" opacity="0.12" />
      <path d={`M0 ${f1(h * 0.72)}C${f1(w * 0.25)} ${f1(h * 0.62)} ${f1(w * 0.5)} ${f1(h * 0.74)} ${f1(w * 0.75)} ${f1(h * 0.64)}S${f1(w)} ${f1(h * 0.66)} ${w} ${f1(h * 0.66)}V${h}H0Z`} fill="#c9def0" opacity="0.75" />
      <path d={`M0 ${f1(h * 0.82)}C${f1(w * 0.3)} ${f1(h * 0.74)} ${f1(w * 0.6)} ${f1(h * 0.86)} ${w} ${f1(h * 0.76)}V${h}H0Z`} fill={`url(#${id}snow)`} />
      <path d={`M${f1(w * 0.55)} ${h}C${f1(w * 0.6)} ${f1(h * 0.9)} ${f1(w * 0.68)} ${f1(h * 0.84)} ${f1(w * 0.78)} ${f1(h * 0.8)}`} fill="none" stroke="#8fb2d4" strokeWidth={1.4 * k} strokeDasharray={`${f1(3 * k)} ${f1(3 * k)}`} />
      <path d={snow(w, h, s, 12)} fill="#ffffff" opacity="0.8" />
    </>
  )
}

/** Ski lodge: a lodge at night, its windows warm, smoke from the chimney, the lift going up the hill behind. */
export function SkiLodge({ w, h, s, id }: ThemeProps) {
  const k = sizeOf(s, h, 120)
  const lx = Math.min(w * 0.72, w - 56 * k)
  const ly = h * 0.82
  const lw = 70 * k
  const lh = 34 * k
  return (
    <>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1430" />
          <stop offset="1" stopColor="#24305e" />
        </linearGradient>
        <radialGradient id={`${id}warm`}>
          <stop offset="0" stopColor="#ffb347" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#${id}sky)`} />
      <path d={stars(w, h, s, 19)} fill="#ffffff" opacity="0.5" />
      <path d={`M${f1(w * 0.3)} ${h}L${f1(w * 0.62)} ${f1(h * 0.18)}L${w} ${f1(h * 0.5)}V${h}Z`} fill="#3a4a7a" />
      <path d={`M${f1(w * 0.56)} ${f1(h * 0.33)}L${f1(w * 0.62)} ${f1(h * 0.18)}L${f1(w * 0.68)} ${f1(h * 0.34)}L${f1(w * 0.64)} ${f1(h * 0.3)}L${f1(w * 0.6)} ${f1(h * 0.35)}Z`} fill="#e6eef8" />
      <path d={`M${f1(w * 0.42)} ${f1(h * 0.95)}L${f1(w * 0.66)} ${f1(h * 0.24)}`} stroke="#1c2448" strokeWidth={1.2 * k} />
      {[0.25, 0.5, 0.75].map((t) => {
        const x = w * (0.42 + 0.24 * t)
        const y = h * (0.95 - 0.71 * t)
        return <rect key={t} x={x - 3 * k} y={y + 2 * k} width={6 * k} height={5 * k} rx={1 * k} fill="#e8564f" />
      })}
      <path d={`M0 ${f1(h * 0.86)}Q${f1(w * 0.5)} ${f1(h * 0.78)} ${w} ${f1(h * 0.84)}V${h}H0Z`} fill="#dce8f4" />
      <circle cx={lx} cy={ly - lh * 0.4} r={lw * 0.9} fill={`url(#${id}warm)`} />
      <rect x={lx - lw / 2} y={ly - lh} width={lw} height={lh} fill="#4a2a1c" />
      <path d={`M${f1(lx - lw * 0.62)} ${f1(ly - lh)}L${f1(lx)} ${f1(ly - lh * 1.9)}L${f1(lx + lw * 0.62)} ${f1(ly - lh)}Z`} fill="#2e1a12" />
      <path d={`M${f1(lx - lw * 0.62)} ${f1(ly - lh)}L${f1(lx)} ${f1(ly - lh * 1.9)}L${f1(lx + lw * 0.62)} ${f1(ly - lh)}L${f1(lx + lw * 0.5)} ${f1(ly - lh * 1.08)}L${f1(lx)} ${f1(ly - lh * 1.72)}L${f1(lx - lw * 0.5)} ${f1(ly - lh * 1.08)}Z`} fill="#f2f6fb" />
      <rect x={lx + lw * 0.22} y={ly - lh * 1.75} width={7 * k} height={14 * k} fill="#3a2418" />
      <path d={`M${f1(lx + lw * 0.22 + 3.5 * k)} ${f1(ly - lh * 1.8)}c${f1(-6 * k)} ${f1(-6 * k)} ${f1(6 * k)} ${f1(-10 * k)} 0 ${f1(-18 * k)}`} fill="none" stroke="#9aa6c8" strokeWidth={2.4 * k} strokeLinecap="round" opacity="0.45" />
      {[-0.32, 0, 0.32].map((dx) => (
        <rect key={dx} x={lx + dx * lw - 6 * k} y={ly - lh * 0.72} width={12 * k} height={11 * k} fill="#ffc35a" />
      ))}
      <rect x={lx - 6 * k} y={ly - lh * 1.42} width={12 * k} height={9 * k} fill="#ffc35a" />
      <path d={snow(w, h, s, 23, 2200)} fill="#ffffff" opacity="0.7" />
    </>
  )
}

/** Pine forest: snowy pines at night in rows going back, a lantern lit among them. */
export function PineForest({ w, h, s, id }: ThemeProps) {
  const k = sizeOf(s, h, 120)
  const rnd = seeded(41)
  const far: [number, number][] = []
  for (let x = w * 0.3; x < w + 20 * k; x += 16 * k + rnd() * 10 * k) far.push([x, 40 * k + rnd() * 18 * k])
  const near: [number, number][] = []
  for (let x = w * 0.46; x < w + 30 * k; x += 30 * k + rnd() * 16 * k) near.push([x, 70 * k + rnd() * 24 * k])
  const lx = w * 0.74
  const ly = h * 0.8
  return (
    <>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a1a24" />
          <stop offset="1" stopColor="#1d3a48" />
        </linearGradient>
        <radialGradient id={`${id}lamp`}>
          <stop offset="0" stopColor="#ffd27a" stopOpacity="0.7" />
          <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#${id}sky)`} />
      <path d={stars(w, h, s, 31)} fill="#ffffff" opacity="0.45" />
      {far.map(([x, t]) => (
        <g key={`f${f1(x)}`} opacity="0.55">
          {pine(x, h * 0.74, t, '#1f4a4a', '#c9dde6')}
        </g>
      ))}
      <path d={`M0 ${f1(h * 0.76)}Q${f1(w * 0.5)} ${f1(h * 0.7)} ${w} ${f1(h * 0.76)}V${h}H0Z`} fill="#cfe0ea" />
      <circle cx={lx} cy={ly - 6 * k} r={34 * k} fill={`url(#${id}lamp)`} />
      {near.map(([x, t]) => (
        <g key={`n${f1(x)}`}>{pine(x, h * 0.92, t, '#16403a', '#f2f8fb')}</g>
      ))}
      <path d={`M${f1(lx)} ${f1(ly)}V${f1(ly - 16 * k)}`} stroke="#2a1c14" strokeWidth={1.6 * k} />
      <rect x={lx - 3.5 * k} y={ly - 24 * k} width={7 * k} height={9 * k} rx={1.5 * k} fill="#ffc35a" stroke="#3a2418" strokeWidth={1 * k} />
      <path d={`M0 ${f1(h * 0.93)}Q${f1(w * 0.5)} ${f1(h * 0.88)} ${w} ${f1(h * 0.93)}V${h}H0Z`} fill="#e8f1f6" />
      <path d={snow(w, h, s, 44, 2000)} fill="#ffffff" opacity="0.7" />
    </>
  )
}

/** Frozen lake: a lake frozen over at dusk, pink sky over dark hills, skate marks curling across the ice. */
export function FrozenLake({ w, h, s, id }: ThemeProps) {
  const k = sizeOf(s, h, 120)
  const shore = h * 0.52
  return (
    <>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c2350" />
          <stop offset="0.6" stopColor="#6a4a8a" />
          <stop offset="1" stopColor="#e88aa0" />
        </linearGradient>
        <linearGradient id={`${id}ice`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9a8ac0" />
          <stop offset="0.3" stopColor="#5a6aa8" />
          <stop offset="1" stopColor="#24305e" />
        </linearGradient>
      </defs>
      <rect width={w} height={shore} fill={`url(#${id}sky)`} />
      <path d={stars(w, shore * 1.4, s, 53, 1600)} fill="#ffffff" opacity="0.5" />
      <path d={`M0 ${f1(shore)}L${f1(w * 0.2)} ${f1(shore - 20 * k)}L${f1(w * 0.38)} ${f1(shore - 8 * k)}L${f1(w * 0.6)} ${f1(shore - 30 * k)}L${f1(w * 0.82)} ${f1(shore - 12 * k)}L${w} ${f1(shore - 24 * k)}V${f1(shore)}Z`} fill="#2a2450" />
      <rect y={shore} width={w} height={h - shore} fill={`url(#${id}ice)`} />
      <path d={`M0 ${f1(shore + 1.5 * k)}H${w}`} stroke="#f2e6ff" strokeWidth={1.4 * k} opacity="0.6" />
      <path
        d={`M${f1(w * 0.48)} ${f1(h * 0.92)}C${f1(w * 0.6)} ${f1(h * 0.62)} ${f1(w * 0.92)} ${f1(h * 0.7)} ${f1(w * 0.8)} ${f1(h * 0.84)}S${f1(w * 0.6)} ${f1(h * 0.78)} ${f1(w * 0.7)} ${f1(h * 0.66)}`}
        fill="none"
        stroke="#e6ecff"
        strokeWidth={1.2 * k}
        opacity="0.7"
      />
      <path
        d={`M${f1(w * 0.5)} ${f1(h * 0.95)}C${f1(w * 0.63)} ${f1(h * 0.64)} ${f1(w * 0.95)} ${f1(h * 0.72)} ${f1(w * 0.82)} ${f1(h * 0.87)}`}
        fill="none"
        stroke="#e6ecff"
        strokeWidth={0.8 * k}
        opacity="0.45"
      />
      <path d={`M${f1(w * 0.3)} ${f1(h * 0.62)}l${f1(14 * k)} ${f1(6 * k)}l${f1(8 * k)} ${f1(-3 * k)}M${f1(w * 0.86)} ${f1(h * 0.95)}l${f1(-10 * k)} ${f1(-4 * k)}`} fill="none" stroke="#c9d4ff" strokeWidth={0.8 * k} opacity="0.55" />
      <ellipse cx={w * 0.72} cy={shore + 10 * k} rx={30 * k} ry={3 * k} fill="#ffc9d6" opacity="0.35" />
    </>
  )
}

/** Ice cave: inside a glacier, blue light through its walls, icicles overhead and crystals on the floor. */
export function IceCave({ w, h, s, id }: ThemeProps) {
  const k = sizeOf(s, h, 120)
  const rnd = seeded(67)
  let icicles = ''
  for (let x = rnd() * 10 * k; x < w; x += 9 * k + rnd() * 12 * k) {
    const len = (10 + rnd() * 26) * k
    icicles += `M${f1(x - 3.5 * k)} 0L${f1(x)} ${f1(len)}L${f1(x + 3.5 * k)} 0Z`
  }
  const crystal = (x: number, t: number, turn: number, light: boolean) => {
    const wd = t * 0.22
    return (
      <g key={`${f1(x)}-${turn}`} transform={`translate(${f1(x)} ${f1(h)}) rotate(${turn})`}>
        <path d={`M0 0L${f1(-wd)} ${f1(-t * 0.15)}L${f1(-wd)} ${f1(-t * 0.8)}L0 ${f1(-t)}L${f1(wd)} ${f1(-t * 0.8)}L${f1(wd)} ${f1(-t * 0.15)}Z`} fill={light ? '#3a7fc0' : '#1d4a7a'} stroke="#7fe3ff" strokeWidth={1.2 * k} strokeLinejoin="round" />
        <path d={`M0 0L0 ${f1(-t)}L${f1(wd)} ${f1(-t * 0.8)}L${f1(wd)} ${f1(-t * 0.15)}Z`} fill="#bfefff" opacity={light ? 0.5 : 0.28} />
      </g>
    )
  }
  return (
    <>
      <defs>
        <radialGradient id={`${id}glow`} cx="0.7" cy="0.45" r="0.8">
          <stop offset="0" stopColor="#3a8ad0" />
          <stop offset="0.55" stopColor="#14406e" />
          <stop offset="1" stopColor="#081a33" />
        </radialGradient>
        <linearGradient id={`${id}shaft`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#${id}glow)`} />
      <path d={`M${f1(w * 0.6)} 0H${f1(w * 0.72)}L${f1(w * 0.66)} ${h}H${f1(w * 0.44)}Z`} fill={`url(#${id}shaft)`} />
      <path d={`M0 0H${w}V${f1(8 * k)}Q${f1(w * 0.5)} ${f1(14 * k)} 0 ${f1(8 * k)}Z`} fill="#d8f4ff" opacity="0.85" />
      <path d={icicles} fill="#d8f4ff" opacity="0.8" />
      {crystal(w * 0.62, 50 * k, -12, true)}
      {crystal(w * 0.7, 76 * k, 4, false)}
      {crystal(w * 0.78, 44 * k, 18, true)}
      {crystal(w * 0.94, 64 * k, -6, false)}
      <path d={`M${f1(w * 0.84)} ${f1(h * 0.3)}l${f1(1 * k)} ${f1(3 * k)}l${f1(3 * k)} ${f1(1 * k)}l${f1(-3 * k)} ${f1(1 * k)}l${f1(-1 * k)} ${f1(3 * k)}l${f1(-1 * k)} ${f1(-3 * k)}l${f1(-3 * k)} ${f1(-1 * k)}l${f1(3 * k)} ${f1(-1 * k)}Z`} fill="#e86bd0" />
    </>
  )
}

/** Northern lights: green and violet curtains over snowy pines on a polar night. */
export function NorthernLights({ w, h, s, id }: ThemeProps) {
  const k = sizeOf(s, h, 120)
  const curtain = (y: number, amp: number, phase: number) => {
    let d = `M0 ${f1(y)}`
    for (let i = 1; i <= 8; i++) {
      const x = (w * i) / 8
      d += `Q${f1(x - w / 16)} ${f1(y + Math.sin(i + phase) * amp)} ${f1(x)} ${f1(y + Math.cos(i * 0.7 + phase) * amp * 0.5)}`
    }
    return d
  }
  const rnd = seeded(73)
  const trees: [number, number][] = []
  for (let x = -6 * k; x < w + 20 * k; x += 14 * k + rnd() * 12 * k) trees.push([x, 26 * k + rnd() * 22 * k])
  return (
    <>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#061226" />
          <stop offset="1" stopColor="#12304a" />
        </linearGradient>
        <filter id={`${id}soft`} x="-10%" y="-80%" width="120%" height="260%">
          <feGaussianBlur stdDeviation={8 * k} />
        </filter>
      </defs>
      <rect width={w} height={h} fill={`url(#${id}sky)`} />
      <path d={stars(w, h, s, 79)} fill="#ffffff" opacity="0.6" />
      <g filter={`url(#${id}soft)`} fill="none" strokeLinecap="round">
        <path d={curtain(h * 0.3, 18 * k, 0)} stroke="#5cf2b0" strokeWidth={22 * k} opacity="0.6" />
        <path d={curtain(h * 0.44, 14 * k, 1.4)} stroke="#33c6d6" strokeWidth={16 * k} opacity="0.45" />
        <path d={curtain(h * 0.2, 12 * k, 2.6)} stroke="#9b7bff" strokeWidth={14 * k} opacity="0.45" />
      </g>
      <path d={curtain(h * 0.3, 18 * k, 0)} fill="none" stroke="#c8ffe8" strokeWidth={1.2 * k} opacity="0.55" />
      <path d={`M0 ${f1(h * 0.86)}Q${f1(w * 0.5)} ${f1(h * 0.8)} ${w} ${f1(h * 0.86)}V${h}H0Z`} fill="#bcd2e4" />
      {trees.map(([x, t]) => (
        <g key={f1(x)}>{pine(x, h * 0.88, t, '#081a26', '#9fc0d6')}</g>
      ))}
      <path d={`M0 ${f1(h * 0.94)}Q${f1(w * 0.5)} ${f1(h * 0.9)} ${w} ${f1(h * 0.94)}V${h}H0Z`} fill="#dce9f3" />
    </>
  )
}
