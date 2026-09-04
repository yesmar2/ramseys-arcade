import type { JSX, ReactNode } from 'react'
import { patriotCityRects } from '../games/patriot/cityArt'
import { accentPastel, HUE, pastel } from './gameArtStyle'

function TileBg() {
  return (
    <g className="tile-art__bg">
      <rect width="160" height="100" fill="var(--playfield)" />
      <ellipse
        className="tile-art__wash"
        cx="80"
        cy="40"
        rx="72"
        ry="50"
        fill="var(--tile-accent, var(--accent))"
        opacity="0.1"
      />
      <ellipse
        cx="80"
        cy="108"
        rx="90"
        ry="28"
        fill="rgba(var(--ink-rgb), 0.04)"
      />
      <circle cx="28" cy="18" r="1.4" fill="var(--tile-accent, var(--accent))" opacity="0.22" />
      <circle cx="132" cy="26" r="1.1" fill="var(--tile-accent, var(--accent))" opacity="0.18" />
      <circle cx="118" cy="14" r="0.9" fill="var(--ink)" opacity="0.12" />
      <circle cx="46" cy="12" r="0.8" fill="var(--ink)" opacity="0.1" />
    </g>
  )
}

function SvgFrame({ children }: { children: ReactNode }) {
  return (
    <svg
      className="game-tile__art-svg"
      viewBox="0 0 160 100"
      preserveAspectRatio="xMidYMid meet"
      fill="none"
      aria-hidden="true"
    >
      {children}
    </svg>
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

export function IsoSlab({
  cx,
  cy,
  x = 0,
  z = 0,
  w,
  d,
  h,
  hue,
  accent,
  strokeWidth = 1.2,
}: {
  cx: number
  cy: number
  x?: number
  z?: number
  w: number
  d: number
  h: number
  hue: number
  accent?: string
  strokeWidth?: number
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
  const sat = 56
  const fill = accent
    ? accentPastel(accent, 52).fill
    : `color-mix(in srgb, hsla(${hue}, ${sat}%, 56%, 1) 52%, var(--playfield))`
  const side = accent
    ? accentPastel(accent, 44).fill
    : `color-mix(in srgb, hsla(${hue}, ${sat}%, 50%, 1) 48%, var(--playfield))`
  const sideDark = accent
    ? accentPastel(accent, 36).fill
    : `color-mix(in srgb, hsla(${hue}, ${sat}%, 42%, 1) 48%, var(--playfield))`
  const stroke = accent
    ? accentPastel(accent, 48).stroke
    : `hsla(${hue}, ${sat}%, 36%, 0.95)`

  return (
    <g>
      <polygon points={pts(...midR)} fill={side} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <polygon points={pts(...midL)} fill={sideDark} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <polygon points={pts(...top)} fill={fill} stroke={stroke} strokeWidth={strokeWidth + 0.15} strokeLinejoin="round" />
    </g>
  )
}

export function StackerArt() {
  const baseCy = 62
  const cx = 80

  return (
    <SvgFrame>
      <TileBg />
      <ellipse cx="80" cy="74" rx="48" ry="8" fill="rgba(var(--ink-rgb), 0.1)" />
      <IsoSlab cx={cx} cy={baseCy} w={52} d={52} h={11} hue={HUE.teal} />
      <g transform="translate(0, -11)">
        <IsoSlab cx={cx} cy={baseCy} w={44} d={44} h={11} hue={HUE.sky} />
      </g>
      <g transform="translate(0, -22)">
        <IsoSlab cx={cx} cy={baseCy} w={36} d={36} h={11} hue={HUE.violet} />
      </g>
      <g transform="translate(0, -33)">
        <IsoSlab cx={cx} cy={baseCy} x={16} w={36} d={36} h={11} hue={HUE.gold} />
      </g>
    </SvgFrame>
  )
}

function CitySkyline({
  x,
  ground,
  cityId,
  scale,
  illustration = false,
}: {
  x: number
  ground: number
  cityId: number
  scale: number
  illustration?: boolean
}) {
  return (
    <g>
      {patriotCityRects(x, ground, scale, cityId, illustration).map((block, i) => {
        const { fill, stroke } = pastel(block.hue, 54, 42)
        return (
          <rect
            key={i}
            x={block.x}
            y={block.y}
            width={block.width}
            height={block.height}
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        )
      })}
    </g>
  )
}

export function PatriotArt() {
  const incoming = pastel(HUE.rose, 60, 52)
  const ground = 78
  const cityScale = 0.62

  return (
    <SvgFrame>
      <TileBg />
      <CitySkyline x={28} ground={ground} cityId={0} scale={cityScale} illustration />
      <CitySkyline x={80} ground={ground} cityId={2} scale={cityScale} illustration />
      <CitySkyline x={132} ground={ground} cityId={1} scale={cityScale} illustration />

      <line
        x1="118"
        y1="4"
        x2="128"
        y2="20"
        stroke={incoming.stroke}
        strokeWidth="1.7"
        strokeLinecap="butt"
        opacity="0.9"
      />
      <circle cx="130" cy="24" r="3.8" fill={incoming.fill} stroke={incoming.stroke} strokeWidth="1.5" />

      <line
        x1="42"
        y1="22"
        x2="54"
        y2="40"
        stroke={incoming.stroke}
        strokeWidth="1.7"
        strokeLinecap="butt"
        opacity="0.9"
      />
      <circle cx="56" cy="44" r="3.8" fill={incoming.fill} stroke={incoming.stroke} strokeWidth="1.5" />
    </SvgFrame>
  )
}

export function SnakeArt() {
  const food = pastel(HUE.gold, 62, 58)
  const size = 14
  const step = 14
  const x0 = 42
  const y0 = 22
  const cells = [
    { c: 0, r: 0, hue: 208 },
    { c: 1, r: 0, hue: 198 },
    { c: 2, r: 0, hue: 188 },
    { c: 2, r: 1, hue: 178 },
    { c: 2, r: 2, hue: 168 },
    { c: 3, r: 2, hue: 158 },
  ]
  const headCx = x0 + 3 * step + size / 2
  const headCy = y0 + 2 * step + size / 2

  return (
    <SvgFrame>
      <TileBg />
      {cells.map((b) => {
        const { fill, stroke } = pastel(b.hue, 60, 50)
        return (
          <circle
            key={`${b.c}-${b.r}`}
            cx={x0 + b.c * step + size / 2}
            cy={y0 + b.r * step + size / 2}
            r={size / 2}
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
          />
        )
      })}
      <circle cx={headCx + 3.2} cy={headCy - 2.6} r="1.5" fill="#fff" />
      <circle cx={headCx + 3.2} cy={headCy + 2.6} r="1.5" fill="#fff" />
      <circle cx={headCx + 3.5} cy={headCy - 2.6} r="0.65" fill="#1a2b3c" />
      <circle cx={headCx + 3.5} cy={headCy + 2.6} r="0.65" fill="#1a2b3c" />
      <circle cx={x0 + 4 * step + size / 2} cy={headCy} r="5.2" {...food} strokeWidth="1.5" />
      <circle
        cx={x0 + 4 * step + size / 2 - 1.4}
        cy={headCy - 1.5}
        r="1.1"
        fill="rgba(255,255,255,0.55)"
      />
    </SvgFrame>
  )
}

export function WhackArt() {
  const hues = [198, 172, 348, 272, 128, 38, 198, 172, 348]
  const live = new Set([1, 5])
  const gold = 5
  const gap = 24
  const r = 10
  const originX = 80 - gap
  const originY = 26

  return (
    <SvgFrame>
      <TileBg />
      {hues.map((hue, i) => {
        const col = i % 3
        const row = Math.floor(i / 3)
        const cx = originX + col * gap
        const cy = originY + row * gap
        const sat = i === gold ? 62 : 54
        const on = live.has(i)
        const { fill, stroke } = pastel(hue, sat, on ? 78 : 22)
        return (
          <g key={i}>
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill={fill}
              stroke={stroke}
              strokeOpacity={on ? 1 : 0.7}
              strokeWidth={on ? 1.7 : 1.35}
            />
            {on && (
              <circle
                cx={cx}
                cy={cy}
                r={r * 0.42}
                fill="none"
                stroke={stroke}
                strokeWidth="1.5"
              />
            )}
          </g>
        )
      })}
    </SvgFrame>
  )
}

export function DeadCenterArt() {
  const tri = pastel(HUE.sky, 56, 46)

  return (
    <SvgFrame>
      <TileBg />
      <path d="M44 70 L84 24 L126 66 Z" {...tri} strokeWidth="2" strokeLinejoin="round" />
      <circle cx={(44 + 84 + 126) / 3} cy={(70 + 24 + 66) / 3} r="3.4" fill="#2eb8a0" />
    </SvgFrame>
  )
}

export function AsteroidsArt() {
  const large = pastel(HUE.green, 52, 40)
  const med = pastel(HUE.teal, 54, 42)
  const small = pastel(148, 56, 44)
  const shipFill = 'color-mix(in srgb, #2eb87a 28%, var(--playfield))'
  const shipStroke = '#2eb87a'

  return (
    <SvgFrame>
      <TileBg />
      <path
        d="M14 28 L26 14 L48 16 L54 34 L40 46 L18 42 Z"
        {...large}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M118 14 L134 12 L148 24 L142 40 L124 38 L114 24 Z"
        {...med}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M118 68 L130 60 L146 66 L140 82 L122 84 L112 74 Z"
        {...small}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M18 72 L28 64 L42 70 L36 82 L22 82 Z"
        {...small}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <g transform="translate(80 50)">
        <path
          d="M0 -13 L-9.5 10 L0 5 L9.5 10 Z"
          fill={shipFill}
          stroke={shipStroke}
          strokeWidth="2.3"
          strokeLinejoin="round"
        />
        <path
          d="M-4.5 8.5 L0 16.5 L4.5 8.5"
          fill="none"
          stroke="#f5b942"
          strokeWidth="1.9"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </g>
      <circle cx="80" cy="22" r="1.8" fill="#4aa8e8" />
    </SvgFrame>
  )
}

export function SimonArt() {
  const r = 15
  const gap = 7
  const cx = 80
  const cy = 50
  const d = r + gap / 2
  const pads = [
    { x: cx - d, y: cy - d, hue: 198, lit: false },
    { x: cx + d, y: cy - d, hue: 172, lit: true },
    { x: cx - d, y: cy + d, hue: 38, lit: false },
    { x: cx + d, y: cy + d, hue: 348, lit: false },
  ]

  return (
    <SvgFrame>
      <TileBg />
      {pads.map((pad) => {
        const { fill, stroke } = pastel(pad.hue, 56, pad.lit ? 62 : 40)
        return (
          <circle
            key={`${pad.x}-${pad.y}`}
            cx={pad.x}
            cy={pad.y}
            r={pad.lit ? r * 1.04 : r}
            fill={fill}
            stroke={stroke}
            strokeWidth="2"
          />
        )
      })}
    </SvgFrame>
  )
}

/** Frogger / Crossy Road vibe — lanes, cars, a hopper. */
/** Frogger vibe — bays up top, river in the middle, traffic below. */
export function CrosswalkArt() {
  const hedge = pastel(HUE.green, 42, 42)
  const bay = pastel(HUE.sky, 48, 30)
  const water = pastel(HUE.sky, 54, 26)
  const log = pastel(HUE.gold, 38, 46)
  const road = pastel(HUE.sky, 18, 14)
  const carA = pastel(HUE.rose, 58, 52)
  const carB = pastel(HUE.violet, 58, 50)
  const frog = pastel(HUE.green, 58, 55)

  return (
    <SvgFrame>
      <TileBg />
      <rect x="18" y="14" width="124" height="12" rx="3" fill={hedge.fill} stroke={hedge.stroke} strokeWidth="1.2" />
      {[25, 49, 72, 95, 119].map((x) => (
        <rect key={x} x={x} y="16" width="16" height="8" rx="2.5" fill={bay.fill} stroke={bay.stroke} strokeWidth="1" />
      ))}

      <rect x="18" y="29" width="124" height="21" rx="3" fill={water.fill} stroke={water.stroke} strokeWidth="1.2" />
      <rect x="26" y="31.5" width="44" height="7.5" rx="3.7" fill={log.fill} stroke={log.stroke} strokeWidth="1.2" />
      <rect x="88" y="40" width="36" height="7.5" rx="3.7" fill={log.fill} stroke={log.stroke} strokeWidth="1.2" />

      <rect x="18" y="53" width="124" height="21" rx="3" fill={road.fill} stroke={road.stroke} strokeWidth="1.2" />
      {[28, 50, 72, 94, 116].map((x) => (
        <rect key={`d-${x}`} x={x} y="62.5" width="9" height="2" rx="1" fill="rgba(var(--ink-rgb), 0.18)" />
      ))}
      <rect x="28" y="55.5" width="22" height="8" rx="2.5" fill={carA.fill} stroke={carA.stroke} strokeWidth="1.2" />
      <rect x="92" y="64" width="24" height="8" rx="2.5" fill={carB.fill} stroke={carB.stroke} strokeWidth="1.2" />

      <ellipse cx="80" cy="84" rx="8" ry="6.2" fill={frog.fill} stroke={frog.stroke} strokeWidth="1.5" />
      <circle cx="77" cy="82.4" r="1.3" fill="#1a2b3c" />
      <circle cx="83" cy="82.4" r="1.3" fill="#1a2b3c" />
    </SvgFrame>
  )
}

/** Pac-Man vibe — open mouth, dots, a ghost. */
export function PelletsArt() {
  const muncher = pastel(HUE.gold, 62, 58)
  const ghost = pastel(HUE.rose, 58, 52)
  const pellet = pastel(HUE.sky, 50, 40)

  return (
    <SvgFrame>
      <TileBg />
      <path
        d="M70 50 L92 28 A24 24 0 1 0 92 72 Z"
        fill={muncher.fill}
        stroke={muncher.stroke}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="66" cy="40" r="2.2" fill="#1a2b3c" />
      {[108, 122, 136].map((x) => (
        <circle key={x} cx={x} cy="50" r="3.2" fill={pellet.fill} stroke={pellet.stroke} strokeWidth="1.2" />
      ))}
      <path
        d="M118 78 L118 60 Q118 50 128 50 Q138 50 138 60 L138 78 L133 72 L128 78 L123 72 Z"
        fill={ghost.fill}
        stroke={ghost.stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="124" cy="58" r="2" fill="#fff" />
      <circle cx="132" cy="58" r="2" fill="#fff" />
      <circle cx="124.6" cy="58.4" r="0.9" fill="#1a2b3c" />
      <circle cx="132.6" cy="58.4" r="0.9" fill="#1a2b3c" />
    </SvgFrame>
  )
}

/** Space Invaders vibe — rows of aliens + a ground cannon. */
export function BarrageArt() {
  const alien = pastel(HUE.violet, 56, 48)
  const alienB = pastel(HUE.sky, 54, 46)
  const cannon = pastel(HUE.rose, 56, 50)

  const row = (y: number, hueFill: ReturnType<typeof pastel>, cols: number[]) =>
    cols.map((x) => (
      <g key={`${y}-${x}`}>
        <rect
          x={x - 7}
          y={y - 5}
          width="14"
          height="10"
          rx="2"
          fill={hueFill.fill}
          stroke={hueFill.stroke}
          strokeWidth="1.3"
        />
        <circle cx={x - 3} cy={y - 1} r="1.2" fill="#1a2b3c" />
        <circle cx={x + 3} cy={y - 1} r="1.2" fill="#1a2b3c" />
      </g>
    ))

  return (
    <SvgFrame>
      <TileBg />
      {row(24, alien, [40, 64, 88, 112])}
      {row(42, alienB, [52, 76, 100])}
      <path
        d="M72 78 L80 68 L88 78 L88 84 L72 84 Z"
        fill={cannon.fill}
        stroke={cannon.stroke}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <rect x="28" y="88" width="104" height="3" rx="1.5" fill="rgba(var(--ink-rgb), 0.12)" />
      <line
        x1="80"
        y1="62"
        x2="80"
        y2="54"
        stroke={cannon.stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </SvgFrame>
  )
}

export function SpotterArt() {
  const accent = pastel(HUE.violet, 54, 44)
  const cells = [
    { x: 36, y: 28, w: 28, h: 28 },
    { x: 68, y: 28, w: 28, h: 28 },
    { x: 100, y: 28, w: 28, h: 28 },
    { x: 36, y: 60, w: 28, h: 28 },
    { x: 68, y: 60, w: 28, h: 28, glitch: true },
    { x: 100, y: 60, w: 28, h: 28 },
    { x: 36, y: 92, w: 28, h: 28 },
    { x: 68, y: 92, w: 28, h: 28 },
    { x: 100, y: 92, w: 28, h: 28 },
  ]
  return (
    <SvgFrame>
      <TileBg />
      {cells.map((c) => {
        const tone = c.glitch ? pastel(HUE.rose, 56, 50) : accent
        return (
          <rect
            key={`${c.x}-${c.y}`}
            x={c.x}
            y={c.y}
            width={c.w}
            height={c.h}
            rx="6"
            fill={tone.fill}
            stroke={tone.stroke}
            strokeWidth="1.5"
          />
        )
      })}
      <circle cx="118" cy="38" r="12" fill="none" stroke={accent.stroke} strokeWidth="2" />
      <line x1="126" y1="46" x2="136" y2="56" stroke={accent.stroke} strokeWidth="2.5" strokeLinecap="round" />
    </SvgFrame>
  )
}

export function StrideArt() {
  const grass = pastel(HUE.green, 54, 44)
  const road = pastel(220, 20, 72)
  const hopper = pastel(HUE.gold, 58, 52)
  const car = pastel(HUE.rose, 56, 50)
  const ground = 82

  return (
    <SvgFrame>
      <TileBg />
      <rect x="20" y="28" width="120" height="22" rx="4" fill={grass.fill} stroke={grass.stroke} strokeWidth="1.4" />
      <rect x="20" y="52" width="120" height="22" rx="4" fill={road.fill} stroke={road.stroke} strokeWidth="1.4" />
      <rect x="34" y="58" width="28" height="12" rx="3" fill={car.fill} stroke={car.stroke} strokeWidth="1.3" />
      <rect x="88" y="58" width="34" height="12" rx="3" fill={car.fill} stroke={car.stroke} strokeWidth="1.3" />
      <ellipse cx="80" cy={ground} rx="9" ry="7.5" fill={hopper.fill} stroke={hopper.stroke} strokeWidth="1.6" />
    </SvgFrame>
  )
}

const artBySlug: Record<string, () => JSX.Element> = {
  stacker: StackerArt,
  patriot: PatriotArt,
  snake: SnakeArt,
  pop: WhackArt,
  'centroid': DeadCenterArt,
  asteroids: AsteroidsArt,
  simon: SimonArt,
  crosswalk: CrosswalkArt,
  stride: StrideArt,
  spotter: SpotterArt,
  pellets: PelletsArt,
  barrage: BarrageArt,
}

export function GameTileArt({ slug }: { slug: string }) {
  const Art = artBySlug[slug]
  if (!Art) return <div className="game-tile__swatch" />
  return <Art />
}
