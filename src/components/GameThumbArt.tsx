import type { CSSProperties, ReactNode } from 'react'
import { patriotCityRects } from '../games/patriot/cityArt'
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

function PatriotThumb() {
  const blocks = patriotCityRects(16, 27, 0.35, 0)

  return (
    <>
      {blocks.map((block, i) => {
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
  const baseCy = 21
  const cx = 16

  // Shifted up so the iso stack sits nearer the frame’s vertical center.
  return (
    <g transform="translate(0, -1.5)">
      <IsoSlab cx={cx} cy={baseCy} w={14} d={14} h={3.2} hue={HUE.teal} strokeWidth={0.75} />
      <g transform="translate(0, -3.4)">
        <IsoSlab cx={cx} cy={baseCy} w={11} d={11} h={3.2} hue={HUE.sky} strokeWidth={0.75} />
      </g>
      <g transform="translate(0, -6.8)">
        <IsoSlab cx={cx} cy={baseCy} w={8} d={8} h={3.2} hue={HUE.violet} strokeWidth={0.75} />
      </g>
    </g>
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
  const body = accent ? accentPastel(accent, 52) : pastel(HUE.green, 58, 52)

  return (
    <>
      <ellipse cx="16" cy="17.2" rx="8.2" ry="6.6" {...shape(body, 1.5)} />
      <circle cx="13.2" cy="15.6" r="1.15" fill="#1a2b3c" />
      <circle cx="18.8" cy="15.6" r="1.15" fill="#1a2b3c" />
      <circle cx="13.5" cy="15.3" r="0.35" fill="#fff" />
      <circle cx="19.1" cy="15.3" r="0.35" fill="#fff" />
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

function SpotterThumb({ accent }: { accent?: string }) {
  const a = accent ?? '#7a6cf0'
  const cells = [
    { x: 8, y: 8, bad: false },
    { x: 16, y: 8, bad: false },
    { x: 24, y: 8, bad: true },
    { x: 8, y: 16, bad: false },
    { x: 16, y: 16, bad: false },
    { x: 24, y: 16, bad: false },
    { x: 8, y: 24, bad: false },
    { x: 16, y: 24, bad: false },
    { x: 24, y: 24, bad: false },
  ]
  return (
    <>
      {cells.map((c, i) => (
        <rect
          key={i}
          x={c.x - 3}
          y={c.y - 3}
          width="6"
          height="6"
          rx="1.2"
          fill={c.bad ? `color-mix(in srgb, ${a} 42%, var(--playfield))` : `color-mix(in srgb, ${a} 18%, var(--playfield))`}
          stroke={a}
          strokeWidth={c.bad ? '1.6' : '1.2'}
          opacity={c.bad ? 1 : 0.85}
        />
      ))}
      <circle
        cx="22"
        cy="22"
        r="6.5"
        fill="none"
        stroke={a}
        strokeWidth="1.8"
      />
      <line x1="26.5" y1="26.5" x2="30" y2="30" stroke={a} strokeWidth="2" strokeLinecap="round" />
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
  spotter: SpotterThumb,
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
