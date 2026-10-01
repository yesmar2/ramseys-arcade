import type { Cave } from './sim'

/**
 * A cave from the side, as the past caves' cards, Today's Cave and the Cave Book draw it: its air glowing
 * violet at the top and magenta deep down on the dark, the start pad and the landing pad in amber, the pillars
 * in the way. It keeps its own shape (caves run tall) in a frame `aspect` wide for each unit high.
 */
export function CaveDrawing({ cave, className, aspect = 16 / 10 }: { cave: Cave; className?: string; aspect?: number }) {
  const [x0, x1, y0, y1] = cave.box
  const pad = 14
  let w = x1 - x0 + pad * 2
  let h = y1 - y0 + pad * 2
  if (w / h < aspect) w = h * aspect
  else h = w / aspect
  // Into the frame's own units: x across, y down from its top.
  const ox = (w - (x1 - x0)) / 2 - x0
  const X = (x: number) => (x + ox).toFixed(1)
  const Y = (y: number) => ((h - (y1 - y0)) / 2 + (y1 - y)).toFixed(1)
  const N = cave.nodes
  const left: string[] = []
  const right: string[] = []
  for (let i = 0; i < N.length; i += 2) {
    const a = N[Math.max(0, i - 1)]!
    const b = N[Math.min(N.length - 1, i + 1)]!
    const L = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const nx = -(b.y - a.y) / L
    const ny = (b.x - a.x) / L
    const p = N[i]!
    left.push(`${X(p.x + nx * p.r)} ${Y(p.y + ny * p.r)}`)
    right.push(`${X(p.x - nx * p.r)} ${Y(p.y - ny * p.r)}`)
  }
  const tunnel = `M${left.join(' L')} L${right.reverse().join(' L')} Z`
  const ends = [N[0]!, N[N.length - 1]!]
  const [start, land] = cave.pads
  const id = `cave-${cave.n}-${cave.attempt}`
  const air = (
    <>
      <path d={tunnel} />
      {ends.map((p, i) => (
        <circle key={i} cx={X(p.x)} cy={Y(p.y)} r={p.r} />
      ))}
      {cave.rooms.map((m, i) => (
        <rect key={i} x={X(m.x0)} y={Y(m.y1)} width={m.x1 - m.x0} height={m.y1 - m.y0} />
      ))}
    </>
  )
  // The walls' light, thicker than true scale where the drawing is small, so a thumbnail's cave isn't a thread.
  const stroke = Math.max(w, h) / 110
  return (
    <svg className={className} viewBox={`0 0 ${w.toFixed(1)} ${h.toFixed(1)}`} role="img" aria-label={`${cave.name}, from the side`}>
      <defs>
        <linearGradient id={`${id}-wall`} x1="0" y1={Y(y1)} x2="0" y2={Y(y0)} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8a5cff" />
          <stop offset="1" stopColor="#ff4fd8" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill="#0b0716" />
      {/* The light off the walls, then the walls' lit edge, then the air inside them. */}
      <g fill={`url(#${id}-wall)`} stroke={`url(#${id}-wall)`} strokeLinejoin="round" strokeWidth={stroke * 5} opacity="0.22">
        {air}
      </g>
      <g fill={`url(#${id}-wall)`} stroke={`url(#${id}-wall)`} strokeLinejoin="round" strokeWidth={stroke * 1.6}>
        {air}
      </g>
      <g fill="#150d29">{air}</g>
      {cave.pillars.map((p, i) => (
        <circle key={i} cx={X(p.x)} cy={Y(p.y)} r={p.r} fill="#0b0716" stroke={`url(#${id}-wall)`} strokeWidth={stroke * 0.8} />
      ))}
      <rect x={X(start.x0)} y={Number(Y(start.y)) - stroke * 1.4} width={start.x1 - start.x0} height={stroke * 1.4} fill="#ffb347" opacity="0.7" />
      <rect x={X(land.x0)} y={Number(Y(land.y)) - stroke * 1.8} width={land.x1 - land.x0} height={stroke * 1.8} fill="#ffb347" />
    </svg>
  )
}
