import { AIR, BANDS, INK, LIT, mix, PALE, rgb, RIM, ROCK } from './lampParts'
import { lanternsOf } from './lanterns'
import { mulberry32, type Cave } from './sim'

/**
 * A cave from the side, as the past caves' cards, Today's Cave and the Cave Book draw it: its air glowing
 * violet at the top and magenta deep down on the dark, the start pad and the landing pad in amber, the pillars
 * in the way. It keeps its own shape (caves run tall) in a frame `aspect` wide for each unit high.
 *
 * `lamp`: the cave of a day flown in Lander's new look (newLook.ts newLookFor) is drawn as that look has it,
 * the same shape in the same frame: warm rock in its layers, the tunnel's light in it, dark air, a timber start
 * pad, and the day's three lanterns marked where they hang. Ramsey was shown it beside this one when he picked
 * the day's picture (2026-11-26, "B, the lantern").
 */
export function CaveDrawing({ cave, className, aspect = 16 / 10, lamp = false }: { cave: Cave; className?: string; aspect?: number; lamp?: boolean }) {
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
  const frame = { className, viewBox: `0 0 ${w.toFixed(1)} ${h.toFixed(1)}`, role: 'img' as const, 'aria-label': `${cave.name}, from the side` }
  if (lamp) {
    const rock = mix(ROCK[0], ROCK[1], 0.5)
    const edge = rgb(mix(RIM[0], RIM[1], 0.5))
    return (
      <svg {...frame}>
        <defs>
          <linearGradient id={`${id}-rock`} x1="0" y1="0" x2="0" y2={h.toFixed(1)} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={rgb(ROCK[0])} />
            <stop offset="1" stopColor={rgb(ROCK[1])} />
          </linearGradient>
          <radialGradient id={`${id}-glow`}>
            <stop offset="0" stopColor="rgb(255, 200, 110)" stopOpacity="0.75" />
            <stop offset="1" stopColor="rgb(255, 180, 90)" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* The rock, well past the frame on every side: a box of another shape than the frame shows more rock round the cave, not what's behind it. */}
        <rect x={(-w).toFixed(1)} y={(-h).toFixed(1)} width={(w * 3).toFixed(1)} height={(h * 3).toFixed(1)} fill={`url(#${id}-rock)`} />
        {rockLayers(cave.n, w, h).map((layer) => (
          <path key={layer.d} d={layer.d} fill={rgb(layer.tone > 0 ? PALE : INK)} fillOpacity={(layer.tone > 0 ? 0.04 + 0.07 * layer.tone : 0.06 - 0.12 * layer.tone).toFixed(3)} />
        ))}
        {/* The tunnel's light in the rock, band on band as the game has it, then the wall's lit edge, then the air inside. */}
        {(
          [
            [9, BANDS[0][1]],
            [6, BANDS[1][1]],
            [3.4, BANDS[2][1]],
          ] as const
        ).map(([width, lit]) => (
          <g key={width} fill="none" stroke={rgb(mix(rock, LIT, lit))} strokeLinejoin="round" strokeWidth={stroke * width}>
            {air}
          </g>
        ))}
        <g fill="none" stroke={edge} strokeLinejoin="round" strokeWidth={stroke * 1.5}>
          {air}
        </g>
        <g fill={rgb(mix(AIR[0], AIR[1], 0.5))}>{air}</g>
        {cave.pillars.map((p, i) => (
          <circle key={i} cx={X(p.x)} cy={Y(p.y)} r={p.r} fill={rgb(mix(rock, LIT, 0.4))} stroke={edge} strokeWidth={stroke * 0.7} />
        ))}
        {/* The start pad in its timber, the landing pad lit. */}
        <rect x={X(start.x0)} y={Number(Y(start.y)) - stroke * 1.4} width={start.x1 - start.x0} height={stroke * 1.4} fill="#b9814a" />
        <rect x={X(land.x0)} y={Number(Y(land.y)) - stroke * 1.8} width={land.x1 - land.x0} height={stroke * 1.8} fill="#ffb347" />
        {/* The day's lanterns, where they hang: dark in their gold, for lighting. */}
        {lanternsOf(cave).map((l, i) => (
          <g key={i}>
            <circle cx={X(l.x)} cy={Y(l.y)} r={stroke * 4.6} fill={`url(#${id}-glow)`} opacity="0.55" />
            <circle cx={X(l.x)} cy={Y(l.y)} r={stroke * 1.5} fill="rgb(70, 58, 62)" stroke="#ffd166" strokeWidth={stroke * 0.6} />
          </g>
        ))}
      </svg>
    )
  }
  return (
    <svg {...frame}>
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

/**
 * The rock's layers across a frame `w` by `h`, at a size a picture this far off can show: each a wavering band,
 * paler or darker than the rock by its `tone` (−1 to 1). They run a tenth past the frame at each side, for a
 * box a little wider than it.
 */
function rockLayers(n: number, w: number, h: number): { d: string; tone: number }[] {
  const layers: { d: string; tone: number }[] = []
  const gap = h / 16
  for (let j = -1; j * gap < h + gap; j++) {
    const rnd = mulberry32((n * 31 + j + 2) * 7919)
    const tone = rnd() * 2 - 1
    const thick = gap * (0.3 + rnd() * 0.5)
    const phase = rnd() * 9
    const top: string[] = []
    const bottom: string[] = []
    for (let q = -1; q <= 13; q++) {
      const x = (q / 12) * w
      const y = j * gap + Math.sin(x / (w / 5) + phase) * gap * 0.22 + Math.sin(x / (w / 13) + phase * 2.3) * gap * 0.1
      top.push(`${x.toFixed(1)} ${y.toFixed(1)}`)
      bottom.push(`${x.toFixed(1)} ${(y + thick).toFixed(1)}`)
    }
    layers.push({ d: `M${top.join('L')}L${bottom.reverse().join('L')}Z`, tone })
  }
  return layers
}
