import type { CSSProperties, ReactNode } from 'react'
import { HUE, pastel } from './gameArtStyle'

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

function AsteroidsThumb() {
  const rock = pastel(HUE.sky, 54, 42)
  const shipFill = 'color-mix(in srgb, #2eb8a0 28%, var(--playfield))'
  const shipStroke = '#2eb8a0'

  return (
    <>
      <path
        d="M8 26 L14 18 L22 20 L24 28 L18 32 L10 30 Z"
        {...shape(rock, 1.4)}
      />
      <g transform="translate(32 21)">
        <path
          d="M0 -11 L-8 9 L0 4 L8 9 Z"
          fill={shipFill}
          stroke={shipStroke}
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
    </>
  )
}

function PatriotThumb() {
  const ground = 34
  const blocks = [
    { x: 8, w: 7, h: 12, hue: HUE.sky },
    { x: 17, w: 8, h: 18, hue: HUE.sky },
    { x: 27, w: 7, h: 10, hue: HUE.teal },
    { x: 38, w: 8, h: 16, hue: HUE.teal },
    { x: 48, w: 7, h: 11, hue: HUE.sky },
  ]

  return (
    <>
      {blocks.map((block) => (
        <rect
          key={block.x}
          x={block.x}
          y={ground - block.h}
          width={block.w}
          height={block.h}
          rx="1"
          {...shape(pastel(block.hue, 54, 42), 1.4)}
        />
      ))}
    </>
  )
}

function SnakeThumb() {
  const cells = [
    { cx: 18, cy: 24, hue: 208 },
    { cx: 28, cy: 24, hue: 198 },
    { cx: 38, cy: 24, hue: 188 },
    { cx: 38, cy: 14, hue: 178 },
    { cx: 48, cy: 14, hue: 168 },
  ]

  return (
    <>
      {cells.map((cell, i) => (
        <circle
          key={i}
          cx={cell.cx}
          cy={cell.cy}
          r="4.2"
          {...shape(pastel(cell.hue, 60, 50), 1.4)}
        />
      ))}
      <circle cx="49.2" cy="12.6" r="0.9" fill="#fff" />
      <circle cx="49.2" cy="15.4" r="0.9" fill="#fff" />
      <circle cx="49.5" cy="12.6" r="0.45" fill="#1a2b3c" />
      <circle cx="49.5" cy="15.4" r="0.45" fill="#1a2b3c" />
    </>
  )
}

function PopThumb() {
  const hues = [198, 172, 348, 272, 128, 38, 198, 172, 348]
  const live = new Set([5])
  const gap = 8
  const r = 3.4
  const originX = 32 - gap
  const originY = 12

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

/** Mini iso slab — same language as StackerArt. */
function StackerThumb() {
  const cx = 32
  const cy = 26
  const hw = 14
  const hd = 10
  const h = 9
  const sat = 56
  const fill = `color-mix(in srgb, hsla(${HUE.teal}, ${sat}%, 56%, 1) 52%, var(--playfield))`
  const side = `color-mix(in srgb, hsla(${HUE.teal}, ${sat}%, 50%, 1) 48%, var(--playfield))`
  const sideDark = `color-mix(in srgb, hsla(${HUE.teal}, ${sat}%, 42%, 1) 48%, var(--playfield))`
  const stroke = `hsla(${HUE.teal}, ${sat}%, 36%, 0.95)`

  const top = `${cx - hw},${cy - h} ${cx + hw},${cy - h} ${cx + hw},${cy} ${cx - hw},${cy}`

  return (
    <g>
      <polygon
        points={`${cx + hw},${cy - h} ${cx + hw},${cy} ${cx + hw},${cy + hd} ${cx + hw - hw * 0.15},${cy + hd}`}
        fill={side}
        stroke={stroke}
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <polygon
        points={`${cx - hw},${cy} ${cx + hw},${cy} ${cx + hw},${cy + hd} ${cx - hw},${cy + hd}`}
        fill={sideDark}
        stroke={stroke}
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <polygon
        points={top}
        fill={fill}
        stroke={stroke}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </g>
  )
}

function DeadCenterThumb() {
  const tri = pastel(HUE.sky, 56, 46)

  return (
    <>
      <path d="M20 30 L32 10 L44 30 Z" {...shape(tri, 1.8)} />
      <circle cx="32" cy="22" r="2.2" fill="#2eb8a0" />
    </>
  )
}

function SimonThumb() {
  const pads = [
    { cx: 24, cy: 16, hue: HUE.sky, lit: false },
    { cx: 40, cy: 16, hue: HUE.teal, lit: true },
    { cx: 24, cy: 26, hue: HUE.gold, lit: false },
    { cx: 40, cy: 26, hue: HUE.rose, lit: false },
  ]

  return (
    <>
      {pads.map((pad) => (
        <circle
          key={`${pad.cx}-${pad.cy}`}
          cx={pad.cx}
          cy={pad.cy}
          r={pad.lit ? 6.8 : 6.5}
          {...shape(pastel(pad.hue, 56, pad.lit ? 62 : 40), 1.6)}
        />
      ))}
    </>
  )
}

const thumbBySlug: Record<string, () => ReactNode> = {
  asteroids: AsteroidsThumb,
  patriot: PatriotThumb,
  snake: SnakeThumb,
  pop: PopThumb,
  stacker: StackerThumb,
  'dead-center': DeadCenterThumb,
  simon: SimonThumb,
}

export function GameThumbArt({ slug, accent, className }: GameThumbArtProps) {
  const Thumb = thumbBySlug[slug]
  const style = accent
    ? ({
        '--thumb-accent': accent,
        '--tile-accent': accent,
      } as CSSProperties)
    : undefined

  return (
    <div className={`game-thumb${className ? ` ${className}` : ''}`} style={style}>
      <ThumbSvg>
        <rect className="game-thumb__bg" width="64" height="40" />
        {Thumb ? <Thumb /> : null}
      </ThumbSvg>
    </div>
  )
}
