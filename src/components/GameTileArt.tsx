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
    fill: `hsla(${hue}, ${sat}%, 58%, 0.42)`,
    stroke: `hsla(${hue}, ${sat}%, 42%, 0.95)`,
  }
}

/** More solid pastel for small thumbnails — alpha washes read as empty rings. */
function pastel(hue: number, sat = 52, mix = 40) {
  return {
    fill: `color-mix(in srgb, hsla(${hue}, ${sat}%, 58%, 1) ${mix}%, #edf7f4)`,
    stroke: `hsla(${hue}, ${sat}%, 42%, 0.95)`,
  }
}

function TileBg({
  dots = [
    [22, 14],
    [140, 20],
    [48, 34],
    [118, 42],
    [70, 18],
    [36, 102],
    [124, 108],
  ],
}: {
  dots?: [number, number][]
}) {
  return (
    <>
      <rect width="160" height="120" fill="#edf7f4" />
      {dots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.3" fill="rgba(74,168,232,0.28)" />
      ))}
    </>
  )
}

function SvgFrame({ children }: { children: JSX.Element | JSX.Element[] }) {
  return (
    <svg
      className="game-tile__art-svg"
      viewBox="0 0 160 120"
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
  const fill = `color-mix(in srgb, hsla(${hue}, ${sat}%, 58%, 1) 40%, #edf7f4)`
  const side = `color-mix(in srgb, hsla(${hue}, ${sat}%, 52%, 1) 40%, #edf7f4)`
  const sideDark = `color-mix(in srgb, hsla(${hue}, ${sat}%, 46%, 1) 40%, #edf7f4)`
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
  const baseCy = 42
  const cx = 80

  return (
    <SvgFrame>
      <TileBg />
      <ellipse cx="80" cy="50" rx="44" ry="7" fill="rgba(26,43,60,0.08)" />
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
  const ground = 54

  return (
    <SvgFrame>
      <TileBg />
      <rect x="0" y={ground} width="160" height="58" fill="hsla(172, 40%, 58%, 0.16)" />
      <line x1="0" y1={ground} x2="160" y2={ground} stroke="hsla(172, 52%, 42%, 0.7)" strokeWidth="2" />

      <CitySkyline x={30} ground={ground} hue={HUE.sky} heights={[16, 24, 14]} />
      <CitySkyline x={130} ground={ground} hue={HUE.teal} heights={[14, 22, 18]} />

      <path
        d="M71 54 L71 44 L77 44 L77 32 L79.5 32 L79.5 24 L84.5 24 L84.5 32 L87 32 L87 44 L93 44 L93 54 Z"
        fill={turret.fill}
        stroke={turret.stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      <line
        x1="126"
        y1="8"
        x2="102"
        y2="28"
        stroke={missile.stroke}
        strokeWidth="2"
        strokeLinecap="butt"
      />
      <circle cx="98" cy="32" r="4" fill={missile.fill} stroke={missile.stroke} strokeWidth="1.4" />
    </SvgFrame>
  )
}

export function SnakeArt() {
  const food = pastel(HUE.gold, 58, 48)
  const size = 14
  const step = 14
  const x0 = 42
  const y0 = 18
  const cells = [
    { c: 0, r: 0, hue: 210 },
    { c: 1, r: 0, hue: 198 },
    { c: 2, r: 0, hue: 186 },
    { c: 2, r: 1, hue: 174 },
    { c: 2, r: 2, hue: 166 },
    { c: 3, r: 2, hue: 158 },
  ]
  const headCx = x0 + 3 * step + size / 2
  const headCy = y0 + 2 * step + size / 2

  return (
    <SvgFrame>
      <TileBg dots={[]} />
      <rect
        x="28"
        y="10"
        width="104"
        height="64"
        rx="10"
        fill="rgba(255,255,255,0.55)"
        stroke="rgba(26,43,60,0.06)"
      />
      {Array.from({ length: 5 }, (_, r) =>
        Array.from({ length: 7 }, (_, c) => (
          <circle
            key={`${c}-${r}`}
            cx={38 + c * 14}
            cy={22 + r * 14}
            r="1.05"
            fill="rgba(46, 184, 160, 0.18)"
          />
        )),
      )}
      {cells.map((b) => {
        const { fill, stroke } = pastel(b.hue, 58, 42)
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
  const originY = 12

  return (
    <SvgFrame>
      <TileBg />
      {hues.map((hue, i) => {
        const col = i % 3
        const row = Math.floor(i / 3)
        const cx = originX + col * gap
        const cy = originY + row * gap
        const sat = i === gold ? 58 : 52
        const on = live.has(i)
        const { fill, stroke } = pastel(hue, sat, on ? 72 : 16)
        const outer = on ? r : r * 0.78
        return (
          <g key={i}>
            <circle
              cx={cx}
              cy={cy}
              r={outer}
              fill={fill}
              stroke={stroke}
              strokeOpacity={on ? 1 : 0.7}
              strokeWidth={on ? 1.7 : 1.35}
            />
            {on && (
              <circle
                cx={cx}
                cy={cy}
                r={outer * 0.42}
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
  const tri = pastel(HUE.sky, 54, 38)

  return (
    <SvgFrame>
      <TileBg dots={[]} />
      <path d="M44 52 L84 8 L126 48 Z" {...tri} strokeWidth="2" strokeLinejoin="round" />
      <circle cx={(44 + 84 + 126) / 3} cy={(52 + 8 + 48) / 3} r="3.4" fill="#2eb8a0" />
    </SvgFrame>
  )
}

export function AsteroidsArt() {
  const rockA = wash(HUE.sky)
  const rockB = wash(HUE.violet)
  const rockC = wash(HUE.gold)
  const ship = wash(HUE.teal, 55)

  return (
    <SvgFrame>
      <TileBg />
      <g transform="translate(0, -8)">
        <path
          d="M26 50 L36 36 L52 38 L56 52 L44 62 L28 58 Z"
          {...rockA}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M116 24 L128 18 L140 28 L134 42 L120 40 Z"
          {...rockB}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M112 54 L120 48 L130 52 L126 62 L114 60 Z"
          {...rockC}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M78 28 L68 46 L88 46 Z"
          {...ship}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M74 46 L78 54 L82 46"
          fill="none"
          stroke={`hsla(${HUE.gold}, 58%, 42%, 0.95)`}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="90" cy="20" r="2.4" fill={`hsla(${HUE.sky}, 52%, 48%, 0.9)`} />
      </g>
    </SvgFrame>
  )
}

export function SimonArt() {
  const r = 15
  const gap = 7
  const cx = 80
  const cy = 34
  const d = r + gap / 2
  const pads = [
    { x: cx - d, y: cy - d, hue: 198, lit: false },
    { x: cx + d, y: cy - d, hue: 172, lit: true },
    { x: cx - d, y: cy + d, hue: 38, lit: false },
    { x: cx + d, y: cy + d, hue: 348, lit: false },
  ]

  return (
    <SvgFrame>
      <TileBg dots={[]} />
      {pads.map((p) => {
        const { fill, stroke } = pastel(p.hue, 52, p.lit ? 52 : 38)
        return (
          <circle
            key={`${p.x}-${p.y}`}
            cx={p.x}
            cy={p.y}
            r={p.lit ? r * 1.04 : r}
            fill={fill}
            stroke={stroke}
            strokeWidth="2"
          />
        )
      })}
    </SvgFrame>
  )
}

const artBySlug: Record<string, () => JSX.Element> = {
  stacker: StackerArt,
  patriot: PatriotArt,
  snake: SnakeArt,
  pop: WhackArt,
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
