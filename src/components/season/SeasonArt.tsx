import { SPACE, sparklePath } from '../../lib/seasonArt'

/*
 * Season 1's pictures (Space Race): the mission patch every level is shown on,
 * the ring that fills toward the next level, the Moonhopper lander and the
 * banner's scene of it coming down on a moon. All drawn here, in the season's
 * own colours, so they look the same on a light page or a dark one.
 */

export function Rocket({ x, y, scale = 1, turn = 0 }: { x: number; y: number; scale?: number; turn?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${turn}) scale(${scale})`}>
      <path d="M0 -22 C8 -14 8 2 6 12 H-6 C-8 2 -8 -14 0 -22z" fill={SPACE.star} />
      <circle cx="0" cy="-6" r="3.4" fill={SPACE.indigo} />
      <path d="M-6 4 L-12 16 L-6 13z M6 4 L12 16 L6 13z" fill={SPACE.red} />
      <path d="M-4 12 L0 24 L4 12z" fill={SPACE.amber} />
    </g>
  )
}

/** The level badge: an embroidered mission patch with the level (or "S1") on it, or a rocket. */
export function MissionPatch({ label, size, className }: { label?: string; size: number; className?: string }) {
  const long = (label?.length ?? 0) > 1
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="48" fill={SPACE.night} />
      <circle cx="50" cy="50" r="43" fill="none" stroke={SPACE.orange} strokeWidth="7" />
      <circle cx="50" cy="50" r="43" fill="none" stroke="#fff0e6" strokeWidth="1.3" strokeDasharray="2 3" />
      <circle cx="50" cy="50" r="38" fill={SPACE.panel} />
      <path d="M16 66 Q50 50 84 66 A38 38 0 0 1 16 66z" fill={SPACE.violet} />
      <path d={sparklePath(30, 30, 4)} fill={SPACE.amber} />
      <path d={sparklePath(72, 34, 3)} fill={SPACE.star} />
      <circle cx="64" cy="22" r="1.4" fill={SPACE.star} />
      {label ? (
        <text x="50" y={long ? 61 : 63} textAnchor="middle" fontFamily="Orbitron, Outfit, sans-serif" fontWeight={800} fontSize={long ? 28 : 34} fill="#ffffff">
          {label}
        </text>
      ) : (
        <Rocket x={50} y={50} scale={1.25} turn={30} />
      )}
    </svg>
  )
}

/** The ring that fills toward the next level, with the level in the middle. */
export function SeasonRing({
  level,
  progress,
  size = 34,
  track,
  ink,
  showLevel = true,
}: {
  level: number
  /** 0..1 of the way to the next level. */
  progress: number
  size?: number
  track: string
  ink: string
  showLevel?: boolean
}) {
  const r = 14
  const length = 2 * Math.PI * r
  const shown = Math.max(0.04, Math.min(1, progress))
  // Colours go in style, not attributes, so they can be the theme's custom properties.
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true">
      <circle cx="17" cy="17" r={r} fill="none" style={{ stroke: track }} strokeWidth="3.5" />
      <circle
        cx="17"
        cy="17"
        r={r}
        fill="none"
        stroke={SPACE.orange}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={`${(length * shown).toFixed(1)} ${length.toFixed(1)}`}
        transform="rotate(-90 17 17)"
      />
      {showLevel ? (
        <text x="17" y="22" textAnchor="middle" fontFamily="Outfit, system-ui, sans-serif" fontWeight={700} fontSize={level > 9 ? 12.5 : 14} style={{ fill: ink }}>
          {level}
        </text>
      ) : null}
    </svg>
  )
}

/** The Moonhopper, the season's first skin, on a 100-wide board. */
export function Moonhopper({ flame = false }: { flame?: boolean }) {
  return (
    <>
      {flame ? (
        <>
          <path d="M42 68 L50 92 L58 68z" fill={SPACE.orange} />
          <path d="M45 68 L50 82 L55 68z" fill={SPACE.amber} />
        </>
      ) : null}
      <path d="M50 20 V8" stroke={SPACE.muted} strokeWidth="2" />
      <circle cx="50" cy="7" r="3" fill={SPACE.red} />
      <path d="M36 66 L24 84 M64 66 L76 84" stroke={SPACE.red} strokeWidth="4" strokeLinecap="round" />
      <path d="M18 86 h12 M70 86 h12" stroke={SPACE.red} strokeWidth="4" strokeLinecap="round" />
      <rect x="28" y="54" width="44" height="14" rx="4" fill={SPACE.red} />
      <circle cx="50" cy="40" r="20" fill={SPACE.star} />
      <path d="M31 46 A20 20 0 0 0 69 46" fill="#d9d4f0" />
      <rect x="39" y="30" width="22" height="12" rx="6" fill="#0b0f1a" />
      <rect x="43" y="32.5" width="6" height="3" rx="1.5" fill="#5fe0c8" />
    </>
  )
}

/** The season banner's picture: the Moonhopper coming down on a moon, a ringed planet behind. */
export function MoonScene({ seed = 21 }: { seed?: number }) {
  const stars: { x: number; y: number; r: number; o: number }[] = []
  let a = seed
  const next = () => {
    a = (a * 9301 + 49297) % 233280
    return a / 233280
  }
  for (let i = 0; i < 70; i++) stars.push({ x: next() * 614, y: next() * 250, r: 0.6 + next() * 1.3, o: 0.4 + next() * 0.6 })
  return (
    <svg width="100%" height="100%" viewBox="0 0 614 329" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ display: 'block' }}>
      {stars.map((s, i) => (
        <circle key={i} cx={s.x.toFixed(0)} cy={s.y.toFixed(0)} r={s.r.toFixed(1)} fill={SPACE.star} opacity={s.o.toFixed(2)} />
      ))}
      <ellipse cx="500" cy="84" rx="92" ry="18" fill="none" stroke={SPACE.brass} strokeWidth="5" transform="rotate(-14 500 84)" />
      <circle cx="500" cy="84" r="50" fill={SPACE.violet} />
      <path d="M454 64 Q500 50 548 72" stroke="#a48be0" strokeWidth="6" fill="none" opacity="0.6" />
      <path d="M408 84 A92 18 0 0 0 592 84" fill="none" stroke={SPACE.amber} strokeWidth="5" transform="rotate(-14 500 84)" />
      <path d="M60 40 Q140 90 230 120" stroke={SPACE.orange} strokeWidth="2" strokeDasharray="2 7" fill="none" opacity="0.8" />
      <Rocket x={84} y={52} scale={0.75} turn={120} />
      <circle cx="307" cy="900" r="660" fill="#2e3670" />
      <circle cx="307" cy="900" r="660" fill="none" stroke="#454f9a" strokeWidth="3" />
      {[
        [150, 286, 26, 7],
        [260, 262, 18, 5],
        [420, 276, 30, 8],
        [540, 300, 22, 6],
        [330, 310, 34, 8],
      ].map(([x, y, rx, ry]) => (
        <ellipse key={x} cx={x} cy={y} rx={rx} ry={ry} fill="#262d66" />
      ))}
      <g transform="translate(250 96) scale(1.15)">
        <Moonhopper flame />
      </g>
    </svg>
  )
}
