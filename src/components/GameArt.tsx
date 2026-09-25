import { useId, type ReactNode } from 'react'

/*
 * Each game's picture, drawn to look like the game as it plays now: its own
 * colours, its own characters, in its own look (a bright outline over a soft
 * wash of the same colour, as the games draw nearly everything; ink and flat
 * colour for Find the Bug, which is a cartoon). A scene is 40 by 30, a
 * cabinet's screen; the icon everywhere else is its middle square, so what
 * matters in a scene sits between x 5 and 35.
 */

type Id = (name: string) => string
type Scene = (props: { id: Id }) => ReactNode

const INK = '#1a2b3c'

const hsl = (h: number, s: number, l: number, a = 1) => `hsl(${h} ${s}% ${l}% / ${a})`

/** The games' own look: a saturated outline over a soft wash of its colour. */
function wash(h: number, s: number, l: number, alpha = 0.32, width = 0.6) {
  return {
    fill: hsl(h, s, l, alpha),
    stroke: hsl(h, s, l),
    strokeWidth: width,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  }
}

function line(colour: string, width = 0.5, opacity = 1) {
  return {
    fill: 'none',
    stroke: colour,
    strokeWidth: width,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    opacity,
  }
}

function inked(fill: string, width = 0.42) {
  return { fill, stroke: INK, strokeWidth: width, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
}

function Backdrop({ id, stops }: { id: Id; stops: Array<[number, string]> }) {
  return (
    <>
      <defs>
        <linearGradient id={id('bg')} x1="0" y1="0" x2="0" y2="1">
          {stops.map(([at, colour]) => (
            <stop key={at} offset={at} stopColor={colour} />
          ))}
        </linearGradient>
      </defs>
      <rect x="-1" y="-1" width="42" height="32" fill={`url(#${id('bg')})`} />
    </>
  )
}

function Glow({ id, name, cx, cy, r, colour, strength = 0.55 }: { id: Id; name: string; cx: number; cy: number; r: number; colour: string; strength?: number }) {
  return (
    <>
      <defs>
        <radialGradient id={id(name)}>
          <stop offset="0" stopColor={colour} stopOpacity={strength} />
          <stop offset="1" stopColor={colour} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id(name)})`} />
    </>
  )
}

function Stars({ points, colour = '#fff' }: { points: Array<[number, number, number, number?]>; colour?: string }) {
  return (
    <>
      {points.map(([x, y, r, o = 0.7]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={colour} opacity={o} />
      ))}
    </>
  )
}

function Moon({ id, cx, cy, r }: { id: Id; cx: number; cy: number; r: number }) {
  return (
    <>
      <defs>
        <mask id={id('moon')}>
          <rect x="-1" y="-1" width="42" height="32" fill="#fff" />
          <circle cx={cx + r * 0.55} cy={cy - r * 0.35} r={r * 0.88} fill="#000" />
        </mask>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="#f3ecd2" mask={`url(#${id('moon')})`} />
    </>
  )
}

/** A four-point twinkle. */
function sparkle(cx: number, cy: number, s: number) {
  return `M${cx} ${cy - s} Q${cx} ${cy} ${cx + s} ${cy} Q${cx} ${cy} ${cx} ${cy + s} Q${cx} ${cy} ${cx - s} ${cy} Q${cx} ${cy} ${cx} ${cy - s} Z`
}

/** The chomp, mouth open to +x, as Pellets and Crumbtrail draw it. */
function chomp(r: number, open = 0.62) {
  const x = r * Math.cos(open)
  const y = r * Math.sin(open)
  return `M0 0 L${x.toFixed(2)} ${y.toFixed(2)} A${r} ${r} 0 1 1 ${x.toFixed(2)} ${(-y).toFixed(2)} Z`
}

/** A ghost: a dome, straight sides, three scalloped feet. */
function ghost(cx: number, cy: number, r: number) {
  const top = cy - r * 0.1
  const bottom = cy + r
  const step = r / 3
  const lift = r * 0.32
  let d = `M${cx - r} ${bottom} V${top} A${r} ${r} 0 0 1 ${cx + r} ${top} V${bottom}`
  for (let i = 0; i < 6; i++) d += ` l${-step} ${i % 2 === 0 ? -lift : lift}`
  return `${d} Z`
}

function GhostEyes({ cx, cy, r, look = [0, 0] }: { cx: number; cy: number; r: number; look?: [number, number] }) {
  const e = r * 0.3
  return (
    <>
      {[-1, 1].map((side) => (
        <g key={side}>
          <circle cx={cx + side * r * 0.38} cy={cy - r * 0.12} r={e} fill="#fff" />
          <circle cx={cx + side * r * 0.38 + look[0] * e * 0.45} cy={cy - r * 0.12 + look[1] * e * 0.45} r={e * 0.5} fill={INK} />
        </g>
      ))}
    </>
  )
}

/** Round white eyes with dark pupils, the arcade's own (Snake's, the hopper's). */
function Eyes({ at, r, look = [0, -1], ring }: { at: Array<[number, number]>; r: number; look?: [number, number]; ring?: string }) {
  return (
    <>
      {at.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r={r} fill="#fff" stroke={ring} strokeWidth={ring ? r * 0.22 : 0} />
          <circle cx={x + look[0] * r * 0.38} cy={y + look[1] * r * 0.38} r={r * 0.5} fill={INK} />
        </g>
      ))}
    </>
  )
}

/* ------------------------------------------------------------------ */

/** Deep space: the ship lined up on a big rock, its shots on the way. */
function Asteroids({ id }: { id: Id }) {
  const teal = [176, 58, 60] as const
  return (
    <>
      <Backdrop id={id} stops={[[0, '#17213a'], [1, '#0b111b']]} />
      <Stars
        points={[
          [3, 4, 0.22],
          [9, 27, 0.18],
          [14, 3, 0.16],
          [21, 27.5, 0.2],
          [33, 27, 0.18],
          [37.5, 6, 0.22],
          [30, 2.2, 0.15],
          [6, 14, 0.14, 0.5],
          [38, 17, 0.16, 0.5],
          [16.5, 9.5, 0.13, 0.45],
        ]}
      />
      <path d="M22.6 3.6 L28.6 2.6 L33.2 6.2 L34 11.6 L30.6 16.4 L24.8 17 L20.6 13.4 L20.2 8 Z" {...wash(...teal, 0.28, 0.7)} />
      <circle cx="27.6" cy="8.8" r="2" {...wash(...teal, 0.22, 0.45)} />
      <circle cx="25" cy="12.9" r="1.1" {...wash(...teal, 0.22, 0.4)} />
      <circle cx="30.3" cy="12.4" r="0.75" {...wash(...teal, 0.22, 0.35)} />
      <path d="M27.4 21.4 L31 20 L33.8 22 L33.4 25.6 L30 27.2 L26.8 25.6 Z" {...wash(10, 64, 64, 0.28, 0.6)} />
      <circle cx="30.3" cy="23.6" r="0.95" {...wash(10, 64, 64, 0.2, 0.35)} />
      <path d="M3.2 6.8 L5.6 6.2 L6.8 8.4 L5.2 10.2 L3 9.2 Z" {...wash(40, 82, 60, 0.3, 0.5)} />
      <path d="M17.2 13.2 L18.7 12.3" {...line(hsl(204, 95, 72), 0.6)} />
      <path d="M14.6 14.7 L15.6 14.1" {...line(hsl(204, 95, 72), 0.6, 0.55)} />
      <g transform="translate(11.8 18.2) rotate(-30)">
        <path d="M-3 -1.3 L-7.4 0 L-3 1.3 Z" fill="#f2813a" opacity="0.9" />
        <path d="M-3 -0.7 L-5.6 0 L-3 0.7 Z" fill="#ffd37a" />
        <path d="M4.6 0 L-3.6 -3.3 L-2.1 0 L-3.6 3.3 Z" {...wash(236, 74, 70, 0.36, 0.65)} />
        <path d="M3 -0.35 L-1.6 -1.9" {...line('#fff', 0.3, 0.55)} />
      </g>
    </>
  )
}

/** Night over the cities: missiles coming down, one caught in a burst, the sight on the next. */
function Patriot({ id }: { id: Id }) {
  const cities = [
    { x: 4.6, hue: 172, heights: [5.2, 7.6, 4.4] },
    { x: 15.6, hue: 38, heights: [6.2, 9, 5.2] },
    { x: 27.4, hue: 128, heights: [4.8, 7, 5.6] },
  ]
  const ground = 26.4
  return (
    <>
      <Backdrop id={id} stops={[[0, '#0b1222'], [0.85, '#17243a']]} />
      <Stars
        points={[
          [4, 11, 0.16],
          [12, 3, 0.18],
          [21, 6.5, 0.14],
          [37, 12, 0.18],
          [34.5, 2.5, 0.15],
          [25, 2.2, 0.13, 0.5],
          [2.5, 19, 0.13, 0.5],
          [19, 15, 0.12, 0.4],
        ]}
      />
      <Moon id={id} cx={7.5} cy={5.4} r={2.3} />
      <rect x="-1" y={ground} width="42" height="5" fill="#0e1822" />
      <path d={`M-1 ${ground} H41`} {...line(hsl(190, 45, 55), 0.25, 0.4)} />
      <path d="M13.6 -0.5 L19.2 10.8" {...line(hsl(4, 80, 62), 0.3, 0.8)} />
      <Glow id={id} name="m1" cx={19.2} cy={10.8} r={1.6} colour={hsl(4, 90, 60)} />
      <circle cx="19.2" cy="10.8" r="0.5" fill={hsl(4, 90, 70)} />
      <path d="M1.4 5 L7.6 15" {...line(hsl(4, 80, 62), 0.3, 0.7)} />
      <Glow id={id} name="m2" cx={7.6} cy={15} r={1.5} colour={hsl(4, 90, 60)} />
      <circle cx="7.6" cy="15" r="0.48" fill={hsl(4, 90, 70)} />
      <path d="M36.5 -0.5 L31 7.4" {...line(hsl(4, 80, 62), 0.3, 0.8)} />
      <path d="M36.6 24.8 L31 15" {...line(hsl(200, 90, 75), 0.25, 0.7)} strokeDasharray="0.5 0.6" />
      <defs>
        <radialGradient id={id('burst')}>
          <stop offset="0" stopColor="#fff6cf" />
          <stop offset="0.28" stopColor="#ffc861" stopOpacity="0.95" />
          <stop offset="0.62" stopColor="#f08a3a" stopOpacity="0.6" />
          <stop offset="1" stopColor="#e8563a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="29.6" cy="10.4" r="6.4" fill={`url(#${id('burst')})`} />
      <circle cx="29.6" cy="10.4" r="4.1" {...line(hsl(30, 95, 65), 0.25, 0.55)} />
      <g {...line('#e7eef3', 0.28, 0.85)}>
        <circle cx="13.2" cy="17.4" r="1.25" />
        <path d="M13.2 15.4 V16.2 M13.2 18.6 V19.4 M11.2 17.4 H12 M14.4 17.4 H15.2" />
      </g>
      <path d="M35 26.4 V25.2 A1.6 1.6 0 0 1 38.2 25.2 V26.4 Z" {...wash(4, 70, 58, 0.45, 0.4)} />
      <path d="M36.6 24.6 L35.9 23.3" {...line(hsl(4, 70, 62), 0.45)} />
      {cities.map((city) =>
        city.heights.map((h, i) => {
          const w = 2.35
          const bx = city.x + i * (w + 0.35)
          const top = ground - h
          const rows = Math.floor((h - 1) / 1.5)
          return (
            <g key={`${city.x}-${i}`}>
              <rect x={bx} y={top} width={w} height={h} {...wash(city.hue, 62, 56, 0.3, 0.42)} />
              {Array.from({ length: rows }, (_, row) =>
                [0, 1].map((col) =>
                  (row + col + i) % 3 === 0 ? null : (
                    <rect
                      key={`${row}-${col}`}
                      x={bx + 0.45 + col * 0.9}
                      y={top + 0.8 + row * 1.5}
                      width="0.55"
                      height="0.6"
                      fill={hsl(46, 95, 74, 0.9)}
                    />
                  ),
                ),
              )}
            </g>
          )
        }),
      )}
      <path d="M19.9 17.4 V15.8" {...line(hsl(38, 62, 56), 0.35)} />
    </>
  )
}

/** On the board: the snake, scales and all, round the corner and up for the golden apple. */
function Snake({ id }: { id: Id }) {
  const scales = ['#e8564f', '#f5b942', '#3ecf8e', '#4aa8e8', '#8a6ad4', '#e85d9a']
  const along: Array<[number, number]> = [
    [6.4, 24.5],
    [8.6, 24.5],
    [10.8, 24.5],
    [13, 24.5],
    [15.2, 24.5],
    [17.4, 24.5],
    [19.6, 24.5],
    [22.9, 23.4],
    [25, 20.4],
    [25, 18.2],
    [25, 16],
  ]
  return (
    <>
      <defs>
        <pattern id={id('check')} width="5" height="5" patternUnits="userSpaceOnUse">
          <rect width="5" height="5" fill="#0f1e20" />
          <rect width="2.5" height="2.5" fill="#132829" />
          <rect x="2.5" y="2.5" width="2.5" height="2.5" fill="#132829" />
        </pattern>
      </defs>
      <rect x="-1" y="-1" width="42" height="32" fill={`url(#${id('check')})`} />
      <rect x="0.8" y="0.8" width="38.4" height="28.4" rx="2" {...line(hsl(152, 50, 48), 0.4, 0.5)} />
      <rect x="6.6" y="8.2" width="9" height="2.3" rx="0.7" {...wash(205, 16, 62, 0.22, 0.4)} />
      <path d="M9.6 8.4 V10.3 M12.6 8.4 V10.3" {...line(hsl(205, 16, 62), 0.25, 0.5)} />
      <rect x="29.4" y="8.2" width="9" height="2.3" rx="0.7" {...wash(205, 16, 62, 0.22, 0.4)} />
      <path
        d="M5 26.3 H21.5 A5.3 5.3 0 0 0 26.8 21 V12.5 L23.2 12.5 V21 A1.7 1.7 0 0 1 21.5 22.7 H5 Q2.6 22.9 1.6 24.5 Q2.6 26.1 5 26.3 Z"
        fill="#1b4034"
        stroke={hsl(152, 62, 56)}
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      {along.map(([x, y], i) => (
        <path key={`${x}-${y}`} d={`M${x} ${y - 0.62} L${x + 0.62} ${y} L${x} ${y + 0.62} L${x - 0.62} ${y} Z`} fill={scales[i % scales.length]} />
      ))}
      <ellipse cx="25" cy="11.2" rx="2.35" ry="2.75" fill="#1f4a3b" stroke={hsl(152, 62, 56)} strokeWidth="0.6" />
      <Eyes at={[[23.95, 10.4], [26.05, 10.4]]} r={0.88} />
      <Glow id={id} name="apple" cx={25} cy={4.6} r={3.6} colour="#f5b942" strength={0.35} />
      <circle cx="25" cy="4.6" r="3" {...line('#f5b942', 0.25, 0.8)} strokeDasharray="0.45 0.7" />
      <circle cx="25" cy="4.9" r="1.85" {...wash(42, 92, 62, 0.45, 0.5)} />
      <path d="M25 3.1 L25.3 2.2" {...line('#9a6a3a', 0.3)} />
      <path d="M25.3 2.5 Q26.6 1.6 27.3 2.4 Q26.2 3.2 25.3 2.5 Z" fill="#3ecf8e" />
      <circle cx="33.9" cy="18.9" r="0.95" {...wash(350, 72, 58, 0.55, 0.35)} />
      <circle cx="35.6" cy="19.2" r="0.95" {...wash(350, 72, 58, 0.55, 0.35)} />
      <path d="M33.9 18 Q34.4 16.4 35.4 16 M35.6 18.3 Q35.5 17 35.4 16" {...line('#3ecf8e', 0.22)} />
    </>
  )
}

/** The game's rows: the hopper on the grass, a bus down the road, logs and a coin on the river. */
function Crosswalk({ id }: { id: Id }) {
  const tree = (cx: number, cy: number) => (
    <g key={`${cx}`}>
      <ellipse cx={cx + 0.5} cy={cy + 2.4} rx="2.2" ry="0.6" fill="#000" opacity="0.18" />
      <circle cx={cx} cy={cy} r="2.6" {...wash(148, 56, 56, 0.3, 0.55)} />
      <ellipse cx={cx} cy={cy + 0.9} rx="0.9" ry="1.1" fill={hsl(148, 56, 62, 0.55)} />
    </g>
  )
  return (
    <>
      <rect x="-1" y="-1" width="42" height="10.6" fill="#1c4764" />
      {[3, 8, 13, 18, 23, 28, 33, 38].map((x) => (
        <circle key={x} cx={x} cy="8.2" r="0.35" {...line(hsl(200, 60, 65), 0.15, 0.35)} />
      ))}
      <rect x="-1" y="9.6" width="42" height="9.4" fill="#252c35" />
      <path d="M-1 9.6 H41 M-1 19 H41" {...line('#3b4653', 0.35)} />
      <rect x="-1" y="19" width="42" height="12" fill="#2a5438" />
      {[
        [11.6, 21.6],
        [26.4, 28.2],
        [3.4, 28.6],
        [37, 21.4],
        [15, 28.8],
      ].map(([x, y]) => (
        <path key={`${x}-${y}`} d={`M${x - 0.5} ${y - 0.7} L${x} ${y} L${x + 0.5} ${y - 0.7}`} {...line(hsl(130, 40, 56), 0.2, 0.55)} />
      ))}
      <rect x="2.4" y="2.4" width="13" height="4.6" rx="2.3" {...wash(32, 56, 56, 0.42, 0.5)} />
      <ellipse cx="4.6" cy="4.7" rx="0.9" ry="1.5" {...line(hsl(32, 56, 56), 0.3, 0.8)} />
      <path d="M7.4 4 H13 M8.6 5.5 H12" {...line(hsl(32, 56, 56), 0.25, 0.55)} />
      <rect x="26.6" y="2.4" width="14" height="4.6" rx="2.3" {...wash(32, 56, 56, 0.42, 0.5)} />
      <path d="M30 4 H36 M31 5.5 H38" {...line(hsl(32, 56, 56), 0.25, 0.55)} />
      <Glow id={id} name="coin" cx={21.2} cy={4.7} r={2.4} colour="#f5c542" strength={0.4} />
      <circle cx="21.2" cy="4.7" r="1.3" fill="#f5c542" stroke="#c9901f" strokeWidth="0.3" />
      <circle cx="21.2" cy="4.7" r="0.8" {...line('#c9901f', 0.2, 0.5)} />
      <g>
        <rect x="14.2" y="10.4" width="2.4" height="0.9" rx="0.3" fill="#10151b" />
        <rect x="24" y="10.4" width="2.4" height="0.9" rx="0.3" fill="#10151b" />
        <rect x="14.2" y="17.3" width="2.4" height="0.9" rx="0.3" fill="#10151b" />
        <rect x="24" y="17.3" width="2.4" height="0.9" rx="0.3" fill="#10151b" />
        <rect x="12.4" y="11.1" width="16.4" height="6.4" rx="1.6" {...wash(168, 56, 58, 0.3, 0.55)} />
        <rect x="13.9" y="12.5" width="9.4" height="3.6" rx="0.6" {...wash(168, 56, 58, 0.18, 0.3)} />
        <path d="M16.3 12.5 V16.1 M18.6 12.5 V16.1 M20.9 12.5 V16.1" {...line(hsl(168, 56, 58), 0.25, 0.8)} />
        <rect x="24.6" y="12.5" width="2.6" height="3.6" rx="0.6" {...wash(168, 56, 58, 0.18, 0.3)} />
        <circle cx="28.4" cy="12.4" r="0.38" fill="#ffe28a" />
        <circle cx="28.4" cy="16.2" r="0.38" fill="#ffe28a" />
        <circle cx="12.8" cy="12.4" r="0.32" fill="#e8564f" />
        <circle cx="12.8" cy="16.2" r="0.32" fill="#e8564f" />
      </g>
      {tree(7.6, 24.2)}
      {tree(33, 24.6)}
      <Glow id={id} name="hop" cx={20} cy={24.2} r={5.4} colour="#f5c542" strength={0.4} />
      <circle cx="20" cy="24.2" r="3.4" {...wash(45, 90, 60, 0.42, 0.6)} />
      <Eyes at={[[18.75, 23.4], [21.25, 23.4]]} r={1.05} ring={INK} />
    </>
  )
}

/** The tower, cyan at the foot to pink at the top, and the next slab sliding in over it. */
function Stacker({ id }: { id: Id }) {
  const slab = (cx: number, cy: number, a: number, hue: number, key: string, t = 1.9) => {
    const b = a / 2
    return (
      <g key={key}>
        <path d={`M${cx - a} ${cy} L${cx} ${cy + b} L${cx} ${cy + b + t} L${cx - a} ${cy + t} Z`} fill={hsl(hue, 68, 48)} />
        <path d={`M${cx} ${cy + b} L${cx + a} ${cy} L${cx + a} ${cy + t} L${cx} ${cy + b + t} Z`} fill={hsl(hue, 68, 38)} />
        <path
          d={`M${cx} ${cy - b} L${cx + a} ${cy} L${cx} ${cy + b} L${cx - a} ${cy} Z`}
          fill={hsl(hue, 74, 64)}
          stroke={hsl(hue, 90, 80, 0.7)}
          strokeWidth="0.2"
          strokeLinejoin="round"
        />
      </g>
    )
  }
  // Bottom up, each slab a step further round from cyan toward pink, as the game colours them.
  const tower = [238, 250, 262, 274, 286, 298, 310, 322].map((hue, i) => ({ cy: 29.6 - i * 1.9, a: 8.6, hue }))
  return (
    <>
      <Backdrop id={id} stops={[[0, '#1a2248'], [1, '#0b1122']]} />
      <Stars
        points={[
          [4, 5, 0.18],
          [11, 12, 0.14, 0.5],
          [35, 4, 0.2],
          [37, 15, 0.14, 0.5],
          [3, 20, 0.14, 0.45],
          [29, 27, 0.14, 0.45],
        ]}
      />
      <path d="M20 10.1 L32.8 16.3 L20 22.5 L7.2 16.3 Z" {...line('#fff', 0.15, 0.14)} />
      <path d="M20 7.3 L38.4 16.3 L20 25.3 L1.6 16.3 Z" {...line('#fff', 0.15, 0.08)} />
      {tower.map((s) => slab(20, s.cy, s.a, s.hue, `${s.cy}`))}
      <Glow id={id} name="land" cx={20} cy={16.3} r={7} colour="#ff9ad5" strength={0.18} />
      {slab(26, 7.4, 8.2, 332, 'next')}
      <path d="M35.6 5.6 H38.8 M36.6 7.8 H39.8" {...line('#ff9ad5', 0.35, 0.55)} />
      <path d={sparkle(10.2, 13.2, 1)} fill="#f5c542" />
      <path d={sparkle(12.6, 10.8, 0.55)} fill="#f5c542" opacity="0.8" />
    </>
  )
}

/** The glass plate tipped toward you over the table, its brass weight, and the gold ring where it balances. */
function Centroid({ id }: { id: Id }) {
  const top = 'M7.5 18.8 L12.8 8.2 L22.2 6.2 L33.6 17.6 L26 22.8 Z'
  return (
    <>
      <defs>
        <pattern id={id('grid')} width="2.5" height="2.5" patternUnits="userSpaceOnUse">
          <rect width="2.5" height="2.5" fill="#141c24" />
          <path d="M2.5 0 V2.5 H0" fill="none" stroke="#1f2b35" strokeWidth="0.12" />
        </pattern>
        <linearGradient id={id('glass')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={hsl(176, 60, 66, 0.5)} />
          <stop offset="1" stopColor={hsl(182, 55, 48, 0.3)} />
        </linearGradient>
        <radialGradient id={id('brass')} cx="0.4" cy="0.35">
          <stop offset="0" stopColor="#f0c07a" />
          <stop offset="1" stopColor="#9a6532" />
        </radialGradient>
      </defs>
      <rect x="-1" y="-1" width="42" height="32" fill={`url(#${id('grid')})`} />
      <path d={top} transform="translate(2.4 3.8)" fill="#000" opacity="0.35" />
      <path d="M7.5 18.8 L26 22.8 L33.6 17.6 V19.2 L26 24.4 L7.5 20.4 Z" fill={hsl(180, 45, 34, 0.8)} stroke={hsl(178, 60, 64)} strokeWidth="0.3" strokeLinejoin="round" />
      <path d={top} fill={`url(#${id('glass')})`} stroke={hsl(178, 65, 68)} strokeWidth="0.45" strokeLinejoin="round" />
      <path d="M13.6 9.4 L19.4 8.1" {...line('#fff', 0.35, 0.35)} />
      <Glow id={id} name="ring" cx={19.4} cy={14.9} r={5.2} colour="#f5c542" strength={0.3} />
      <ellipse cx="19.4" cy="14.9" rx="4" ry="2.8" fill={hsl(42, 92, 60, 0.12)} stroke="#e8b44c" strokeWidth="0.4" />
      {[
        [17.2, 14],
        [18.4, 13.2],
        [20.8, 13.4],
        [21.6, 15.6],
        [18, 16.2],
        [20.4, 16.4],
        [16.8, 15.2],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="0.22" fill="#f5c542" />
      ))}
      <path d="M19.4 14.9 V18.5" {...line('#e9eef2', 0.25, 0.9)} />
      <circle cx="19.4" cy="18.8" r="0.55" fill="#e8564f" />
      <circle cx="19.4" cy="14.9" r="0.55" fill="#fff4c9" />
      <ellipse cx="13" cy="14.5" rx="2.2" ry="1.7" fill="#6e4524" />
      <ellipse cx="13" cy="13.9" rx="2.2" ry="1.7" fill={`url(#${id('brass')})`} stroke="#e0a868" strokeWidth="0.3" />
      <circle cx="13" cy="13.9" r="0.38" fill="#5a3a1e" />
    </>
  )
}

/** A gold bubble to pop, centre and rings, a pink one with its star, sparkles off them. */
function Pop({ id }: { id: Id }) {
  return (
    <>
      <Backdrop id={id} stops={[[0, '#17212c'], [1, '#0f161e']]} />
      <Glow id={id} name="gold" cx={17} cy={17} r={11} colour="#f5b942" strength={0.28} />
      <defs>
        <radialGradient id={id('disc')} cx="0.38" cy="0.32">
          <stop offset="0" stopColor="#ffe9a6" />
          <stop offset="0.55" stopColor="#f3b53c" />
          <stop offset="1" stopColor="#c7861d" />
        </radialGradient>
      </defs>
      <circle cx="17" cy="17" r="7.8" {...line(hsl(46, 90, 70), 0.25, 0.5)} strokeDasharray="4 2.2" />
      <circle cx="17" cy="17" r="6.3" fill={`url(#${id('disc')})`} stroke="#ffd66b" strokeWidth="0.5" />
      <circle cx="17" cy="17" r="3.9" {...line(hsl(38, 80, 42), 0.35, 0.55)} />
      <circle cx="17" cy="17" r="1.7" fill={hsl(46, 96, 80)} stroke={hsl(38, 80, 42, 0.6)} strokeWidth="0.3" />
      <path d="M12.2 14.4 A5.4 5.4 0 0 1 15 11.6" {...line('#fff', 0.7, 0.6)} />
      <path d={sparkle(9.4, 11.4, 1)} fill="#ffe08a" />
      <path d={sparkle(24.6, 11.8, 0.7)} fill="#ffe08a" />
      <path d={sparkle(23.6, 24.2, 0.6)} fill="#ffe08a" opacity="0.8" />
      <circle cx="31" cy="8.2" r="4.4" {...line('#e8607f', 0.45)} />
      <circle cx="31" cy="8.2" r="3.4" {...line(hsl(42, 80, 62), 0.3, 0.7)} />
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 + 0.3
        return <circle key={i} cx={31 + Math.cos(a) * 4.9} cy={8.2 + Math.sin(a) * 4.9} r={i % 3 === 0 ? 0.36 : 0.24} fill="#e8607f" />
      })}
      <path d={sparkle(31, 8.2, 2)} fill="#efe6d4" />
      <circle cx="7.6" cy="24" r="2.3" {...line(hsl(184, 60, 60), 0.35, 0.5)} />
      <path d="M6.3 23 A1.6 1.6 0 0 1 7.2 22.2" {...line('#fff', 0.35, 0.4)} />
    </>
  )
}

function MazeWall({ x, y, w, h, hue = 234 }: { x: number; y: number; w: number; h: number; hue?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="1.8" fill={hsl(hue, 45, 22, 0.55)} stroke={hsl(hue, 72, 66)} strokeWidth="0.5" />
      <rect x={x + 0.8} y={y + 0.8} width={w - 1.6} height={h - 1.6} rx="1.1" {...line(hsl(hue, 72, 66), 0.25, 0.45)} />
    </g>
  )
}

/** Down a corridor of the neon maze: the chomp at speed, pellets ahead, a ghost coming up from below. */
function Pellets({ id }: { id: Id }) {
  return (
    <>
      <Backdrop id={id} stops={[[0, '#10151e'], [1, '#0c1017']]} />
      <MazeWall x={-2} y={2.6} w={44} h={6} />
      <MazeWall x={-2} y={21.6} w={15.6} h={9} />
      <MazeWall x={21.4} y={21.6} w={20.6} h={9} />
      <path d="M29 8.6 H33.6" {...line('#e85d9a', 0.6)} />
      {[25.6, 29.2, 36.4].map((x) => (
        <circle key={x} cx={x} cy="15" r="0.62" fill="#f2c14e" />
      ))}
      <Glow id={id} name="power" cx={32.8} cy={15} r={2.6} colour="#f2c14e" strength={0.45} />
      <circle cx="32.8" cy="15" r="1.25" fill="#f2c14e" />
      <circle cx="10.6" cy="15" r="3.2" fill={hsl(24, 90, 58, 0.14)} />
      <circle cx="6.6" cy="15" r="2.6" fill={hsl(24, 90, 58, 0.07)} />
      <Glow id={id} name="chomp" cx={17} cy={15} r={7.5} colour="#f2813a" strength={0.35} />
      <g transform="translate(17 15)">
        <path d={chomp(4.3)} {...wash(24, 90, 58, 0.36, 0.65)} />
      </g>
      <path d={ghost(17.5, 26.2, 2.7)} {...wash(188, 78, 62, 0.3, 0.5)} />
      <GhostEyes cx={17.5} cy={26.2} r={2.7} look={[0, -1]} />
    </>
  )
}

/** Among the crowd on the picnic blanket: the bee you're after, big as life, and two more bugs by the food. */
function FindBug({ id }: { id: Id }) {
  return (
    <>
      <defs>
        <pattern id={id('gingham')} width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="#fbefea" />
          <rect width="2" height="4" fill="#e25a5f" opacity="0.5" />
          <rect width="4" height="2" fill="#e25a5f" opacity="0.5" />
        </pattern>
        <clipPath id={id('bee')}>
          <ellipse cx="20" cy="20.2" rx="4.6" ry="5.2" />
        </clipPath>
      </defs>
      <rect x="-1" y="-1" width="42" height="32" fill="#3b7a3a" />
      {[
        [3, 2.6],
        [9, 1.6],
        [15, 3],
        [27, 2],
        [34, 3.2],
        [38.5, 1.4],
      ].map(([x, y]) => (
        <path key={`${x}-${y}`} d={`M${x - 0.6} ${y + 0.8} L${x - 0.2} ${y - 0.4} L${x + 0.2} ${y + 0.5} L${x + 0.6} ${y - 0.6}`} {...line('#2c5e2c', 0.3)} />
      ))}
      <rect x="-1" y="5.4" width="42" height="26" fill={`url(#${id('gingham')})`} />
      <path d="M-1 6.3 H41" {...line('#fff', 0.25, 0.8)} strokeDasharray="0.8 0.6" />
      <path d="M36.4 28 A5.2 5.2 0 0 1 36.4 17.6 Z" {...inked('#ef6f73')} />
      <path d="M36.4 28 A5.2 5.2 0 0 1 36.4 17.6" fill="none" stroke="#4caf50" strokeWidth="1" />
      <circle cx="34.6" cy="21" r="0.3" fill={INK} />
      <circle cx="34.4" cy="24" r="0.3" fill={INK} />
      <path d="M6.6 20.4 C4.4 20.4 3.8 23 5 25.2 C5.9 26.9 7 27.6 7.6 27.6 C8.2 27.6 9.3 26.9 10.2 25.2 C11.4 23 10.8 20.4 8.6 20.4 Z" {...inked('#e8474e')} />
      {[
        [6.2, 22.4],
        [8.8, 22.6],
        [7.5, 24.4],
        [6.3, 25.6],
        [8.8, 25.4],
      ].map(([x, y]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="0.2" ry="0.3" fill="#ffe28a" />
      ))}
      <path d="M5.6 20.8 L6.4 19.2 L7.6 20.2 L8.8 19.2 L9.6 20.8 Z" {...inked('#4caf50', 0.32)} />
      <g>
        <ellipse cx="11.2" cy="12.4" rx="2.3" ry="1.9" {...inked('#e8474e')} />
        <path d="M11.2 10.5 V14.3" {...line(INK, 0.3)} />
        <circle cx="10.2" cy="12.3" r="0.4" fill={INK} />
        <circle cx="12.3" cy="13.2" r="0.36" fill={INK} />
        <circle cx="11.2" cy="10.3" r="1.2" {...inked('#2a2f3a', 0.3)} />
        <circle cx="10.75" cy="10.1" r="0.36" fill="#fff" />
        <circle cx="11.65" cy="10.1" r="0.36" fill="#fff" />
      </g>
      <g>
        <ellipse cx="29.6" cy="13" rx="2" ry="2.6" {...inked('#8a6ad4')} />
        <path d="M29.6 11.2 V15.4" {...line(INK, 0.28)} />
        <circle cx="29.6" cy="10.2" r="1.35" {...inked('#6e52b8', 0.32)} />
        <circle cx="29.1" cy="10" r="0.42" fill="#fff" />
        <circle cx="30.1" cy="10" r="0.42" fill="#fff" />
        <circle cx="29.15" cy="10.1" r="0.2" fill={INK} />
        <circle cx="30.15" cy="10.1" r="0.2" fill={INK} />
        <path d="M28.9 9 Q28.2 7.8 27.6 7.6 M30.3 9 Q31 7.8 31.6 7.6" {...line(INK, 0.25)} />
      </g>
      <ellipse cx="16.4" cy="14.6" rx="2.9" ry="1.8" transform="rotate(-28 16.4 14.6)" {...inked('#ffffff', 0.35)} opacity="0.95" />
      <ellipse cx="23.6" cy="14.6" rx="2.9" ry="1.8" transform="rotate(28 23.6 14.6)" {...inked('#ffffff', 0.35)} opacity="0.95" />
      <ellipse cx="20" cy="20.2" rx="4.6" ry="5.2" {...inked('#f6c343', 0.45)} />
      <g clipPath={`url(#${id('bee')})`}>
        <rect x="14" y="19.4" width="12" height="1.5" fill={INK} />
        <rect x="14" y="22.5" width="12" height="1.5" fill={INK} />
      </g>
      <ellipse cx="20" cy="20.2" rx="4.6" ry="5.2" fill="none" stroke={INK} strokeWidth="0.45" />
      <circle cx="20" cy="13.4" r="3.5" {...inked('#f6c343', 0.45)} />
      <path d="M18.4 10.3 Q17.4 8 16.2 7.6 M21.6 10.3 Q22.6 8 23.8 7.6" {...line(INK, 0.35)} />
      <circle cx="16.1" cy="7.5" r="0.55" fill={INK} />
      <circle cx="23.9" cy="7.5" r="0.55" fill={INK} />
      <ellipse cx="18.65" cy="13.1" rx="1.15" ry="1.3" {...inked('#fff', 0.3)} />
      <ellipse cx="21.35" cy="13.1" rx="1.15" ry="1.3" {...inked('#fff', 0.3)} />
      <circle cx="18.85" cy="13.35" r="0.58" fill={INK} />
      <circle cx="21.55" cy="13.35" r="0.58" fill={INK} />
      <path d="M19.1 15.2 Q20 15.9 20.9 15.2" {...line(INK, 0.3)} />
    </>
  )
}

/** Curtains of bullets, the little ship threading them with its shots going up, invaders at the top. */
function Barrage({ id }: { id: Id }) {
  const curtain = (base: number, bend: number, gap: [number, number]) =>
    Array.from({ length: 22 }, (_, i) => {
      const x = -0.6 + i * 1.95
      if (x > gap[0] && x < gap[1]) return null
      const y = base + bend * ((x - 20) / 20) ** 2
      return (
        <g key={`${base}-${i}`}>
          <circle cx={x} cy={y} r="0.66" fill={hsl(206, 85, 55, 0.55)} stroke={hsl(204, 95, 72)} strokeWidth="0.22" />
          <circle cx={x} cy={y} r="0.26" fill="#fff" />
        </g>
      )
    })
  return (
    <>
      <Backdrop id={id} stops={[[0, '#0f1826'], [1, '#0b111b']]} />
      <rect x="7" y="-1" width="26" height="32" fill="#111c2a" stroke={hsl(210, 30, 45, 0.3)} strokeWidth="0.25" />
      <Stars
        points={[
          [3, 6, 0.14, 0.5],
          [37, 9, 0.14, 0.5],
          [10, 20, 0.12, 0.45],
          [30, 25, 0.12, 0.45],
          [36, 27, 0.14, 0.5],
          [2.5, 26, 0.12, 0.45],
        ]}
      />
      <path d={ghost(15.6, 4.6, 2.2)} {...wash(252, 70, 68, 0.32, 0.45)} />
      <GhostEyes cx={15.6} cy={4.6} r={2.2} look={[0.4, 0.6]} />
      <path d={ghost(24.6, 3.8, 2.2)} {...wash(252, 70, 68, 0.32, 0.45)} />
      <GhostEyes cx={24.6} cy={3.8} r={2.2} look={[-0.4, 0.6]} />
      {[
        [13.4, 8.8],
        [17.8, 9.4],
        [26.6, 8.4],
        [22.4, 9.8],
        [29.6, 12.4],
        [11, 12],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="0.45" fill="#f2a03a" />
      ))}
      {curtain(13, 2.2, [16.8, 23.2])}
      {curtain(19, 1.8, [19.4, 25.6])}
      {[
        [19.7, 20.6],
        [21.3, 20.6],
        [19.7, 16.4],
        [21.3, 16.4],
        [19.7, 11.2],
        [21.3, 11.2],
      ].map(([x, y]) => (
        <path key={`${x}-${y}`} d={`M${x} ${y} V${y - 1}`} {...line('#5fe0a0', 0.3)} />
      ))}
      <circle cx="20.5" cy="25" r="2.6" {...line('#5fe0a0', 0.2, 0.35)} />
      <path d="M20.5 22.2 L22.4 26.6 L20.5 25.6 L18.6 26.6 Z" {...wash(150, 66, 56, 0.4, 0.5)} />
      <Glow id={id} name="pip" cx={29} cy={22.4} r={2.2} colour="#f5c542" strength={0.5} />
      <path d="M29 21.2 L29.8 22.4 L29 23.6 L28.2 22.4 Z" fill="#f5c542" />
    </>
  )
}

/** A shaft of the maze: the chomp climbing, crumbs going on up out of sight, a ghost at a side turning. */
function Crumbtrail({ id }: { id: Id }) {
  const crumb = '#3ecf8e'
  return (
    <>
      <Backdrop id={id} stops={[[0, '#121a30'], [1, '#0d1222']]} />
      <MazeWall x={3.6} y={-2} w={11.8} h={12} />
      <MazeWall x={3.6} y={14.6} w={11.8} h={17} />
      <MazeWall x={24.6} y={-2} w={11.8} h={17.4} />
      <MazeWall x={24.6} y={20} w={11.8} h={11.6} />
      {[
        [20, 17.8, 1],
        [20, 13.4, 1],
        [20, 9, 0.8],
        [20, 4.6, 0.6],
        [20, 0.6, 0.35],
        [12.2, 12.3, 1],
        [8, 12.3, 0.8],
        [1.6, 12.3, 0.5],
        [38.4, 17.7, 0.5],
      ].map(([x, y, o]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="0.62" fill={crumb} opacity={o} />
      ))}
      <path d={ghost(30.4, 17.1, 2.2)} {...wash(330, 75, 66, 0.32, 0.45)} />
      <GhostEyes cx={30.4} cy={17.1} r={2.2} look={[-1, 0]} />
      <Glow id={id} name="chomp" cx={20} cy={24.4} r={7} colour={crumb} strength={0.4} />
      <g transform="translate(20 24.4) rotate(-90)">
        <path d={chomp(3.9)} {...wash(152, 62, 56, 0.36, 0.65)} />
      </g>
    </>
  )
}

/** The toy itself: the big BOP button in the middle, a knob, a handle, a switch and a wheel round it. */
function Bop({ id }: { id: Id }) {
  return (
    <>
      <rect x="-1" y="-1" width="42" height="32" fill="#12141c" />
      <rect x="1.2" y="1.2" width="37.6" height="27.6" rx="3.4" fill="#1c1f2b" stroke="#e0567a" strokeWidth="1.1" />
      <rect x="13.2" y="3.6" width="13.6" height="4.4" rx="1" fill="#2a1a26" stroke={hsl(345, 60, 58, 0.6)} strokeWidth="0.3" />
      <text x="20" y="6.95" textAnchor="middle" fontSize="2.9" fontWeight="900" fill="#f06b8f" fontFamily="Outfit, system-ui, sans-serif">
        BOP IT!
      </text>
      <defs>
        <radialGradient id={id('button')} cx="0.42" cy="0.36">
          <stop offset="0" stopColor="#f58a98" />
          <stop offset="0.6" stopColor="#d9485f" />
          <stop offset="1" stopColor="#a8304a" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="18.6" r="6.6" fill="#261f2c" stroke="#3b3040" strokeWidth="0.35" />
      <circle cx="20" cy="18.6" r="5" fill={`url(#${id('button')})`} stroke="#f28a98" strokeWidth="0.4" />
      <circle cx="20" cy="18.6" r="3.4" {...line(hsl(350, 80, 80), 0.3, 0.45)} />
      <path d="M16.4 16.4 A4.2 4.2 0 0 1 19 14.5" {...line('#fff', 0.5, 0.5)} />
      <circle cx="8" cy="12.2" r="3.1" fill="#1a2733" stroke="#4aa8e8" strokeWidth="0.5" />
      <circle cx="8" cy="12.2" r="2.2" fill={hsl(204, 72, 56, 0.25)} />
      <path d="M8 12.2 V10.3" {...line('#fff', 0.45)} />
      <path d="M4.2 9.6 A4.6 4.6 0 0 1 6 8.1 M10 8.1 A4.6 4.6 0 0 1 11.8 9.6" {...line('#4aa8e8', 0.3, 0.7)} />
      <rect x="29.4" y="9.4" width="6.2" height="2" rx="1" {...wash(42, 88, 62, 0.4, 0.4)} />
      <path d="M31 9.9 V10.9 M32.5 9.9 V10.9 M34 9.9 V10.9" {...line('#f5b942', 0.22, 0.7)} />
      <rect x="31.8" y="11.9" width="1.4" height="4.4" rx="0.7" fill="#14161e" stroke={hsl(0, 0, 100, 0.12)} strokeWidth="0.2" />
      <rect x="5.9" y="19.6" width="4.2" height="6.4" rx="1.3" {...wash(184, 62, 56, 0.18, 0.45)} />
      <rect x="6.7" y="22.8" width="2.6" height="2.4" rx="0.7" {...wash(184, 62, 60, 0.5, 0.35)} />
      <circle cx="32.5" cy="22.4" r="3.3" fill="#231d35" stroke="#8a6ad4" strokeWidth="0.5" />
      <circle cx="32.5" cy="22.4" r="2.4" {...line('#8a6ad4', 0.3, 0.7)} />
      <path d="M32.5 22.4 Q33.4 20.8 34.6 20.6 M32.5 22.4 Q31.2 21.6 30.6 20.4 M32.5 22.4 Q32.2 24.2 33 25" {...line('#b39cf0', 0.28)} />
      <circle cx="34.1" cy="22.8" r="0.5" fill="#b39cf0" />
    </>
  )
}

/** Out on the course: the fairway between its wooden rails, the cup and its red flag, the ball in its white round. */
function Putt({ id }: { id: Id }) {
  const fairway = 'M-3 27 C7 27 11 19 19 16 S31 6 43 5'
  return (
    <>
      <defs>
        <pattern id={id('mow')} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(24)">
          <rect width="5" height="5" fill="#2f7d4f" />
          <rect width="2.5" height="5" fill="#2a7048" />
        </pattern>
      </defs>
      <rect x="-1" y="-1" width="42" height="32" fill="#193325" />
      {[
        [2, 3, 3.4],
        [8, -0.5, 2.8],
        [37, 26, 3.6],
        [31.5, 29.5, 2.6],
        [38.5, 14, 2.4],
        [1.5, 14.5, 2.6],
      ].map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#21452f" />
      ))}
      <circle cx="3.6" cy="5.2" r="0.5" fill="#e87bb0" />
      <circle cx="4.8" cy="6.2" r="0.4" fill="#f2a3c8" />
      <circle cx="35.4" cy="24.4" r="0.5" fill="#e87bb0" />
      <circle cx="36.6" cy="25.6" r="0.4" fill="#f2a3c8" />
      <path d={fairway} {...line('#4a2e1c', 14.6)} />
      <path d={fairway} {...line('#9a6a42', 13.8)} />
      <path d={fairway} {...line('#7d5334', 12.8)} />
      <path d={fairway} {...line(`url(#${id('mow')})`, 12)} />
      <ellipse cx="29.6" cy="10.2" rx="1.35" ry="0.95" fill="#0e1a13" stroke="#1d3a28" strokeWidth="0.2" />
      <path d="M29.6 10.1 L32.4 11.2" {...line('#000', 0.3, 0.25)} />
      <path d="M29.6 10.1 V3" {...line('#eef1f5', 0.35)} />
      <path d="M29.6 3 L33.9 3.9 L29.6 5.2 Z" fill={hsl(4, 70, 60)} stroke={hsl(4, 70, 44)} strokeWidth="0.2" strokeLinejoin="round" />
      <circle cx="12.4" cy="21" r="2.2" fill="#fff" opacity="0.28" />
      <path d="M11.2 20.1 L7.4 24.8 L13.1 21.9 Z" fill="#fff" opacity="0.85" />
      <ellipse cx="12.9" cy="21.7" rx="1.1" ry="0.5" fill="#000" opacity="0.25" />
      <circle cx="12.4" cy="21" r="1.2" fill="#f7f8fa" stroke={hsl(210, 20, 26, 0.7)} strokeWidth="0.25" />
    </>
  )
}

/**
 * Down the lane at dusk from behind the ball: the green between its rails, the bullseye at the far end
 * under its teal beacon, and the gold line of the last try curling up to it.
 */
function AceChase({ id }: { id: Id }) {
  const left = 'M8.5 31 C10.5 25 14.2 21 15.4 17.6 C16.2 15.4 16.5 13.8 16.9 11.8'
  const right = 'M31.5 31 C29.5 25 26.6 21 25.4 17.6 C24.4 15 23.6 13.6 23.1 11.8'
  const lane = `${left} L23.1 11.8 C23.6 13.6 24.4 15 25.4 17.6 C26.6 21 29.5 25 31.5 31 Z`
  return (
    <>
      <defs>
        <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d1a2b" />
          <stop offset="1" stopColor="#4a5a6e" />
        </linearGradient>
        <radialGradient id={id('sun')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#f29a5a" stopOpacity="0.75" />
          <stop offset="1" stopColor="#f29a5a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('beam')} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#5fe3c9" stopOpacity="0.85" />
          <stop offset="1" stopColor="#5fe3c9" stopOpacity="0" />
        </linearGradient>
        <pattern id={id('mow')} width="40" height="2.4" patternUnits="userSpaceOnUse">
          <rect width="40" height="2.4" fill="#2f8a47" />
          <rect width="40" height="1.2" fill="#29793f" />
        </pattern>
      </defs>
      <rect x="-1" y="-1" width="42" height="14" fill={`url(#${id('sky')})`} />
      <ellipse cx="6" cy="11.6" rx="11" ry="5" fill={`url(#${id('sun')})`} />
      <path d="M-1 12.6 C4 9.6 9 10.8 13 11.6 C17 9.8 23 10 27 11.4 C31 9.4 37 9.8 41 11.8 V31 H-1 Z" fill="#1b2e22" />
      {[
        [3.5, 11.2, 2.4],
        [9, 10.6, 2],
        [30.5, 10.4, 2.3],
        [36.5, 11, 2.6],
      ].map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#14241a" />
      ))}
      <path d={lane} fill={`url(#${id('mow')})`} />
      <path d={left} {...line('#6b4a2e', 1.3)} />
      <path d={right} {...line('#6b4a2e', 1.3)} />
      <path d={left} {...line('#eee9dd', 0.55)} />
      <path d={right} {...line('#eee9dd', 0.55)} />
      <path d="M17.6 20.6 C19.4 20.1 21.6 20.2 23.2 20.8" {...line('#3ca057', 0.9, 0.55)} />
      <path d="M17.1 16.4 C18.8 16 21.4 16 22.9 16.5" {...line('#3ca057', 0.7, 0.5)} />
      <ellipse cx="20" cy="13.9" rx="3.3" ry="1.15" fill="#22364a" stroke="#f7f5ee" strokeWidth="0.18" />
      <ellipse cx="20" cy="13.9" rx="2.05" ry="0.72" fill="#f7f5ee" />
      <ellipse cx="20" cy="13.9" rx="0.95" ry="0.34" fill="#2eb8a0" stroke="#22364a" strokeWidth="0.1" />
      <path d="M19.35 13.9 L19.75 1 H20.25 L20.65 13.9 Z" fill={`url(#${id('beam')})`} />
      <ellipse cx="20" cy="13.9" rx="0.24" ry="0.1" fill="#fff" />
      <path d="M20.2 24.4 C24.8 21.8 16.4 19.4 19.4 16.2 C19.9 15.3 20.2 14.8 20.1 14.2" {...line('#f5b942', 0.42)} />
      <path d="M19.8 24.4 C15.8 21.2 23.8 18.4 21.2 15.4" {...line('#f3f6ee', 0.3, 0.4)} />
      <ellipse cx="20.5" cy="26.4" rx="1.6" ry="0.55" fill="#000" opacity="0.3" />
      <circle cx="15.8" cy="26.2" r="0.55" fill="#2eb8a0" />
      <circle cx="24.2" cy="26.2" r="0.55" fill="#2eb8a0" />
      <circle cx="20" cy="25.3" r="1.45" fill="#f7f8fa" stroke={hsl(210, 20, 26, 0.6)} strokeWidth="0.22" />
      <path d="M18.62 25.05 C19.5 25.55 20.5 25.55 21.38 25.05" {...line('#2eb8a0', 0.34)} />
    </>
  )
}

/** A fish; its mouth at +x. */
function Fish({ x, y, scale, flip = false, body, fin, glow }: { x: number; y: number; scale: number; flip?: boolean; body: [number, number, number]; fin?: [number, number, number]; glow?: boolean }) {
  const [h, s, l] = body
  const f = fin ?? body
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}>
      <path d="M-7.2 0 L-12.6 -5 Q-10.8 0 -12.6 5 Z" {...wash(f[0], f[1], f[2], glow ? 0.5 : 0.35, 1)} />
      <path d="M-3.8 -5.2 L-0.8 -9.6 L2.8 -6.5 Z" {...wash(f[0], f[1], f[2], glow ? 0.5 : 0.35, 1)} />
      <path
        d="M8.6 -1.4 C7.4 -6.2 -0.6 -7.4 -5 -4.6 C-7 -3.3 -8.4 -1.4 -8.4 0 C-8.4 1.4 -7 3.3 -5 4.6 C-0.6 7.4 7.4 6.2 8.6 1.4 L5.8 0 Z"
        {...wash(h, s, l, glow ? 0.5 : 0.36, 1.1)}
      />
      <circle cx="3.6" cy="-2.4" r="1.4" fill="#fff" />
      <circle cx="3.9" cy="-2.3" r="0.7" fill={INK} />
    </g>
  )
}

function Badge({ x, y, n, colour }: { x: number; y: number; n: string; colour: string }) {
  const w = 1.6 + n.length * 1.2
  return (
    <g>
      <rect x={x - w / 2} y={y - 1.35} width={w} height="2.7" rx="1.35" fill={colour} stroke="#fff" strokeOpacity="0.55" strokeWidth="0.18" />
      <text x={x} y={y + 0.72} textAnchor="middle" fontSize="2" fontWeight="800" fill="#fff" fontFamily="Outfit, system-ui, sans-serif">
        {n}
      </text>
    </g>
  )
}

/** Under the sea: you, glowing, among fish with their numbers, smaller ones to eat and one too big. */
function Frenzy({ id }: { id: Id }) {
  return (
    <>
      <Backdrop id={id} stops={[[0, '#17404f'], [1, '#0b1d29']]} />
      <path d="M9 -1 L13.5 -1 L5 31 L1 31 Z" fill="#fff" opacity="0.04" />
      <path d="M22 -1 L25 -1 L19 31 L16 31 Z" fill="#fff" opacity="0.035" />
      <path d="M33 -1 L37 -1 L33 31 L29 31 Z" fill="#fff" opacity="0.03" />
      {[
        [30, 6, 0.5],
        [31.2, 3.6, 0.35],
        [6, 16, 0.4],
        [26, 27, 0.35],
      ].map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} {...line('#fff', 0.15, 0.4)} />
      ))}
      <Fish x={7.6} y={9.6} scale={0.3} body={[210, 70, 64]} />
      <Badge x={7.6} y={5.6} n="9" colour="#2f9e5a" />
      <Fish x={9.4} y={23.4} scale={0.34} body={[200, 68, 62]} />
      <Badge x={9.4} y={19} n="12" colour="#2f9e5a" />
      <Fish x={33.2} y={21.6} scale={0.62} flip body={[228, 58, 62]} fin={[44, 88, 58]} />
      <Badge x={33.8} y={14.6} n="31" colour="#d64545" />
      <Glow id={id} name="you" cx={19.4} cy={15.4} r={9} colour="#d46be8" strength={0.4} />
      <Fish x={19.4} y={15.4} scale={0.62} body={[292, 72, 66]} glow />
      <Badge x={19.4} y={9.2} n="23" colour="#8a3fb0" />
    </>
  )
}

/** A summer night on the lake: lanterns strung across, the treeline, and a firefly lighting up over the water. */
function Fireflies({ id }: { id: Id }) {
  const lanterns: Array<[number, number]> = [
    [4, 3.9],
    [11.6, 5.4],
    [20, 5.95],
    [28.4, 5.4],
    [36, 3.9],
  ]
  return (
    <>
      <defs>
        <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1540" />
          <stop offset="1" stopColor="#3d2c68" />
        </linearGradient>
        <linearGradient id={id('lake')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#261e4e" />
          <stop offset="1" stopColor="#120e2a" />
        </linearGradient>
      </defs>
      <rect x="-1" y="-1" width="42" height="20" fill={`url(#${id('sky')})`} />
      <Stars
        points={[
          [2.5, 9, 0.15],
          [8, 11.5, 0.13, 0.6],
          [15, 9.5, 0.16],
          [24, 11, 0.13, 0.6],
          [31, 9.5, 0.15],
          [38, 11, 0.14, 0.6],
          [17, 13.5, 0.12, 0.45],
          [35.5, 13.6, 0.12, 0.45],
        ]}
      />
      <Moon id={id} cx={33.6} cy={9} r={1.5} />
      <path d="M-1 2.4 Q20 9.5 41 2.4" {...line(hsl(40, 30, 72), 0.18, 0.4)} />
      {lanterns.map(([x, y]) => (
        <g key={x}>
          <Glow id={id} name={`l${x}`} cx={x} cy={y + 1} r={2.4} colour="#f4a64a" strength={0.55} />
          <path d={`M${x} ${y} V${y + 0.3}`} {...line(hsl(40, 30, 72), 0.12, 0.6)} />
          <rect x={x - 0.55} y={y + 0.3} width="1.1" height="1.5" rx="0.45" fill="#f6b25a" />
        </g>
      ))}
      <path
        d="M-1 19 V16.8 L0.6 15.4 L1.6 16.6 L2.8 14.6 L4 16.4 L5.2 15.2 L6.2 16.6 L7.6 13.8 L9 16.2 L10 15.4 L11.2 16.8 L12.6 14.8 L13.8 16.4 L15 15.6 L16.4 17 L17.8 15 L19 16.8 L20.4 15.8 L21.6 17 L23 14.4 L24.4 16.4 L25.4 15.6 L26.6 16.8 L28 14.6 L29.2 16.2 L30.4 15.4 L31.6 16.8 L33 14.2 L34.4 16.4 L35.6 15.6 L36.8 16.8 L38.2 14.8 L39.4 16.4 L41 15.8 V19 Z"
        fill="#150f2c"
      />
      <rect x="-1" y="18.6" width="42" height="13" fill={`url(#${id('lake')})`} />
      {[20.2, 21.8, 24, 26.8].map((y, i) => (
        <path key={y} d={`M${2 + i * 3} ${y} H${14 + i * 2} M${22 - i} ${y} H${37 - i * 2}`} {...line(hsl(262, 40, 72), 0.18, 0.14)} />
      ))}
      {lanterns.map(([x]) => (
        <path key={`r${x}`} d={`M${x} 19.6 V21.4`} {...line('#f4a64a', 0.5, 0.25)} />
      ))}
      <ellipse cx="27.2" cy="26.4" rx="1.9" ry="0.6" fill="#2f6b4a" opacity="0.85" />
      <path d="M27.2 26.4 L28.9 26.1" {...line('#150f2c', 0.25)} />
      <ellipse cx="12.4" cy="21.8" rx="1.3" ry="0.42" fill="#2f6b4a" opacity="0.8" />
      <path d="M1 31 Q1.4 25 0.8 21.4 M2.4 31 Q2.6 26 3.2 22.6 M38.6 31 Q38.4 25.6 39 22 M37.2 31 Q37 27 36.4 24" {...line('#0d0a1e', 0.35)} />
      <Glow id={id} name="pink" cx={9.6} cy={25.4} r={2.2} colour="#e86bb0" strength={0.6} />
      <circle cx="9.6" cy="25.4" r="0.4" fill="#ffd0ea" />
      <Glow id={id} name="cyan" cx={31.4} cy={21.4} r={2.2} colour="#5ee0e6" strength={0.6} />
      <circle cx="31.4" cy="21.4" r="0.4" fill="#d4fbff" />
      <ellipse cx="20" cy="26.2" rx="2.8" ry="0.62" {...line('#ffe27a', 0.2, 0.55)} />
      <ellipse cx="20" cy="26.4" rx="4.4" ry="1" {...line('#ffe27a', 0.18, 0.25)} />
      <Glow id={id} name="fly" cx={20} cy={23} r={5} colour="#ffe27a" strength={0.75} />
      <ellipse cx="19.2" cy="22.4" rx="0.9" ry="0.5" transform="rotate(-30 19.2 22.4)" fill="#fff" opacity="0.55" />
      <ellipse cx="20.8" cy="22.4" rx="0.9" ry="0.5" transform="rotate(30 20.8 22.4)" fill="#fff" opacity="0.55" />
      <ellipse cx="20" cy="23.1" rx="0.62" ry="0.95" fill="#fff4c2" />
    </>
  )
}

const SCENES: Record<string, Scene> = {
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
  bop: Bop,
  putt: Putt,
  frenzy: Frenzy,
  fireflies: Fireflies,
  acechase: AceChase,
}

/**
 * A game's picture: the whole scene for a cabinet's 4:3 screen (`card`), or
 * its middle square for an icon. A game with none yet shows `fallback`.
 */
export function GameArt({
  slug,
  shape = 'icon',
  className,
  fallback = null,
}: {
  slug: string
  shape?: 'icon' | 'card'
  className?: string
  fallback?: ReactNode
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const Scene = SCENES[slug]
  if (!Scene) return <>{fallback}</>
  const id: Id = (name) => `ga${uid}-${name}`
  return (
    <svg
      className={`game-art${className ? ` ${className}` : ''}`}
      viewBox={shape === 'card' ? '0 0 40 30' : '5 0 30 30'}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <Scene id={id} />
    </svg>
  )
}
