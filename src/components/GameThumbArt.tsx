import type { CSSProperties, ReactNode } from 'react'
import { accentPastel, HUE, pastel } from './gameArtStyle'
import { IsoSlab } from './GameTileArt'

type GameThumbArtProps = {
  slug: string
  accent?: string
  className?: string
}

type ThumbProps = {
  accent?: string
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

function gameShape(accent: string | undefined, fallbackHue: number, mix = 48) {
  return shape(accent ? accentPastel(accent, mix) : pastel(fallbackHue, 56, mix), 1.5)
}

function AsteroidsThumb({ accent }: ThumbProps) {
  const a = accent ?? '#5a8fd4'
  const shipFill = `color-mix(in srgb, ${a} 28%, var(--playfield))`

  return (
    <g transform="translate(32 21)">
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
        stroke={`color-mix(in srgb, ${a} 55%, #f5b942)`}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  )
}

function PatriotThumb({ accent }: ThumbProps) {
  const ground = 34
  const x = 32
  const blocks = [
    { dx: -8, w: 5, h: 11 },
    { dx: -2, w: 5, h: 17 },
    { dx: 4, w: 5, h: 13 },
  ]
  const blockShape = gameShape(accent, HUE.rose, 44)

  return (
    <>
      {blocks.map((block) => (
        <rect
          key={block.dx}
          x={x + block.dx}
          y={ground - block.h}
          width={block.w}
          height={block.h}
          rx="1"
          {...blockShape}
          strokeWidth={1.4}
        />
      ))}
    </>
  )
}

function SnakeThumb({ accent }: ThumbProps) {
  const a = accent ?? '#3ecf8e'
  const cells = [
    { cx: 18, cy: 24, mix: 42 },
    { cx: 28, cy: 24, mix: 48 },
    { cx: 38, cy: 24, mix: 54 },
    { cx: 38, cy: 14, mix: 60 },
    { cx: 48, cy: 14, mix: 66 },
  ]

  return (
    <>
      {cells.map((cell, i) => (
        <circle
          key={i}
          cx={cell.cx}
          cy={cell.cy}
          r="4.2"
          {...shape(accentPastel(a, cell.mix), 1.4)}
        />
      ))}
      <circle cx="49.2" cy="12.6" r="0.9" fill="#fff" />
      <circle cx="49.2" cy="15.4" r="0.9" fill="#fff" />
      <circle cx="49.5" cy="12.6" r="0.45" fill="#1a2b3c" />
      <circle cx="49.5" cy="15.4" r="0.45" fill="#1a2b3c" />
    </>
  )
}

function PopThumb({ accent }: ThumbProps) {
  const a = accent ?? '#4aa8e8'
  const gap = 8
  const r = 3.4
  const originX = 32 - gap
  const originY = 12
  const slots = Array.from({ length: 9 }, (_, i) => i)

  return (
    <>
      {slots.map((i) => {
        const col = i % 3
        const row = Math.floor(i / 3)
        const cx = originX + col * gap
        const cy = originY + row * gap
        const on = i === 5
        const mix = on ? 72 : 24
        const p = accentPastel(a, mix)
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill={p.fill}
            stroke={p.stroke}
            strokeOpacity={on ? 1 : 0.65}
            strokeWidth={on ? 1.5 : 1.2}
          />
        )
      })}
    </>
  )
}

function StackerThumb({ accent }: ThumbProps) {
  const a = accent ?? '#4aa8e8'
  const baseCy = 28
  const cx = 32
  const layers = [
    { w: 24, d: 24, y: 0 },
    { w: 20, d: 20, y: -5 },
    { w: 16, d: 16, y: -10 },
    { w: 16, d: 16, y: -15, x: 6 },
  ]

  return (
    <>
      {layers.map((layer, i) => (
        <g key={i} transform={`translate(0, ${layer.y})`}>
          <IsoSlab
            cx={cx + (layer.x ?? 0)}
            cy={baseCy}
            w={layer.w}
            d={layer.d}
            h={5}
            hue={HUE.teal}
            accent={a}
          />
        </g>
      ))}
    </>
  )
}

function DeadCenterThumb({ accent }: ThumbProps) {
  const a = accent ?? '#4aa8e8'
  const tri = accentPastel(a, 46)

  return (
    <>
      <path d="M20 30 L32 10 L44 30 Z" {...shape(tri, 1.8)} />
      <circle cx="32" cy="22" r="2.2" fill={a} />
    </>
  )
}

function SimonThumb({ accent }: ThumbProps) {
  const a = accent ?? '#8a6ad4'
  const r = 5.5
  const gap = 3
  const cx = 32
  const cy = 20
  const d = r + gap / 2
  const pads = [
    { cx: cx - d, cy: cy - d, lit: false, mix: 34 },
    { cx: cx + d, cy: cy - d, lit: true, mix: 62 },
    { cx: cx - d, cy: cy + d, lit: false, mix: 40 },
    { cx: cx + d, cy: cy + d, lit: false, mix: 36 },
  ]

  return (
    <>
      {pads.map((pad) => (
        <circle
          key={`${pad.cx}-${pad.cy}`}
          cx={pad.cx}
          cy={pad.cy}
          r={pad.lit ? r * 1.04 : r}
          {...shape(accentPastel(a, pad.mix), 1.6)}
        />
      ))}
    </>
  )
}

const thumbBySlug: Record<string, (props: ThumbProps) => ReactNode> = {
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
        {Thumb ? <Thumb accent={accent} /> : null}
      </ThumbSvg>
    </div>
  )
}
