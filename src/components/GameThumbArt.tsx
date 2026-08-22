import type { CSSProperties, ReactNode } from 'react'

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

function icon(fill: string, stroke: string) {
  return { fill, stroke, strokeWidth: 1.6, strokeLinejoin: 'round' as const }
}

function AsteroidsThumb() {
  const ship = icon('rgba(255,255,255,0.92)', 'rgba(255,255,255,0.55)')
  return (
    <g transform="translate(32 21)">
      <path d="M0 -11 L-8 9 L0 4 L8 9 Z" {...ship} />
      <path
        d="M-3.5 7.5 L0 13 L3.5 7.5"
        fill="none"
        stroke="rgba(255,220,120,0.85)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  )
}

function PatriotThumb() {
  const b = icon('rgba(255,255,255,0.88)', 'rgba(255,255,255,0.45)')
  const ground = 34
  const blocks = [
    { x: 8, w: 7, h: 12 },
    { x: 17, w: 8, h: 18 },
    { x: 27, w: 7, h: 10 },
    { x: 38, w: 8, h: 16 },
    { x: 48, w: 7, h: 11 },
  ]
  return (
    <>
      <line
        x1="6"
        y1={ground}
        x2="58"
        y2={ground}
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {blocks.map((block) => (
        <rect
          key={block.x}
          x={block.x}
          y={ground - block.h}
          width={block.w}
          height={block.h}
          rx="1"
          {...b}
        />
      ))}
    </>
  )
}

function SnakeThumb() {
  const bead = icon('rgba(255,255,255,0.9)', 'rgba(255,255,255,0.4)')
  const pts = [
    [18, 24],
    [28, 24],
    [38, 24],
    [38, 14],
    [48, 14],
  ]
  return (
    <>
      {pts.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="4.2" {...bead} />
      ))}
      <circle cx="48.8" cy="12.8" r="0.9" fill="rgba(20,30,40,0.65)" />
      <circle cx="48.8" cy="15.2" r="0.9" fill="rgba(20,30,40,0.65)" />
    </>
  )
}

function PopThumb() {
  const outer = icon('rgba(255,255,255,0.18)', 'rgba(255,255,255,0.88)')
  return (
    <>
      <circle cx="32" cy="20" r="13" {...outer} />
      <circle
        cx="32"
        cy="20"
        r="5.5"
        fill="none"
        stroke="rgba(255,255,255,0.72)"
        strokeWidth="1.5"
      />
    </>
  )
}

function StackerThumb() {
  const top = icon('rgba(255,255,255,0.92)', 'rgba(255,255,255,0.5)')
  const side = icon('rgba(255,255,255,0.72)', 'rgba(255,255,255,0.38)')
  return (
    <g transform="translate(32 22)">
      <polygon points="0,-10 14,-3 0,4 -14,-3" {...top} />
      <polygon points="14,-3 14,7 0,14 -14,7 -14,-3 0,4" {...side} />
    </g>
  )
}

function DeadCenterThumb() {
  const tri = icon('rgba(255,255,255,0.2)', 'rgba(255,255,255,0.9)')
  return (
    <>
      <path d="M20 30 L32 10 L44 30 Z" {...tri} />
      <circle cx="32" cy="22" r="2.2" fill="rgba(255,255,255,0.95)" />
    </>
  )
}

function SimonThumb() {
  const pads = [
    [24, 16],
    [40, 16],
    [24, 26],
    [40, 26],
  ]
  return (
    <>
      {pads.map(([cx, cy], i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r="6.5"
          fill={i === 1 ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.55)'}
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="1.4"
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
    ? ({ '--thumb-accent': accent } as CSSProperties)
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
