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

/** A firefly lit, wings out, with two more glowing further off. */
function FirefliesThumb({ accent }: { accent: string }) {
  return (
    <>
      <circle cx="16" cy="20.2" r="8.2" {...mark(accent, 0.12, 0.9)} strokeOpacity="0.55" />
      <ellipse cx="11.6" cy="13.6" rx="4.6" ry="2.3" transform="rotate(-28 11.6 13.6)" {...mark(accent, 0.2, 1.2)} />
      <ellipse cx="20.4" cy="13.6" rx="4.6" ry="2.3" transform="rotate(28 20.4 13.6)" {...mark(accent, 0.2, 1.2)} />
      <g stroke={accent} strokeWidth="1.1" strokeLinecap="round" fill="none">
        <path d="M15.1 9.6 Q14 7.2 12.4 6.6" />
        <path d="M16.9 9.6 Q18 7.2 19.6 6.6" />
      </g>
      <ellipse cx="16" cy="14.6" rx="2.3" ry="3.4" {...mark(accent, 0.35, 1.3)} />
      <circle cx="16" cy="10.4" r="1.7" fill={accent} />
      <circle cx="16" cy="20.2" r="3.5" {...mark(accent, 0.85, 1.3)} />
      <circle cx="6.2" cy="8.6" r="1.25" fill={accent} />
      <circle cx="26" cy="25.4" r="1.05" fill={accent} />
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

/** The chomp, as it is drawn in play: an eye over the mouth, and the next crumb in front of it. */
function PelletsThumb({ accent }: { accent: string }) {
  return (
    <>
      <path d={pelletsPacPath(14.2, 16, 9.4)} {...mark(accent)} />
      <circle cx="15.5" cy="11.3" r="1.35" fill={accent} />
      <circle cx="27.4" cy="16" r="1.6" fill={accent} opacity="0.9" />
    </>
  )
}

/** Same chomp as Pellets, turned to face the climb, on a crumb trail. */
function CrumbtrailThumb({ accent }: { accent: string }) {
  return (
    <g>
      <circle cx="16" cy="5" r="2" fill={accent} opacity="0.9" />
      <g transform="translate(16 18) rotate(-90)">
        <path d={pelletsPacPath(0, 0, 8.6)} {...mark(accent)} />
        <circle cx="1.2" cy="-4.3" r="1.25" fill={accent} />
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
 * One of the fleet's crabs, claws up — the same drawing the game makes, so the
 * thumb is the thing you shoot at, not a generic invader. The whites of its
 * eyes are white in the game too.
 */
function BarrageThumb({ accent }: { accent: string }) {
  const limb = {
    fill: 'none',
    stroke: accent,
    strokeWidth: 1.3,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  return (
    <>
      {/* Antennae, claws and legs go under the hull, so its outline runs whole over their roots. */}
      <path d="M13.6 11.9 Q13.4 9.4 11.4 8.7 M18.4 11.9 Q18.6 9.4 20.6 8.7" {...limb} />
      <circle cx="11.4" cy="8.7" r="1.05" fill={accent} />
      <circle cx="20.6" cy="8.7" r="1.05" fill={accent} />
      <path
        d="M9.4 18.2 Q5 18.2 6.1 11.7 L8.1 9 M6.1 11.7 L4.6 9.2 M22.6 18.2 Q27 18.2 25.9 11.7 L23.9 9 M25.9 11.7 L27.4 9.2"
        {...limb}
      />
      <path d="M12.7 22.4 L10.7 26.1 M19.3 22.4 L21.3 26.1" {...limb} />
      <rect x="9" y="11.7" width="14" height="10.8" rx="3.4" {...mark(accent, 0.28, 1.3)} />
      <circle cx="12.7" cy="16.2" r="2.15" fill="#fff" stroke={accent} strokeWidth="1" />
      <circle cx="19.3" cy="16.2" r="2.15" fill="#fff" stroke={accent} strokeWidth="1" />
      <circle cx="12.95" cy="16.85" r="1.05" fill={accent} />
      <circle cx="19.55" cy="16.85" r="1.05" fill={accent} />
    </>
  )
}

/**
 * The Bug himself, face on: bobble hat, round glasses, a striped shell. The
 * one character the game is about, so he is the thumb.
 */
function FindBugThumb({ accent }: { accent: string }) {
  return (
    <>
      <g stroke={accent} strokeWidth="1.3" strokeLinecap="round">
        <path d="M12.6 8.8 Q11.6 6.2 9.6 5.6" fill="none" />
        <path d="M19.4 8.8 Q20.4 6.2 22.4 5.6" fill="none" />
        <path d="M10.4 21.4 Q7.8 22.4 7.6 24.8" fill="none" />
        <path d="M21.6 21.4 Q24.2 22.4 24.4 24.8" fill="none" />
      </g>
      <circle cx="9.4" cy="5.5" r="1.1" fill={accent} />
      <circle cx="22.6" cy="5.5" r="1.1" fill={accent} />
      <ellipse cx="16" cy="24" rx="6.4" ry="5.4" {...mark(accent, 0.28, 1.3)} />
      <g stroke={accent} strokeWidth="1.3" strokeLinecap="round">
        <line x1="10.4" y1="22.4" x2="21.6" y2="22.4" />
        <line x1="10.6" y1="25.9" x2="21.4" y2="25.9" />
      </g>
      <circle cx="16" cy="14.2" r="5.2" {...mark(accent, 0.18, 1.3)} />
      <path d="M10.6 11.4 A5.4 4.2 0 0 1 21.4 11.4 Z" {...mark(accent, 0.55, 1.3)} />
      <rect x="10.2" y="10.6" width="11.6" height="2" rx="1" fill={accent} />
      <circle cx="16" cy="6.4" r="1.6" fill={accent} />
      <g stroke={accent} strokeWidth="1.1" fill="none">
        <circle cx="13.9" cy="15.2" r="1.6" />
        <circle cx="18.1" cy="15.2" r="1.6" />
        <line x1="15.5" y1="15" x2="16.5" y2="15" />
      </g>
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
  fireflies: FirefliesThumb,
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
