import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { patriotCityRects } from '../games/patriot/cityArt'
import { resolveGameAccent, THEME_EVENT } from '../lib/theme'

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

/*
 * The house style for a thumb: one silhouette in the game's own colour, drawn
 * as an outline with a faint fill of the same colour. Crumbtrail was always
 * drawn this way, and it was the one thumb that sat well on a deep tile of
 * its colour: the outline carries the shape, so the ground can be as deep or
 * as pale as the theme likes, and nothing in the mark fights the tile's hue.
 * A second hue is allowed only for a detail that is that colour in the game,
 * like the white of a ball.
 */
function mark(accent: string, fill = 0.28, width = 1.75) {
  return {
    fill: `color-mix(in srgb, ${accent} ${Math.round(fill * 100)}%, transparent)`,
    stroke: accent,
    strokeWidth: width,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  }
}

/**
 * Stand-in for a game with no bespoke thumb yet.
 *
 * Without it the tile renders an empty tinted box, which reads as a broken
 * image — and the home hero can land on a brand-new game before its art
 * exists.
 */
function FallbackThumb({ accent }: { accent: string }) {
  return (
    <>
      <rect x="7" y="7" width="18" height="18" rx="5" {...mark(accent, 0.2, 1.8)} />
      <circle cx="16" cy="16" r="3.4" fill={accent} />
    </>
  )
}

/** The ship, nose up, under thrust. */
function AsteroidsThumb({ accent }: { accent: string }) {
  return (
    <g transform="translate(16 16.2)">
      <path d="M0 -11 L-8 7.5 L0 3 L8 7.5 Z" {...mark(accent, 0.28, 2)} />
      <path d="M-3.4 6.8 L0 12 L3.4 6.8 Z" {...mark(accent, 0.7, 1.4)} />
    </g>
  )
}

/** The skyline the batteries defend. */
function PatriotThumb({ accent }: { accent: string }) {
  const blocks = patriotCityRects(16, 27, 0.35, 0, true)
  return (
    <>
      {blocks.map((block, i) => (
        <rect
          key={i}
          x={block.x}
          y={block.y}
          width={block.width}
          height={block.height}
          {...mark(accent, 0.28, 1.4)}
        />
      ))}
    </>
  )
}

/** Five beads, tail to head, the head solid with its eyes. */
function SnakeThumb({ accent }: { accent: string }) {
  const cells = [
    { cx: 8, cy: 20 },
    { cx: 14.5, cy: 20 },
    { cx: 21, cy: 20 },
    { cx: 21, cy: 13.5 },
  ]
  return (
    <>
      {cells.map((cell, i) => (
        <circle key={i} cx={cell.cx} cy={cell.cy} r="2.9" {...mark(accent, 0.28, 1.3)} />
      ))}
      <circle cx="27.5" cy="13.5" r="3.1" {...mark(accent, 0.85, 1.3)} />
      <circle cx="28.3" cy="12.4" r="0.7" fill="#fff" />
      <circle cx="28.3" cy="14.6" r="0.7" fill="#fff" />
    </>
  )
}

/** Nine holes, one bubble up. */
function PopThumb({ accent }: { accent: string }) {
  const gap = 7
  const origin = 16 - gap
  return (
    <>
      {Array.from({ length: 9 }, (_, i) => {
        const cx = origin + (i % 3) * gap
        const cy = origin + Math.floor(i / 3) * gap
        const up = i === 4
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={up ? 3.3 : 2.9}
            {...mark(accent, up ? 0.85 : 0.16, up ? 1.5 : 1.2)}
          />
        )
      })}
    </>
  )
}

/**
 * Three slabs up, each narrower than the last and a little off the one
 * below, the way a run really stacks; the top one is the piece landing.
 * Seen from the side rather than in the game's isometric view, because
 * three iso slabs are nine faces of outline and the mark turned to noise.
 */
function StackerThumb({ accent }: { accent: string }) {
  const slabs = [
    { x: 5, y: 21, w: 22 },
    { x: 7.5, y: 15, w: 16 },
    { x: 11.5, y: 9, w: 11 },
  ]
  return (
    <>
      {slabs.map((s, i) => (
        <rect
          key={i}
          x={s.x}
          y={s.y}
          width={s.w}
          height="5.2"
          rx="1.8"
          {...mark(accent, i === 2 ? 0.8 : 0.28, 1.5)}
        />
      ))}
    </>
  )
}

/** The shape, and the dot where its centre is. */
function DeadCenterThumb({ accent }: { accent: string }) {
  return (
    <>
      <path d="M16 5.5 L27.5 26.5 L4.5 26.5 Z" {...mark(accent, 0.3, 1.7)} />
      <circle cx="16" cy="18.2" r="1.9" fill={accent} />
    </>
  )
}

/** The face under its brim. */
function CrosswalkThumb({ accent }: { accent: string }) {
  return (
    <>
      <ellipse cx="16" cy="18" rx="7.2" ry="6.2" {...mark(accent, 0.3, 1.6)} />
      <circle cx="13.4" cy="16.6" r="1.1" fill={accent} />
      <circle cx="18.6" cy="16.6" r="1.1" fill={accent} />
      <path d="M8 10 L16 6 L24 10" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" />
    </>
  )
}

/** Four pads, one lit. */
function SimonThumb({ accent }: { accent: string }) {
  const r = 5
  const d = r + 1.2
  const pads = [
    { cx: 16 - d, cy: 16 - d, lit: false },
    { cx: 16 + d, cy: 16 - d, lit: true },
    { cx: 16 - d, cy: 16 + d, lit: false },
    { cx: 16 + d, cy: 16 + d, lit: false },
  ]
  return (
    <>
      {pads.map((pad) => (
        <circle
          key={`${pad.cx}-${pad.cy}`}
          cx={pad.cx}
          cy={pad.cy}
          r={pad.lit ? r * 1.06 : r}
          {...mark(accent, pad.lit ? 0.85 : 0.22, 1.5)}
        />
      ))}
    </>
  )
}

/** A grid of cells with the odd one out, under the glass. */
function SpotterThumb({ accent }: { accent: string }) {
  const cells = Array.from({ length: 9 }, (_, i) => ({
    x: 8 + (i % 3) * 8,
    y: 8 + Math.floor(i / 3) * 8,
    bad: i === 2,
  }))
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
          {...mark(accent, c.bad ? 0.6 : 0.16, c.bad ? 1.6 : 1.2)}
        />
      ))}
      <circle cx="22" cy="22" r="6.5" fill="none" stroke={accent} strokeWidth="1.8" />
      <line x1="26.5" y1="26.5" x2="30" y2="30" stroke={accent} strokeWidth="2" strokeLinecap="round" />
    </>
  )
}

/** Same pie path as canvas drawPlayer (clockwise major arc). */
function pelletsPacPath(cx: number, cy: number, r: number, open = 0.55) {
  const ux = cx + r * Math.cos(open)
  const uy = cy - r * Math.sin(open)
  const lx = cx + r * Math.cos(open)
  const ly = cy + r * Math.sin(open)
  // Lower lip → clockwise large arc → upper lip → close (matches ctx.arc).
  return `M ${cx} ${cy} L ${lx} ${ly} A ${r} ${r} 0 1 1 ${ux} ${uy} Z`
}

/** The chomp, as it is drawn in play. */
function PelletsThumb({ accent }: { accent: string }) {
  return <path d={pelletsPacPath(15.4, 16, 9.4)} {...mark(accent)} />
}

/** Same chomp as Pellets, turned to face the climb, on a crumb trail. */
function CrumbtrailThumb({ accent }: { accent: string }) {
  return (
    <g>
      <circle cx="16" cy="5" r="2" fill={accent} opacity="0.9" />
      <g transform="translate(16 18) rotate(-90)">
        <path d={pelletsPacPath(0, 0, 8.6)} {...mark(accent)} />
      </g>
    </g>
  )
}

/** The big button, with the knob and lever flanking it. */
function BopThumb({ accent }: { accent: string }) {
  return (
    <g>
      <circle cx="16" cy="17" r="8" {...mark(accent, 0.28, 1.5)} />
      <circle cx="16" cy="17" r="4" {...mark(accent, 0.55, 1.2)} />
      <circle cx="5.5" cy="9" r="3.4" {...mark(accent, 0.2, 1.3)} />
      <line x1="5.5" y1="9" x2="5.5" y2="6.4" stroke={accent} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="26.5" y1="6" x2="26.5" y2="15" stroke={accent} strokeWidth="2" strokeLinecap="round" />
      <circle cx="26.5" cy="7.5" r="2.6" {...mark(accent, 0.6, 1.3)} />
    </g>
  )
}

/** A green with the cup, its flag, and the ball on its way. */
function PuttThumb({ accent }: { accent: string }) {
  return (
    <g>
      <rect x="4" y="4" width="24" height="24" rx="5" {...mark(accent, 0.16, 1.5)} />
      <circle cx="20" cy="11" r="2.6" fill={accent} opacity="0.9" />
      <line x1="20.6" y1="10.5" x2="20.6" y2="4.5" stroke={accent} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M20.6 4.5 L25.5 6 L20.6 7.5z" {...mark(accent, 0.8, 0.9)} />
      <path
        d="M12 21 L17.5 14.5"
        stroke={accent}
        strokeWidth="1"
        strokeDasharray="1.5 1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      <circle cx="10" cy="23" r="2.2" fill="#fff" stroke={accent} strokeWidth="1" opacity="0.95" />
    </g>
  )
}

/**
 * The fleet's own silhouette at full health — crest, hull, side pods, feet —
 * so the thumb is the thing you shoot at, not a generic invader.
 */
function BarrageThumb({ accent }: { accent: string }) {
  const hull = mark(accent, 0.28, 1.3)
  return (
    <>
      {/* Feet, pods and crest sit under the hull so its outline stays whole. */}
      <rect x="6.6" y="22.2" width="4.7" height="5.8" rx="2.2" {...hull} />
      <rect x="20.7" y="22.2" width="4.7" height="5.8" rx="2.2" {...hull} />
      <rect x="3" y="13.1" width="3.6" height="8.2" rx="2.4" {...hull} />
      <rect x="25.4" y="13.1" width="3.6" height="8.2" rx="2.4" {...hull} />
      <rect x="9.8" y="5" width="12.5" height="7.2" rx="3.1" {...hull} />
      <rect x="5.1" y="11.2" width="21.8" height="11.5" rx="5.3" {...hull} />
      <circle cx="11.8" cy="16.5" r="1.7" fill={accent} />
      <circle cx="20.2" cy="16.5" r="1.7" fill={accent} />
    </>
  )
}

/** The beetle from the game, turned to face up so its long axis fills a square. */
function FindBugThumb({ accent }: { accent: string }) {
  const cy = 17.4
  const legs = [13.6, 17.4, 21.2]
  return (
    <>
      {/* Legs first, so they read as underneath the shell. */}
      <g stroke={accent} strokeWidth="1.35" strokeLinecap="round">
        {legs.map((y) => (
          <g key={y}>
            <line x1="13.7" y1={y} x2="7.3" y2={y} />
            <line x1="18.3" y1={y} x2="24.7" y2={y} />
          </g>
        ))}
        <line x1="14.4" y1="10.9" x2="11.9" y2="5.3" />
        <line x1="17.6" y1="10.9" x2="20.1" y2="5.3" />
      </g>
      <ellipse cx="16" cy={cy} rx="5.8" ry="9" {...mark(accent, 0.28, 1)} />
      <line x1="16" y1="24.8" x2="16" y2="12.9" stroke={accent} strokeWidth="1" />
      <ellipse cx="16" cy="10.4" rx="3.8" ry="3.1" fill={accent} />
    </>
  )
}

/** A fish mid-chase, mouth open, one bite behind a smaller one — the whole rule in one shape. */
function FrenzyThumb({ accent }: { accent: string }) {
  return (
    <g>
      <g transform="translate(27.8 6.6) rotate(-18)">
        <path d="M-2.3 0 L-4.9 -2.1 L-4.9 2.1 Z" {...mark(accent, 0.14, 1.1)} />
        <ellipse cx="0" cy="0" rx="3" ry="2" {...mark(accent, 0.14, 1.1)} />
      </g>
      {/* Tail and fin first, so the body's outline runs whole over their roots. */}
      <g transform="translate(16 18.6) rotate(-18)">
        <path d="M-7.2 0 L-12.6 -5 Q-10.8 0 -12.6 5 Z" {...mark(accent, 0.22, 1.4)} />
        <path d="M-3.8 -5.2 L-0.8 -9.6 L2.8 -6.5 Z" {...mark(accent, 0.22, 1.4)} />
        <path
          d="M8.6 -1.4 C7.4 -6.2 -0.6 -7.4 -5 -4.6 C-7 -3.3 -8.4 -1.4 -8.4 0 C-8.4 1.4 -7 3.3 -5 4.6 C-0.6 7.4 7.4 6.2 8.6 1.4 L5.8 0 Z"
          {...mark(accent, 0.3, 1.6)}
        />
        <circle cx="3.6" cy="-2.6" r="1.3" fill="#fff" />
      </g>
    </g>
  )
}

const thumbBySlug: Record<string, (props: { accent: string }) => ReactNode> = {
  putt: PuttThumb,
  bop: BopThumb,
  asteroids: AsteroidsThumb,
  patriot: PatriotThumb,
  snake: SnakeThumb,
  pop: PopThumb,
  stacker: StackerThumb,
  centroid: DeadCenterThumb,
  simon: SimonThumb,
  crosswalk: CrosswalkThumb,
  spotter: SpotterThumb,
  pellets: PelletsThumb,
  crumbtrail: CrumbtrailThumb,
  barrage: BarrageThumb,
  findbug: FindBugThumb,
  frenzy: FrenzyThumb,
}

export function GameThumbArt({ slug, accent, className }: GameThumbArtProps) {
  const [, setArtTick] = useState(0)
  useEffect(() => {
    const sync = () => setArtTick((n) => n + 1)
    window.addEventListener(THEME_EVENT, sync)
    return () => window.removeEventListener(THEME_EVENT, sync)
  }, [])

  const resolved = resolveGameAccent(slug, accent ?? '#4285F4')
  const Thumb = thumbBySlug[slug]
  const style = { '--thumb-accent': resolved } as CSSProperties

  return (
    <span
      className={`inline-thumb${className ? ` ${className}` : ''}`}
      aria-hidden="true"
      style={style}
    >
      <ThumbSvg>
        {Thumb ? <Thumb accent={resolved} /> : <FallbackThumb accent={resolved} />}
      </ThumbSvg>
    </span>
  )
}
