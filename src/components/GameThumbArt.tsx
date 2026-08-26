import type { CSSProperties, ReactNode } from 'react'
import { accentPastel, HUE, pastel } from './gameArtStyle'
import { IsoSlab } from './GameTileArt'

type GameThumbArtProps = {
  slug: string
  accent?: string
  className?: string
}

function ThumbSvg({ children }: { children: ReactNode }) {
  return (
    <svg
      className="game-thumb__svg"
      viewBox="0 0 32 32"
      preserveAspectRatio="xMidYMid meet"
      fill="none"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

function shape(props: ReturnType<typeof pastel>, strokeWidth = 1.5) {
  return {
    fill: props.fill,
    stroke: props.stroke,
    strokeWidth,
    strokeLinejoin: 'round' as const,
  }
}

/** Single-accent thumbs (Patriot, Asteroids, Centroid). */
function AsteroidsThumb({ accent }: { accent?: string }) {
  const a = accent ?? '#2eb87a'
  const shipFill = `color-mix(in srgb, ${a} 28%, var(--playfield))`

  return (
    <g transform="translate(16 16.2)">
      <path
        d="M0 -11 L-8 7.5 L0 3 L8 7.5 Z"
        fill={shipFill}
        stroke={a}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M-3.4 6.8 L0 12 L3.4 6.8"
        fill="none"
        stroke="#f5b942"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  )
}

function PatriotThumb({ accent }: { accent?: string }) {
  const ground = 25
  const x = 16
  const blocks = [
    { dx: -8, w: 5, h: 11 },
    { dx: -2, w: 5, h: 17 },
    { dx: 4, w: 5, h: 13 },
  ]
  const block = accent
    ? accentPastel(accent, 44)
    : pastel(HUE.rose, 54, 42)

  return (
    <>
      {blocks.map((b) => (
        <rect
          key={b.dx}
          x={x + b.dx}
          y={ground - b.h}
          width={b.w}
          height={b.h}
          rx="1"
          {...shape(block, 1.4)}
        />
      ))}
    </>
  )
}

function SnakeThumb() {
  const cells = [
    { cx: 8, cy: 20, hue: 208 },
    { cx: 14.5, cy: 20, hue: 198 },
    { cx: 21, cy: 20, hue: 188 },
    { cx: 21, cy: 13.5, hue: 178 },
    { cx: 27.5, cy: 13.5, hue: 168 },
  ]

  return (
    <>
      {cells.map((cell, i) => (
        <circle
          key={i}
          cx={cell.cx}
          cy={cell.cy}
          r="2.9"
          {...shape(pastel(cell.hue, 60, 50), 1.2)}
        />
      ))}
      <circle cx="28.3" cy="12.4" r="0.65" fill="#fff" />
      <circle cx="28.3" cy="14.6" r="0.65" fill="#fff" />
      <circle cx="28.5" cy="12.4" r="0.32" fill="#1a2b3c" />
      <circle cx="28.5" cy="14.6" r="0.32" fill="#1a2b3c" />
    </>
  )
}

function PopThumb() {
  const hues = [198, 172, 348, 272, 128, 38, 198, 172, 348]
  const live = new Set([5])
  const gap = 7
  const r = 2.9
  const originX = 16 - gap
  const originY = 16 - gap

  return (
    <>
      {hues.map((hue, i) => {
        const col = i % 3
        const row = Math.floor(i / 3)
        const cx = originX + col * gap
        const cy = originY + row * gap
        const sat = i === 5 ? 62 : 54
        const on = live.has(i)
        const p = pastel(hue, sat, on ? 78 : 22)
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill={p.fill}
            stroke={p.stroke}
            strokeOpacity={on ? 1 : 0.7}
            strokeWidth={on ? 1.4 : 1.1}
          />
        )
      })}
    </>
  )
}

function StackerThumb() {
  const baseCy = 22
  const cx = 16

  return (
    <>
      <IsoSlab cx={cx} cy={baseCy} w={16} d={16} h={4} hue={HUE.teal} />
      <g transform="translate(0, -4)">
        <IsoSlab cx={cx} cy={baseCy} w={13} d={13} h={4} hue={HUE.sky} />
      </g>
      <g transform="translate(0, -8)">
        <IsoSlab cx={cx} cy={baseCy} w={11} d={11} h={4} hue={HUE.violet} />
      </g>
      <g transform="translate(0, -12)">
        <IsoSlab cx={cx} cy={baseCy} x={4} w={11} d={11} h={4} hue={HUE.gold} />
      </g>
    </>
  )
}

function DeadCenterThumb({ accent }: { accent?: string }) {
  const tri = accent ? accentPastel(accent, 46) : pastel(HUE.sky, 56, 46)
  const dot = accent ?? '#2eb8a0'

  return (
    <>
      <path d="M16 5.5 L27.5 26.5 L4.5 26.5 Z" {...shape(tri, 1.7)} />
      <circle cx="16" cy="18.2" r="1.9" fill={dot} />
    </>
  )
}

function CrosswalkThumb({ accent }: { accent?: string }) {
  const hopper = accent ?? '#3ecf8e'
  const hedge = pastel(HUE.green, 42, 42)
  const bay = pastel(HUE.sky, 48, 30)
  const water = pastel(HUE.sky, 54, 26)
  const log = pastel(HUE.gold, 38, 46)
  const road = pastel(HUE.sky, 18, 14)
  const carA = pastel(HUE.rose, 58, 52)
  const carB = pastel(HUE.violet, 58, 50)

  return (
    <>
      <rect x="4" y="3" width="24" height="4.2" rx="1" fill={hedge.fill} stroke={hedge.stroke} strokeWidth="0.7" />
      {[5.3, 9.9, 14.4, 18.9, 23.5].map((x) => (
        <rect key={x} x={x} y="3.8" width="3.2" height="2.6" rx="0.8" fill={bay.fill} stroke={bay.stroke} strokeWidth="0.6" />
      ))}

      <rect x="4" y="8.4" width="24" height="7.6" rx="1" fill={water.fill} stroke={water.stroke} strokeWidth="0.7" />
      <rect x="6" y="9.3" width="10" height="2.6" rx="1.3" fill={log.fill} stroke={log.stroke} strokeWidth="0.8" />
      <rect x="17" y="12.5" width="8" height="2.6" rx="1.3" fill={log.fill} stroke={log.stroke} strokeWidth="0.8" />

      <rect x="4" y="17" width="24" height="7.6" rx="1" fill={road.fill} stroke={road.stroke} strokeWidth="0.7" />
      {[6, 12, 18, 24].map((x) => (
        <rect key={`d-${x}`} x={x} y="20.5" width="3" height="0.8" rx="0.4" fill="rgba(var(--ink-rgb), 0.18)" />
      ))}
      <rect x="6" y="17.8" width="6.8" height="2.8" rx="0.9" fill={carA.fill} stroke={carA.stroke} strokeWidth="0.8" />
      <rect x="18" y="21.1" width="6.8" height="2.8" rx="0.9" fill={carB.fill} stroke={carB.stroke} strokeWidth="0.8" />

      <ellipse cx="16" cy="27.6" rx="3.6" ry="2.4" fill={hopper} stroke="hsla(128, 55%, 28%, 0.95)" strokeWidth="1" />
      <circle cx="14.7" cy="27" r="0.6" fill="#1a2b3c" />
      <circle cx="17.3" cy="27" r="0.6" fill="#1a2b3c" />
    </>
  )
}

function SimonThumb() {
  const r = 5
  const gap = 2.4
  const cx = 16
  const cy = 16
  const d = r + gap / 2
  const pads = [
    { cx: cx - d, cy: cy - d, hue: HUE.sky, lit: false },
    { cx: cx + d, cy: cy - d, hue: HUE.violet, lit: true },
    { cx: cx - d, cy: cy + d, hue: HUE.gold, lit: false },
    { cx: cx + d, cy: cy + d, hue: HUE.rose, lit: false },
  ]

  return (
    <>
      {pads.map((pad) => (
        <circle
          key={`${pad.cx}-${pad.cy}`}
          cx={pad.cx}
          cy={pad.cy}
          r={pad.lit ? r * 1.04 : r}
          {...shape(pastel(pad.hue, 56, pad.lit ? 62 : 40), 1.5)}
        />
      ))}
    </>
  )
}

const thumbBySlug: Record<
  string,
  (props: { accent?: string }) => ReactNode
> = {
  asteroids: AsteroidsThumb,
  patriot: PatriotThumb,
  snake: () => <SnakeThumb />,
  pop: () => <PopThumb />,
  stacker: () => <StackerThumb />,
  'dead-center': DeadCenterThumb,
  simon: () => <SimonThumb />,
  crosswalk: CrosswalkThumb,
}

export function GameThumbArt({ slug, accent, className }: GameThumbArtProps) {
  const Thumb = thumbBySlug[slug]
  const style = accent
    ? ({ '--thumb-accent': accent } as CSSProperties)
    : undefined

  return (
    <span
      className={`inline-thumb${className ? ` ${className}` : ''}`}
      aria-hidden="true"
      style={style}
    >
      <ThumbSvg>{Thumb ? <Thumb accent={accent} /> : null}</ThumbSvg>
    </span>
  )
}
