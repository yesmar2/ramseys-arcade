import type { JSX } from 'react'

/** Same palette as in-game Asteroids / Centroid rocks. */
const HUE = {
  sky: 198,
  teal: 172,
  gold: 38,
  rose: 348,
  violet: 272,
  orange: 18,
  green: 128,
}

function wash(hue: number, sat = 52) {
  return {
    fill: `hsla(${hue}, ${sat}%, 58%, 0.22)`,
    stroke: `hsla(${hue}, ${sat}%, 42%, 0.95)`,
  }
}

function TileBg({
  dots = [
    [22, 16],
    [140, 24],
    [48, 40],
    [120, 58],
    [70, 20],
  ],
}: {
  dots?: [number, number][]
}) {
  return (
    <>
      <rect width="160" height="96" rx="14" fill="#edf7f4" />
      {dots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.3" fill="rgba(74,168,232,0.28)" />
      ))}
    </>
  )
}

/** Project world (x,y,z) → screen like Stacker’s renderer. */
function p(x: number, y: number, z: number, cx: number, cy: number) {
  return {
    x: cx + (x - z) * 0.9,
    y: cy + (x + z) * 0.5 - y,
  }
}

function pts(...points: { x: number; y: number }[]) {
  return points.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ')
}

function IsoSlab({
  cx,
  cy,
  x = 0,
  z = 0,
  w,
  d,
  h,
  hue,
}: {
  cx: number
  cy: number
  x?: number
  z?: number
  w: number
  d: number
  h: number
  hue: number
}) {
  const hw = w / 2
  const hd = d / 2
  const top = [
    p(x - hw, h, z - hd, cx, cy),
    p(x + hw, h, z - hd, cx, cy),
    p(x + hw, h, z + hd, cx, cy),
    p(x - hw, h, z + hd, cx, cy),
  ]
  const midR = [
    p(x + hw, h, z - hd, cx, cy),
    p(x + hw, h, z + hd, cx, cy),
    p(x + hw, 0, z + hd, cx, cy),
    p(x + hw, 0, z - hd, cx, cy),
  ]
  const midL = [
    p(x - hw, h, z + hd, cx, cy),
    p(x + hw, h, z + hd, cx, cy),
    p(x + hw, 0, z + hd, cx, cy),
    p(x - hw, 0, z + hd, cx, cy),
  ]
  const sat = 52
  const fill = `color-mix(in srgb, hsla(${hue}, ${sat}%, 58%, 1) 22%, #edf7f4)`
  const side = `color-mix(in srgb, hsla(${hue}, ${sat}%, 52%, 1) 22%, #edf7f4)`
  const sideDark = `color-mix(in srgb, hsla(${hue}, ${sat}%, 46%, 1) 22%, #edf7f4)`
  const stroke = `hsla(${hue}, ${sat}%, 42%, 0.95)`

  return (
    <g>
      <polygon points={pts(...midR)} fill={side} stroke={stroke} strokeWidth="1.2" strokeLinejoin="round" />
      <polygon points={pts(...midL)} fill={sideDark} stroke={stroke} strokeWidth="1.2" strokeLinejoin="round" />
      <polygon points={pts(...top)} fill={fill} stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
    </g>
  )
}

export function StackerArt() {
  const baseCy = 78
  const cx = 80

  return (
    <svg
      className="game-tile__art-svg"
      viewBox="0 0 160 96"
      fill="none"
      aria-hidden="true"
    >
      <TileBg />
      <ellipse cx="80" cy="84" rx="48" ry="8" fill="rgba(26,43,60,0.08)" />
      <IsoSlab cx={cx} cy={baseCy} w={56} d={56} h={12} hue={HUE.teal} />
      <g transform="translate(0, -12)">
        <IsoSlab cx={cx} cy={baseCy} w={48} d={48} h={12} hue={HUE.sky} />
      </g>
      <g transform="translate(0, -24)">
        <IsoSlab cx={cx} cy={baseCy} w={40} d={40} h={12} hue={HUE.violet} />
      </g>
      <g transform="translate(0, -36)">
        <IsoSlab cx={cx} cy={baseCy} x={18} w={40} d={40} h={12} hue={HUE.gold} />
      </g>
    </svg>
  )
}

function CitySkyline({
  x,
  ground,
  hue,
  heights,
}: {
  x: number
  ground: number
  hue: number
  heights: [number, number, number]
}) {
  const { fill, stroke } = wash(hue)
  const blocks = [
    { dx: -16, w: 9, h: heights[0] },
    { dx: -5, w: 9, h: heights[1] },
    { dx: 6, w: 9, h: heights[2] },
  ]
  return (
    <g>
      {blocks.map((b) => (
        <rect
          key={b.dx}
          x={x + b.dx}
          y={ground - b.h}
          width={b.w}
          height={b.h}
          fill={fill}
          stroke={stroke}
          strokeWidth="1.4"
        />
      ))}
    </g>
  )
}

export function PatriotArt() {
  const turret = wash(HUE.sky)
  const missile = wash(HUE.rose, 56)
  const ground = 80

  return (
    <svg
      className="game-tile__art-svg"
      viewBox="0 0 160 96"
      fill="none"
      aria-hidden="true"
    >
      <TileBg />
      <rect x="0" y={ground} width="160" height="16" fill="hsla(172, 40%, 58%, 0.16)" />
      <line x1="0" y1={ground} x2="160" y2={ground} stroke="hsla(172, 52%, 42%, 0.7)" strokeWidth="2" />

      <CitySkyline x={28} ground={ground} hue={HUE.sky} heights={[18, 28, 16]} />
      <CitySkyline x={132} ground={ground} hue={HUE.teal} heights={[16, 26, 20]} />

      <path
        d="M70 80 L70 70 L76 70 L76 56 L78.5 56 L78.5 48 L83.5 48 L83.5 56 L86 56 L86 70 L92 70 L92 80 Z"
        fill={turret.fill}
        stroke={turret.stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      <line
        x1="124"
        y1="10"
        x2="100"
        y2="34"
        stroke={missile.stroke}
        strokeWidth="2"
        strokeLinecap="butt"
      />
      <circle cx="96" cy="38" r="4" fill={missile.fill} stroke={missile.stroke} strokeWidth="1.4" />
    </svg>
  )
}

export function SnakeArt() {
  const food = wash(HUE.gold, 58)
  const beads = [
    { cx: 36, cy: 52, hue: 198 },
    { cx: 51, cy: 52, hue: 186 },
    { cx: 66, cy: 52, hue: 174 },
    { cx: 81, cy: 52, hue: 166 },
    { cx: 96, cy: 52, hue: 158 },
  ]

  return (
    <svg
      className="game-tile__art-svg"
      viewBox="0 0 160 96"
      fill="none"
      aria-hidden="true"
    >
      <TileBg dots={[[22, 18], [138, 22], [120, 40]]} />

      <rect x="18" y="16" width="124" height="64" rx="12" fill="rgba(255,255,255,0.45)" />
      <rect
        x="18"
        y="16"
        width="124"
        height="64"
        rx="12"
        stroke="rgba(26,43,60,0.06)"
        strokeWidth="1"
      />

      {beads.map((b) => {
        const { fill, stroke } = wash(b.hue)
        return (
          <circle
            key={b.cx}
            cx={b.cx}
            cy={b.cy}
            r="7.5"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
          />
        )
      })}
      <circle cx="92.5" cy="48.5" r="1.6" fill="#fff" />
      <circle cx="99.5" cy="48.5" r="1.6" fill="#fff" />
      <circle cx="92.9" cy="48.5" r="0.7" fill="#1a2b3c" />
      <circle cx="99.9" cy="48.5" r="0.7" fill="#1a2b3c" />

      <circle cx="118" cy="36" r="7" {...food} strokeWidth="1.6" />
      <circle cx="116.5" cy="34.5" r="1.3" fill="rgba(255,255,255,0.55)" />
    </svg>
  )
}

export function WhackArt() {
  const idle = wash(HUE.sky, 52)
  const live = wash(HUE.teal, 52)
  const warm = wash(HUE.gold, 58)

  return (
    <svg
      className="game-tile__art-svg"
      viewBox="0 0 160 96"
      fill="none"
      aria-hidden="true"
    >
      <TileBg />
      {[
        [44, 32, idle],
        [80, 32, live],
        [116, 32, idle],
        [44, 56, live],
        [80, 56, idle],
        [116, 56, warm],
        [44, 80, idle],
        [80, 80, idle],
        [116, 80, live],
      ].map(([cx, cy, style], i) => (
        <circle
          key={i}
          cx={cx as number}
          cy={cy as number}
          r={i === 1 || i === 5 ? 11 : 9}
          fill={(style as { fill: string }).fill}
          stroke={(style as { stroke: string }).stroke}
          strokeWidth="1.6"
        />
      ))}
    </svg>
  )
}

export function DeadCenterArt() {
  const tri = wash(HUE.sky, 54)
  const center = wash(HUE.teal, 55)
  const guess = wash(HUE.sky, 56)

  return (
    <svg
      className="game-tile__art-svg"
      viewBox="0 0 160 96"
      fill="none"
      aria-hidden="true"
    >
      <TileBg />
      <path d="M42 72 L88 22 L128 68 Z" {...tri} strokeWidth="2" strokeLinejoin="round" />

      <circle cx="86" cy="54" r="10" fill="hsla(172, 55%, 58%, 0.22)" />
      <circle cx="86" cy="54" r="6" fill="none" stroke={center.stroke} strokeWidth="1.4" />
      <circle cx="86" cy="54" r="2.2" fill={center.stroke} />

      <circle cx="102" cy="46" r="8" fill="hsla(198, 56%, 58%, 0.2)" />
      <circle cx="102" cy="46" r="5" fill="none" stroke={guess.stroke} strokeWidth="1.3" />
      <circle cx="102" cy="46" r="2" fill={guess.stroke} />
    </svg>
  )
}

export function AsteroidsArt() {
  const rockA = wash(HUE.sky)
  const rockB = wash(HUE.violet)
  const rockC = wash(HUE.gold)
  const ship = wash(HUE.teal, 55)

  return (
    <svg
      className="game-tile__art-svg"
      viewBox="0 0 160 96"
      fill="none"
      aria-hidden="true"
    >
      <TileBg />
      <path
        d="M28 62 L38 48 L54 50 L58 64 L46 74 L30 70 Z"
        {...rockA}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M118 34 L130 28 L142 38 L136 52 L122 50 Z"
        {...rockB}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M104 68 L112 62 L122 66 L118 76 L106 74 Z"
        {...rockC}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M78 40 L68 58 L88 58 Z"
        {...ship}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M74 58 L78 66 L82 58"
        fill="none"
        stroke={`hsla(${HUE.gold}, 58%, 42%, 0.95)`}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="90" cy="30" r="2.4" fill={`hsla(${HUE.sky}, 52%, 48%, 0.9)`} />
    </svg>
  )
}

export function SimonArt() {
  const pads = [
    { x: 49, y: 17, hue: HUE.sky },
    { x: 83, y: 17, hue: HUE.teal },
    { x: 49, y: 51, hue: HUE.gold },
    { x: 83, y: 51, hue: HUE.rose },
  ]

  return (
    <svg
      className="game-tile__art-svg"
      viewBox="0 0 160 96"
      fill="none"
      aria-hidden="true"
    >
      <TileBg />
      {pads.map((p) => {
        const { fill, stroke } = wash(p.hue)
        return (
          <rect
            key={`${p.x}-${p.y}`}
            x={p.x}
            y={p.y}
            width="28"
            height="28"
            rx="8"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.8"
          />
        )
      })}
    </svg>
  )
}

const artBySlug: Record<string, () => JSX.Element> = {
  stacker: StackerArt,
  patriot: PatriotArt,
  snake: SnakeArt,
  'pop': WhackArt,
  'dead-center': DeadCenterArt,
  asteroids: AsteroidsArt,
  simon: SimonArt,
}

export function GameTileArt({ slug }: { slug: string }) {
  const Art = artBySlug[slug]
  if (!Art) return <div className="game-tile__swatch" aria-hidden="true" />
  return (
    <div className="game-tile__art" aria-hidden="true">
      <Art />
    </div>
  )
}
