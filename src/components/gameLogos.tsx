import type { ReactNode } from 'react'
import { patriotCityRects } from '../games/patriot/cityArt'

/*
 * The game logos, redrawn: the same house style as GameThumbArt's (one
 * silhouette in the game's colour, an outline with a faint fill of it, a
 * second hue only for what's that colour in the game, like the white of a
 * ball), but each a small scene of its game rather than one object, so it
 * says what the game is: the ship and the rock it's shooting, the city
 * under the missile, the snake about to eat. On trial behind `?look=new`
 * (lib/look.ts) until they're picked. Games not here keep the thumb they have.
 */

function mark(accent: string, fill = 0.28, width = 1.6) {
  return {
    fill: `color-mix(in srgb, ${accent} ${Math.round(fill * 100)}%, transparent)`,
    stroke: accent,
    strokeWidth: width,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  }
}

function line(accent: string, width = 1.3, opacity = 1) {
  return {
    fill: 'none',
    stroke: accent,
    strokeWidth: width,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    opacity,
  }
}

/** The ship, low left, firing at a rock drifting in from the top right. */
function Asteroids({ accent }: { accent: string }) {
  return (
    <>
      <path d="M21.4 3.2 L26.6 5.2 L28.9 10.1 L27.1 15.3 L22.3 17.7 L17.3 16.3 L14.7 11.9 L16.4 6.3 Z" {...mark(accent, 0.22)} />
      <circle cx="23.4" cy="9" r="1.5" {...line(accent, 1.1)} />
      <circle cx="19.6" cy="13" r="0.9" {...line(accent, 1)} />
      <g transform="translate(8.2 24.4) rotate(40)">
        <path d="M-2 4.2 L0 7.9 L2 4.2 Z" {...mark(accent, 0.7, 1.1)} />
        <path d="M0 -7 L-4.8 4.8 L0 2.2 L4.8 4.8 Z" {...mark(accent, 0.3)} />
      </g>
      <circle cx="14.6" cy="17" r="1" fill={accent} />
    </>
  )
}

/** Missiles raining on the city, and the burst of one caught on the way down. */
function Patriot({ accent }: { accent: string }) {
  const blocks = patriotCityRects(16, 28.6, 0.21, 0, true)
  return (
    <>
      <path d="M2 28.6 H30" {...line(accent, 1.1, 0.5)} />
      <path d="M2.6 1.8 L10.4 12.6" {...line(accent, 1.1, 0.7)} />
      <circle cx="10.4" cy="12.6" r="1.25" fill={accent} />
      <path d="M30 1.4 L25.4 6.6" {...line(accent, 1.1, 0.7)} />
      <path d="M16.4 16.2 L20.8 11.8" {...line(accent, 1.1, 0.8)} strokeDasharray="1.3 1.5" />
      <circle cx="23.4" cy="8.8" r="4.4" {...mark(accent, 0.28, 1.5)} />
      <circle cx="23.4" cy="8.8" r="1.9" fill={accent} opacity="0.9" />
      {blocks.map((block, i) => (
        <rect key={i} x={block.x} y={block.y} width={block.width} height={block.height} {...mark(accent, 0.28, 1.3)} />
      ))}
    </>
  )
}

/** The snake up the side and round the bottom of the board, its head rising for the fruit. */
function Snake({ accent }: { accent: string }) {
  return (
    <>
      <path
        d="M5.9 12 V21.5 A6.1 6.1 0 0 0 12 27.6 H20 A6.1 6.1 0 0 0 26.1 21.5 V15 L20.9 15 V21.5 A0.9 0.9 0 0 1 20 22.4 H12 A0.9 0.9 0 0 1 11.1 21.5 V12 Q11.1 8.8 8.5 6.6 Q5.9 8.8 5.9 12 Z"
        {...mark(accent, 0.28, 1.4)}
      />
      {[
        [8.5, 13.4],
        [8.5, 18.4],
        [13.4, 25],
        [18.6, 25],
      ].map(([x, y]) => (
        <path key={`${x}-${y}`} d={`M${x} ${y - 1} L${x + 1} ${y} L${x} ${y + 1} L${x - 1} ${y} Z`} fill={accent} opacity="0.75" />
      ))}
      <ellipse cx="23.5" cy="13.6" rx="3.5" ry="3.8" {...mark(accent, 0.85, 1.4)} />
      <circle cx="21.9" cy="12.6" r="1.2" fill="#fff" />
      <circle cx="25.1" cy="12.6" r="1.2" fill="#fff" />
      <circle cx="21.9" cy="12.1" r="0.55" fill="#10202a" />
      <circle cx="25.1" cy="12.1" r="0.55" fill="#10202a" />
      <circle cx="23.5" cy="5.2" r="2.4" {...mark(accent, 0.55, 1.3)} />
      <path d="M23.5 2.8 V1.8" {...line(accent, 1)} />
      <path d="M23.7 2.2 Q25.3 0.8 26.4 1.8 Q25.1 3 23.7 2.2 Z" {...mark(accent, 0.6, 0.8)} />
    </>
  )
}

/** The hopper at the side of the road, and a bus coming along it. */
function Crosswalk({ accent }: { accent: string }) {
  return (
    <>
      <path d="M1.6 4.4 H30.4 M1.6 18.6 H30.4" {...line(accent, 1.3, 0.55)} />
      <path d="M21.4 11.5 H30.4" {...line(accent, 1.2, 0.45)} strokeDasharray="2.4 2" />
      <path d="M5.2 6.4 H8.8 M13.6 6.4 H17.2 M5.2 16.6 H8.8 M13.6 16.6 H17.2" {...line(accent, 2)} />
      <rect x="2.4" y="7" width="17.6" height="9" rx="2.4" {...mark(accent, 0.28, 1.5)} />
      <rect x="4.6" y="9.2" width="8.6" height="3.4" rx="1" fill={accent} opacity="0.6" />
      <rect x="14.8" y="9.2" width="3" height="3.4" rx="1" fill={accent} opacity="0.6" />
      <circle cx="22.4" cy="25" r="5.2" {...mark(accent, 0.3, 1.6)} />
      <circle cx="20.3" cy="23.8" r="1.55" fill="#fff" />
      <circle cx="24.5" cy="23.8" r="1.55" fill="#fff" />
      <circle cx="20.3" cy="23.1" r="0.75" fill="#10202a" />
      <circle cx="24.5" cy="23.1" r="0.75" fill="#10202a" />
    </>
  )
}

/** Three slabs landed, and the next sliding in over them. */
function Stacker({ accent }: { accent: string }) {
  const slabs = [
    { x: 4, y: 23.2, w: 24 },
    { x: 6.8, y: 17.6, w: 19 },
    { x: 9.6, y: 12, w: 14.6 },
  ]
  return (
    <>
      {slabs.map((s) => (
        <rect key={s.y} x={s.x} y={s.y} width={s.w} height="4.6" rx="1.6" {...mark(accent, 0.28, 1.4)} />
      ))}
      <rect x="13.8" y="5" width="13.6" height="4.6" rx="1.6" {...mark(accent, 0.85, 1.4)} />
      <path d="M4.6 6.4 H10 M6.6 8.4 H10" {...line(accent, 1.1, 0.7)} />
    </>
  )
}

/** An odd-shaped plate, as the game tilts it toward you, balanced on a pin under the mark at its true centre. */
function Centroid({ accent }: { accent: string }) {
  return (
    <>
      <path d="M15.5 23.3 V27.9" {...line(accent, 1.4)} />
      <ellipse cx="15.5" cy="28.3" rx="3.2" ry="1.1" {...mark(accent, 0.28, 1.1)} />
      <path d="M3 18.2 L22.3 22.5 L29 18.2 V20.4 L22.3 24.7 L3 20.4 Z" {...mark(accent, 0.5, 1.3)} />
      <path d="M3 18.2 L7.8 8.8 L15.9 7 L29 18.2 L22.3 22.5 Z" {...mark(accent, 0.24, 1.5)} />
      <ellipse cx="15.5" cy="15.2" rx="3.4" ry="2.4" {...line(accent, 1.2)} />
      <path d="M15.5 10.4 V12 M15.5 18.4 V20" {...line(accent, 1.2)} />
      <circle cx="15.5" cy="15.2" r="1.1" fill={accent} />
    </>
  )
}

/** Bubbles with a shine, the big one's centre marked, and one going pop. */
function Pop({ accent }: { accent: string }) {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4
    const x1 = 24.2 + Math.cos(a) * 2.6
    const y1 = 23.8 + Math.sin(a) * 2.6
    const x2 = 24.2 + Math.cos(a) * 4.6
    const y2 = 23.8 + Math.sin(a) * 4.6
    return `M${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)}`
  }).join(' ')
  return (
    <>
      <circle cx="12.4" cy="15.6" r="7.6" {...mark(accent, 0.18, 1.5)} />
      <path d="M7.6 13.4 A5.4 5.4 0 0 1 11 10" {...line('#fff', 1.2, 0.8)} />
      <circle cx="12.4" cy="15.6" r="1.4" fill={accent} />
      <circle cx="24.4" cy="8.2" r="4.3" {...mark(accent, 0.18, 1.4)} />
      <path d="M21.8 7.2 A2.9 2.9 0 0 1 23.5 5.4" {...line('#fff', 1, 0.8)} />
      <path d={rays} {...line(accent, 1.3)} />
      <circle cx="24.2" cy="23.8" r="1.2" fill={accent} />
    </>
  )
}

/** Same pie as the game's chomp: lower lip, the long way round, upper lip. */
function pacPath(cx: number, cy: number, r: number, open = 0.55) {
  const ux = cx + r * Math.cos(open)
  const uy = cy - r * Math.sin(open)
  const lx = cx + r * Math.cos(open)
  const ly = cy + r * Math.sin(open)
  return `M ${cx} ${cy} L ${lx.toFixed(2)} ${ly.toFixed(2)} A ${r} ${r} 0 1 1 ${ux.toFixed(2)} ${uy.toFixed(2)} Z`
}

/** Down a corridor of the maze: the chomp, a pellet, and a power pellet past it. */
function Pellets({ accent }: { accent: string }) {
  return (
    <>
      <rect x="2.6" y="4.4" width="26.8" height="3.2" rx="1.6" {...mark(accent, 0.2, 1.3)} />
      <rect x="2.6" y="24.4" width="26.8" height="3.2" rx="1.6" {...mark(accent, 0.2, 1.3)} />
      <path d={pacPath(10.8, 16, 6.4)} {...mark(accent, 0.28, 1.6)} />
      <circle cx="11.7" cy="12.6" r="1.05" fill={accent} />
      <circle cx="20.2" cy="16" r="1.2" fill={accent} />
      <circle cx="26" cy="16" r="2.2" {...mark(accent, 0.85, 1.2)} />
    </>
  )
}

/** The Bug in his bobble hat and round glasses, found under the glass. */
function FindBug({ accent }: { accent: string }) {
  return (
    <>
      <path d="M20.2 20.2 L27.6 27.6" {...line(accent, 3.2)} />
      <circle cx="13.6" cy="13.6" r="9.6" {...mark(accent, 0.12, 1.8)} />
      <circle cx="13.6" cy="15.6" r="4.7" {...mark(accent, 0.28, 1.2)} />
      <path d="M8.8 13.5 A4.9 3.8 0 0 1 18.4 13.5 Z" {...mark(accent, 0.6, 1.2)} />
      <circle cx="13.6" cy="8.7" r="1.4" fill={accent} />
      <g {...line(accent, 1)}>
        <circle cx="11.9" cy="16.4" r="1.45" />
        <circle cx="15.3" cy="16.4" r="1.45" />
        <path d="M13.35 16.2 H13.85" />
      </g>
    </>
  )
}

/** A tiny ship, threading up under two curtains of bullets, one grazed into a star. */
function Barrage({ accent }: { accent: string }) {
  const front = [
    [4.6, 11.4],
    [9.3, 8.6],
    [14, 7.4],
    [18.4, 7.4],
    [23, 8.6],
    [27.6, 11.4],
  ]
  const back = [
    [7.4, 17.6],
    [11.7, 15.4],
    [16.2, 14.7],
    [20.6, 15.4],
    [24.9, 17.6],
  ]
  return (
    <>
      {front.map(([cx, cy]) => (
        <circle key={`${cx}`} cx={cx} cy={cy} r="1.5" {...mark(accent, 0.85, 1.1)} />
      ))}
      {back.map(([cx, cy]) => (
        <circle key={`${cx}`} cx={cx} cy={cy} r="1.3" {...mark(accent, 0.28, 1.1)} />
      ))}
      <path d="M22.6 20.4 L23.2 22 L24.8 22.6 L23.2 23.2 L22.6 24.8 L22 23.2 L20.4 22.6 L22 22 Z" {...mark(accent, 0.6, 0.9)} />
      <path d="M16 21.2 L12.4 28.8 L16 26.8 L19.6 28.8 Z" {...mark(accent, 0.3, 1.4)} />
    </>
  )
}

/** The chomp in a shaft of the maze, facing the climb, its crumbs going on up and out of sight. */
function Crumbtrail({ accent }: { accent: string }) {
  const walls = [
    { x: 5.2, y: 2.4, h: 27.2 },
    { x: 23.6, y: 2.4, h: 27.2 },
  ]
  const crumbs = [
    [14.6, 1],
    [9.8, 0.75],
    [5, 0.5],
    [0.8, 0.25],
  ]
  return (
    <>
      {walls.map((w) => (
        <rect key={`${w.x}-${w.y}`} x={w.x} y={w.y} width="3.2" height={w.h} rx="1.6" {...mark(accent, 0.2, 1.3)} />
      ))}
      {crumbs.map(([cy, o]) => (
        <circle key={cy} cx="16" cy={cy} r="1.25" fill={accent} opacity={o} />
      ))}
      <g transform="translate(16 23.2) rotate(-90)">
        <path d={pacPath(0, 0, 5.4)} {...mark(accent, 0.28, 1.6)} />
        <circle cx="0.8" cy="-2.8" r="0.95" fill={accent} />
      </g>
    </>
  )
}

/** A green in its own shape, the cup with its flag, and the ball lined up on it. */
function Putt({ accent }: { accent: string }) {
  return (
    <>
      <path
        d="M5.4 13.4 C4.6 7.4 11.6 4.2 18.4 5 C25.6 5.8 29.4 11 28 17.2 C26.6 24.2 20.2 28.4 12.8 27.6 C6.6 26.9 6.2 19.4 5.4 13.4 Z"
        {...mark(accent, 0.18, 1.5)}
      />
      <ellipse cx="20.6" cy="11.8" rx="2.3" ry="1.5" fill={accent} />
      <path d="M21.3 11.4 V3.6" {...line(accent, 1.2)} />
      <path d="M21.3 3.6 L26.4 5.2 L21.3 6.8 Z" {...mark(accent, 0.8, 0.9)} />
      <path d="M12.6 19.8 L18.3 13.8" {...line(accent, 1, 0.7)} strokeDasharray="1.5 1.5" />
      <circle cx="11" cy="21.6" r="2.2" fill="#fff" stroke={accent} strokeWidth="1" />
    </>
  )
}

const LOGOS: Record<string, (props: { accent: string }) => ReactNode> = {
  asteroids: Asteroids,
  patriot: Patriot,
  snake: Snake,
  crosswalk: Crosswalk,
  stacker: Stacker,
  centroid: Centroid,
  pop: Pop,
  pellets: Pellets,
  findbug: FindBug,
  barrage: Barrage,
  crumbtrail: Crumbtrail,
  putt: Putt,
}

/** A game's redrawn logo, or `fallback` for a game that keeps the thumb it has. */
export function NextLogo({ slug, accent, fallback }: { slug: string; accent: string; fallback: ReactNode }) {
  const Logo = LOGOS[slug]
  return Logo ? <Logo accent={accent} /> : fallback
}
