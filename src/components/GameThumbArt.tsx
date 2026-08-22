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
      viewBox="0 0 64 40"
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
  const a = accent ?? '#5a8fd4'
  const shipFill = `color-mix(in srgb, ${a} 28%, var(--playfield))`

  return (
    <g transform="translate(32 20)">
      <path
        d="M0 -11 L-8 9 L0 4 L8 9 Z"
        fill={shipFill}
        stroke={a}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M-3.5 7.5 L0 13 L3.5 7.5"
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
  const ground = 29
  const x = 32
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
    { cx: 18, cy: 22, hue: 208 },
    { cx: 28, cy: 22, hue: 198 },
    { cx: 38, cy: 22, hue: 188 },
    { cx: 38, cy: 12, hue: 178 },
    { cx: 48, cy: 12, hue: 168 },
  ]

  return (
    <g transform="translate(0 3)">
      {cells.map((cell, i) => (
        <circle
          key={i}
          cx={cell.cx}
          cy={cell.cy}
          r="4.2"
          {...shape(pastel(cell.hue, 60, 50), 1.4)}
        />
      ))}
      <circle cx="49.2" cy="10.6" r="0.9" fill="#fff" />
      <circle cx="49.2" cy="13.4" r="0.9" fill="#fff" />
      <circle cx="49.5" cy="10.6" r="0.45" fill="#1a2b3c" />
      <circle cx="49.5" cy="13.4" r="0.45" fill="#1a2b3c" />
    </g>
  )
}

function PopThumb() {
  const hues = [198, 172, 348, 272, 128, 38, 198, 172, 348]
  const live = new Set([5])
  const gap = 8
  const r = 3.4
  const originX = 32 - gap
  const originY = 10

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
            strokeWidth={on ? 1.5 : 1.2}
          />
        )
      })}
    </>
  )
}

function StackerThumb() {
  const baseCy = 24
  const cx = 32

  return (
    <>
      <IsoSlab cx={cx} cy={baseCy} w={24} d={24} h={5} hue={HUE.teal} />
      <g transform="translate(0, -5)">
        <IsoSlab cx={cx} cy={baseCy} w={20} d={20} h={5} hue={HUE.sky} />
      </g>
      <g transform="translate(0, -10)">
        <IsoSlab cx={cx} cy={baseCy} w={16} d={16} h={5} hue={HUE.violet} />
      </g>
      <g transform="translate(0, -15)">
        <IsoSlab cx={cx} cy={baseCy} x={6} w={16} d={16} h={5} hue={HUE.gold} />
      </g>
    </>
  )
}

function DeadCenterThumb({ accent }: { accent?: string }) {
  const tri = accent ? accentPastel(accent, 46) : pastel(HUE.sky, 56, 46)
  const dot = accent ?? '#2eb8a0'

  return (
    <g transform="translate(0 1)">
      <path d="M20 28 L32 8 L44 28 Z" {...shape(tri, 1.8)} />
      <circle cx="32" cy="20" r="2.2" fill={dot} />
    </g>
  )
}

function SimonThumb() {
  const r = 5.5
  const gap = 3
  const cx = 32
  const cy = 20
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
          {...shape(pastel(pad.hue, 56, pad.lit ? 62 : 40), 1.6)}
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
}

export function GameThumbArt({ slug, accent, className }: GameThumbArtProps) {
  const Thumb = thumbBySlug[slug]
  const style = accent
    ? ({ '--thumb-accent': accent } as CSSProperties)
    : undefined

  return (
    <div className={`game-thumb${className ? ` ${className}` : ''}`} style={style}>
      <ThumbSvg>{Thumb ? <Thumb accent={accent} /> : null}</ThumbSvg>
    </div>
  )
}
