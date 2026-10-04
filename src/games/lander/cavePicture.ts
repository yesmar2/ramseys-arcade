import { FOOT, mulberry32, type Cave } from './sim'

/*
 * A day's cave as a picture, for its card on the home page's Dailies row: close in on its landing room, drawn
 * the way the game draws it (scene.ts), with your ship coming down onto the pad on its flame. The rock with its
 * flecks, the walls lit by depth (violet near the top of the cave, magenta deep down) with their light spilling
 * into the rock, the air with its grid every 4 m, the pillars, the gates (passed, so green), the landing pad
 * with its light rising, sparks off the pad, and the blue ship just through the room's door.
 */

/** The game's own colours (scene.ts C), here so the picture needs no engine. */
export const CAVE_COLOURS = {
  rock: '#0b0716',
  air: '#150d29',
  wallTop: [138, 92, 255],
  wallDeep: [255, 79, 216],
  pad: '#ffb347',
  passed: '#3ecf8e',
  ship: '#fff3e4',
  ghost: '#46e4ff',
  spark: '#ffc46a',
} as const

/** How much bigger than true the ships are drawn, so a card shows them. */
const SHIP_DRAWN = 2.1
/** How high over the pad your ship is, its feet to the pad, in metres. */
const HOVER = 2.6

export type CaveView = {
  w: number
  h: number
  /** Metres to the picture's pixels. */
  k: number
  /** The air, as shapes that overlap: the tunnel's last stretch, its round end, and the landing room. */
  air: string[]
  /** Where the cave's top and bottom are on the picture, for its walls' colour by depth. */
  wallTop: number
  wallBottom: number
  grid: string
  pillars: Array<{ x: number; y: number; r: number }>
  gates: string
  gateEnds: Array<[number, number]>
  pad: { x0: number; x1: number; y: number }
  ship: { x: number; y: number; deg: number; scale: number }
  ghost: { x: number; y: number; deg: number; scale: number }
  sparks: Array<[number, number, number, number]>
}

const n1 = (v: number) => String(Math.round(v * 10) / 10)

export function caveView(cave: Cave, w: number, h: number): CaveView {
  const room = cave.rooms[1]
  const pad = cave.pads[1]
  // The window: the landing room and the tunnel's way into it, a little rock under the floor.
  const tall = Math.max((room.y1 - room.y0) * 1.8, ((room.x1 - room.x0 + 8) * h) / w)
  const wide = (tall * w) / h
  const bottom = room.y0 - tall * 0.07
  const top = bottom + tall
  const left = (room.x0 + room.x1) / 2 - wide / 2
  const right = left + wide
  const k = h / tall
  const X = (x: number) => (x - left) * k
  const Y = (y: number) => (top - y) * k

  // The tunnel from the last time it was well above the window down to its end in the room.
  const N = cave.nodes
  let from = 0
  for (let i = N.length - 1; i >= 0; i--) {
    if (N[i]!.y > top + 25) {
      from = i
      break
    }
  }
  const leftWall: string[] = []
  const rightWall: string[] = []
  for (let i = from; i < N.length; i++) {
    const a = N[Math.max(0, i - 1)]!
    const b = N[Math.min(N.length - 1, i + 1)]!
    const L = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const nx = -(b.y - a.y) / L
    const ny = (b.x - a.x) / L
    const p = N[i]!
    leftWall.push(`${n1(X(p.x + nx * p.r))} ${n1(Y(p.y + ny * p.r))}`)
    rightWall.push(`${n1(X(p.x - nx * p.r))} ${n1(Y(p.y - ny * p.r))}`)
  }
  const end = N[N.length - 1]!
  const er = end.r * k
  // Kept apart, each filled on its own: as one path, shapes wound opposite ways would leave holes where they overlap.
  const air = [
    `M${leftWall.join(' L')} L${rightWall.reverse().join(' L')} Z`,
    `M${n1(X(end.x) + er)} ${n1(Y(end.y))} a${n1(er)} ${n1(er)} 0 1 0 ${n1(-2 * er)} 0 a${n1(er)} ${n1(er)} 0 1 0 ${n1(2 * er)} 0 Z`,
    `M${n1(X(room.x0))} ${n1(Y(room.y1))} H${n1(X(room.x1))} V${n1(Y(room.y0))} H${n1(X(room.x0))} Z`,
  ]

  // The grid in the air, every 4 m, fixed to the cave as the game's is.
  const step = 4
  const grid: string[] = []
  for (let x = Math.floor(left / step) * step; x <= right; x += step) grid.push(`M${n1(X(x))} 0 V${n1(h)}`)
  for (let y = Math.floor(bottom / step) * step; y <= top + step; y += step) grid.push(`M0 ${n1(Y(y))} H${n1(w)}`)

  const inView = (x: number, y: number, margin: number) => x > left - margin && x < right + margin && y > bottom - margin && y < top + margin
  const pillars = cave.pillars.filter((p) => inView(p.x, p.y, p.r)).map((p) => ({ x: X(p.x), y: Y(p.y), r: p.r * k }))
  const gatesIn = cave.gates.filter((g) => inView(g.x, g.y, 6))
  const gates = gatesIn.map((g) => `M${n1(X(g.x0))} ${n1(Y(g.y0))} L${n1(X(g.x1))} ${n1(Y(g.y1))}`).join(' ')
  const gateEnds = gatesIn.flatMap((g): Array<[number, number]> => [
    [X(g.x0), Y(g.y0)],
    [X(g.x1), Y(g.y1)],
  ])

  // Your ship over the middle of the pad, a touch tipped; the blue ship just through the room's door.
  const padMid = (pad.x0 + pad.x1) / 2
  const ship = { x: X(padMid), y: Y(pad.y + FOOT * SHIP_DRAWN + HOVER), deg: -4, scale: SHIP_DRAWN * k }
  const door = cave.gates[cave.gates.length - 1]!
  const ghost = { x: X(door.x + 1.2), y: Y(door.y + 1.6), deg: 14, scale: 1.25 * k }

  // Sparks thrown off the pad either side of the flame, the same for the same cave.
  const rnd = mulberry32(cave.n * 7919 + cave.attempt)
  const sparks: CaveView['sparks'] = []
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1
    const d = 0.5 + rnd() * 3.6
    const size = Math.max(0.1, 0.3 - d * 0.04) * k
    sparks.push([X(padMid + side * d) - size / 2, Y(pad.y + 0.25 + rnd() * 1.5 * (1 - d / 4.5)) - size / 2, size, 0.95 - d * 0.14])
  }

  return {
    w,
    h,
    k,
    air,
    wallTop: Y(cave.box[3]),
    wallBottom: Y(cave.box[2]),
    grid: grid.join(' '),
    pillars,
    gates,
    gateEnds,
    pad: { x0: X(pad.x0), x1: X(pad.x1), y: Y(pad.y) },
    ship,
    ghost,
    sparks,
  }
}
