/*
 * Plus's card themes: each month every member gets that month's look, kept for good. They're the
 * arcade's own, in its colours, drawn to fill any box as the counter's themes are (CardThemes.tsx).
 * December 2026's is a snow globe.
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

/** A round dot as a path, for snow drawn in one go. */
const dot = (x: number, y: number, r: number) => `M${f1(x - r)} ${f1(y)}a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(2 * r).toFixed(2)} 0a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(-2 * r).toFixed(2)} 0Z`

/** The string of little lights across the top, in the arcade's colours. */
const BULB_COLOURS = ['#ffd23f', '#ff4fa8', '#2fe3cf', '#ff8552', '#b86bff', '#6c8cff']

/**
 * Snow globe: the card inside a snow globe on its stand, a little arcade cabinet in the snow with a
 * pine either side, lit warm from its screen, and snow coming down in it and around it. A string of
 * lights hangs across the top of the room.
 */
export function SnowGlobe({ w, h, s, id }: ThemeProps) {
  const k = h / 120
  const R = h * 0.4
  const cx = Math.min(w * 0.7, w - R - h * 0.08)
  const cy = h * 0.44
  const ground = cy + R * 0.42
  const u = R / 100
  const rnd = seeded(61)

  let snowIn = ''
  const flake = Math.max(1, R * 0.012)
  for (let i = 0, n = 46 + Math.round(R / 6); i < n; i++) {
    const a = rnd() * Math.PI * 2
    const d = Math.sqrt(rnd()) * R * 0.92
    snowIn += dot(cx + Math.cos(a) * d, cy + Math.sin(a) * d, (0.6 + rnd()) * flake * 1.4)
  }
  let snowOut = ''
  const outside = Math.round((w * h) / (1800 * s * s))
  for (let i = 0; i < outside; i++) snowOut += dot(rnd() * w, rnd() * h, (0.5 + rnd() * 0.8) * s)

  // The lights sag from one side to the other.
  const y0 = h * 0.05
  const sag = h * 0.12
  const at = (t: number): [number, number] => [-10 + t * (w + 20), y0 + 4 * sag * t * (1 - t)]
  const bulbs = Math.max(5, Math.round(w / (h * 0.22)))
  const lights = Array.from({ length: bulbs }, (_, i) => at((i + 0.5) / bulbs))

  const baseTop = cy + R * 0.84
  const baseFoot = cy + R * 1.16
  return (
    <>
      <defs>
        <linearGradient id={`${id}room`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a0f2e" />
          <stop offset="0.7" stopColor="#2a1636" />
          <stop offset="1" stopColor="#140a20" />
        </linearGradient>
        <radialGradient id={`${id}sky`} cx="0.5" cy="0.25" r="0.8">
          <stop offset="0" stopColor="#3a3f8a" />
          <stop offset="1" stopColor="#141640" />
        </radialGradient>
        <radialGradient id={`${id}warm`}>
          <stop offset="0" stopColor="#ffb347" stopOpacity="0.6" />
          <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}halo`}>
          <stop offset="0.7" stopColor="#ffb347" stopOpacity="0.16" />
          <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}wood`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a3f22" />
          <stop offset="1" stopColor="#40200f" />
        </linearGradient>
        <clipPath id={`${id}glass`}>
          <circle cx={cx} cy={cy} r={R} />
        </clipPath>
      </defs>
      <rect width={w} height={h} fill={`url(#${id}room)`} />
      <rect y={baseFoot} width={w} height={h - baseFoot} fill="#120a1c" />
      <ellipse cx={cx} cy={baseFoot} rx={R * 1.2} ry={R * 0.08} fill="#ffb347" opacity="0.14" />
      <circle cx={cx} cy={cy} r={R * 1.35} fill={`url(#${id}halo)`} />
      <path d={snowOut} fill="#ffffff" opacity="0.35" />
      <path d={`M-10 ${f1(y0)}Q${f1(w / 2)} ${f1(y0 + 2 * sag)} ${w + 10} ${f1(y0)}`} fill="none" stroke="#3a2a4a" strokeWidth={1.2 * k} />
      {lights.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y + 3 * k} r={7 * k} fill={BULB_COLOURS[i % BULB_COLOURS.length]} opacity="0.22" />
          <rect x={x - 1.4 * k} y={y} width={2.8 * k} height={1.6 * k} fill="#3a2a4a" />
          <ellipse cx={x} cy={y + 3.4 * k} rx={1.9 * k} ry={2.4 * k} fill={BULB_COLOURS[i % BULB_COLOURS.length]} />
        </g>
      ))}
      <path d={`M${f1(cx - R * 0.65)} ${f1(baseTop)}H${f1(cx + R * 0.65)}L${f1(cx + R * 0.8)} ${f1(baseFoot)}H${f1(cx - R * 0.8)}Z`} fill={`url(#${id}wood)`} />
      <rect x={cx - R * 0.67} y={baseTop} width={R * 1.34} height={R * 0.07} fill="#e8b04a" />
      <rect x={cx - R * 0.2} y={baseTop + R * 0.13} width={R * 0.4} height={R * 0.1} rx={R * 0.02} fill="#ffd23f" />
      <path d={`M${f1(cx - R * 0.13)} ${f1(baseTop + R * 0.18)}h${f1(R * 0.26)}`} stroke="#7a3f22" strokeWidth={R * 0.02} />
      <g clipPath={`url(#${id}glass)`}>
        <rect x={cx - R} y={cy - R} width={R * 2} height={R * 2} fill={`url(#${id}sky)`} />
        <circle cx={cx} cy={ground - R * 0.22} r={R * 0.62} fill={`url(#${id}warm)`} />
        <ellipse cx={cx} cy={ground + R * 0.45} rx={R * 1.25} ry={R * 0.5} fill="#e8eef9" />
        <path d={`M${f1(cx - R * 1.2)} ${f1(ground + R * 0.05)}Q${f1(cx)} ${f1(ground - R * 0.12)} ${f1(cx + R * 1.2)} ${f1(ground + R * 0.05)}`} fill="none" stroke="#ffffff" strokeWidth={R * 0.03} opacity="0.8" />
        {[-0.52, 0.5].map((side) => (
          <g key={side} transform={`translate(${f1(cx + side * R)} ${f1(ground + R * 0.03)}) scale(${(u * (side < 0 ? 1.15 : 0.95)).toFixed(3)})`}>
            <rect x="-1.6" y="-4" width="3.2" height="5" fill="#5a3a24" />
            <path d="M0 -30L9 -16H5L11 -5H-11L-5 -16H-9Z" fill="#1f6b4a" />
            <path d="M0 -30L4 -24H-4ZM-5 -16L-9 -16L-7 -13ZM5 -16L9 -16L7 -13ZM-11 -5L-6 -5L-8.5 -3ZM11 -5L6 -5L8.5 -3Z" fill="#ffffff" />
          </g>
        ))}
        <g transform={`translate(${f1(cx)} ${f1(ground + R * 0.02)}) scale(${u.toFixed(3)})`}>
          <ellipse cx="0" cy="1" rx="24" ry="4" fill="#ffffff" />
          <path d="M-17 0V-50L-13 -62H13L17 -50V0Z" fill="#4a2a8a" />
          <path d="M-13 0V-48L-10 -58H10L13 -48V0Z" fill="#b86bff" />
          <rect x="-11" y="-57" width="22" height="7" rx="1" fill="#ffd23f" />
          <rect x="-9" y="-46" width="18" height="14" rx="1.5" fill="#2fe3cf" />
          <path d="M-4 -42h2v2h-2zM2 -42h2v2h-2zM-5 -40h10v3h-10zM-3 -37h2v2h-2zM1 -37h2v2h-2z" fill="#ff4fa8" />
          <path d="M-13 -28H13L15 -22H-15Z" fill="#ff4fa8" />
          <path d="M-6 -27v-4" stroke="#2a1650" strokeWidth="1.2" />
          <circle cx="-6" cy="-31.5" r="1.6" fill="#ff8552" />
          <circle cx="4" cy="-25" r="1.3" fill="#ffd23f" />
          <circle cx="8" cy="-25" r="1.3" fill="#2fe3cf" />
          <rect x="-4" y="-16" width="8" height="7" rx="1" fill="#2a1650" />
          <path d="M-1.6 -12.5h3.2" stroke="#ff8552" strokeWidth="1.2" />
          <path d="M-14 -62Q-14 -67 -8 -66Q0 -69 8 -66Q14 -67 14 -62Z" fill="#f4f8ff" />
        </g>
        <path d={snowIn} fill="#ffffff" opacity="0.9" />
      </g>
      <circle cx={cx} cy={cy} r={R - 0.8 * k} fill="none" stroke="#0e0a1c" strokeWidth={1.4 * k} opacity="0.5" />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#dcebff" strokeWidth={1.8 * k} opacity="0.6" />
      <path d={`M${f1(cx - R * 0.78)} ${f1(cy - R * 0.2)}A${f1(R * 0.8)} ${f1(R * 0.8)} 0 0 1 ${f1(cx - R * 0.2)} ${f1(cy - R * 0.78)}`} fill="none" stroke="#ffffff" strokeWidth={R * 0.06} strokeLinecap="round" opacity="0.22" />
      <circle cx={cx + R * 0.48} cy={cy - R * 0.5} r={R * 0.035} fill="#ffffff" opacity="0.7" />
    </>
  )
}
