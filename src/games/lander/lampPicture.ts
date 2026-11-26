import type { SkinArt } from '../../lib/skinArt'
import { DAILY_CAVES } from './dailyPlan'
import { AIR, BANDS, FAR, INK, layProps, LIT, mix, PALE, POD, RIM, RIM_W, ROCK, STONE, type RGB } from './lampParts'
import { lanternsOf, LIGHT_REACH, type Lantern } from './lanterns'
import { FOOT, inAir, mulberry32, plannedCave, type Cave } from './sim'

/*
 * Lander's still pictures in its new look, as SVG: a window on a day's real cave by lamplight, with the pod,
 * its moths and one of the day's lanterns. Ramsey, 2026-11-26, shown three ways to draw the day's picture put
 * into the real home row (touchdown on the pad, a lantern just lit, the whole cave from the side): "B, the
 * lantern".
 *
 * It's drawn from what the game is drawn from (lampParts.ts: the colours, the pod, what grows where;
 * lanterns.ts: where the day's lanterns hang; the cave itself), so a picture can't drift from the game. One
 * string, shown as an image: the day's picture on the home page (components/todayPictures.tsx), and the small
 * game picture, which scripts/lander-art.mjs writes to a file for components/GameArt.tsx.
 */

const css = (c: RGB) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`
const n1 = (v: number) => String(Math.round(v * 10) / 10)
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
const hash2 = (ix: number, iy: number) => (Math.imul(ix | 0, 73856093) ^ Math.imul(iy | 0, 19349663)) >>> 0
/** A skin board's unit in metres: its feet are the hull's (lamplight.ts BOARD). */
const BOARD = FOOT / 26

/** What a picture shows: its size, the place in the cave at its middle, and its scale; then who's in it. */
type View = {
  w: number
  h: number
  /** The cave's metres at the picture's middle, and pixels a metre. */
  cx: number
  cy: number
  k: number
  /** How much bigger than true the small things are drawn (what grows, lamps, moths, lanterns), so a card shows them. */
  big: number
  /** The last gate passed, −1 for none: its lamps are lit. */
  gate: number
  lanterns: (Lantern & { lit: boolean; flash?: boolean })[]
  /** The pod: where, its nose's turn from straight up (degrees, clockwise), how many times true size, its flame 0 to 1. */
  ship: { x: number; y: number; deg: number; size: number; flame: number }
  /** Moths: where each is, and how it's turned. */
  moths: [number, number, number][]
}

/** A skin board's shapes as SVG, the board laid on a ship at a place, an angle and a size. */
function shipSvg(art: SkinArt, x: number, y: number, deg: number, k: number, flame: number): string {
  const kk = k * BOARD
  let out = `<g transform="translate(${n1(x)} ${n1(y)}) rotate(${n1(deg)}) scale(${kk.toFixed(4)}) translate(-50 -60)">`
  if (flame > 0) {
    const len = 12 + 30 * flame
    out += `<path d="M42.5 70Q44 ${n1(70 + len * 0.6)} 50 ${n1(70 + len)}Q56 ${n1(70 + len * 0.6)} 57.5 70z" fill="#ff8c32"/>`
    out += `<path d="M46 70Q47 ${n1(70 + len * 0.34)} 50 ${n1(70 + len * 0.56)}Q53 ${n1(70 + len * 0.34)} 54 70z" fill="#ffecaa"/>`
  }
  for (const s of art.body) {
    out += `<path d="${s.d}"${s.fill ? ` fill="${s.fill}"` : ' fill="none"'}${s.stroke ? ` stroke="${s.stroke}" stroke-width="${s.width ?? 1}"` : ''}${s.cap ? ` stroke-linecap="${s.cap}"` : ''}${s.join ? ` stroke-linejoin="${s.join}"` : ''}/>`
  }
  return out + '</g>'
}

/** A window on a cave, by lamplight. */
function stillSvg(cave: Cave, V: View): string {
  const { w, h, k, big } = V
  const X = (x: number) => (x - V.cx) * k + w / 2
  const Y = (y: number) => h / 2 - (y - V.cy) * k
  const x0 = V.cx - w / 2 / k
  const x1 = V.cx + w / 2 / k
  const y0 = V.cy - h / 2 / k
  const y1 = V.cy + h / 2 / k
  const depth = clamp((cave.box[3] - V.cy) / (cave.box[3] - cave.box[2]), 0, 1)
  const base = mix(ROCK[0], ROCK[1], depth)
  const air = mix(AIR[0], AIR[1], depth)
  const rim = mix(RIM[0], RIM[1], depth)
  const m = 12
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice">`

  // The air's shapes: the tunnel in view, its round ends, the rooms, a shortcut's tunnel.
  const shapes: string[] = []
  const tunnel = (N: readonly { x: number; y: number; r: number }[], lo: number, hi: number) => {
    const left: string[] = []
    const right: string[] = []
    for (let i = lo; i <= hi; i++) {
      const a = N[Math.max(0, i - 1)]!
      const b = N[Math.min(N.length - 1, i + 1)]!
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
      const nx = -(b.y - a.y) / len
      const ny = (b.x - a.x) / len
      const p = N[i]!
      left.push(`${n1(X(p.x + nx * p.r))} ${n1(Y(p.y + ny * p.r))}`)
      right.push(`${n1(X(p.x - nx * p.r))} ${n1(Y(p.y - ny * p.r))}`)
    }
    shapes.push(`M${left.join('L')}L${right.reverse().join('L')}Z`)
  }
  const N = cave.nodes
  let lo = -1
  let hi = -1
  N.forEach((p, i) => {
    if (p.x > x0 - m - p.r && p.x < x1 + m + p.r && p.y > y0 - m - p.r && p.y < y1 + m + p.r) {
      if (lo < 0) lo = i
      hi = i
    }
  })
  if (lo >= 0) {
    lo = Math.max(0, lo - 2)
    hi = Math.min(N.length - 1, hi + 2)
    tunnel(N, lo, hi)
    for (const i of [0, N.length - 1]) {
      if (i < lo || i > hi) continue
      const r = N[i]!.r * k
      shapes.push(`M${n1(X(N[i]!.x) + r)} ${n1(Y(N[i]!.y))}a${n1(r)} ${n1(r)} 0 1 0 ${n1(-2 * r)} 0a${n1(r)} ${n1(r)} 0 1 0 ${n1(2 * r)} 0Z`)
    }
  }
  for (const room of cave.rooms) {
    if (room.x1 < x0 - m || room.x0 > x1 + m || room.y1 < y0 - m || room.y0 > y1 + m) continue
    shapes.push(`M${n1(X(room.x0))} ${n1(Y(room.y1))}H${n1(X(room.x1))}V${n1(Y(room.y0))}H${n1(X(room.x0))}Z`)
  }
  for (const B of cave.lab?.branches ?? []) if (B.length > 1) tunnel(B, 0, B.length - 1)
  const all = shapes.map((d) => `<path d="${d}"/>`).join('')

  out += `<defs><clipPath id="a">${all}</clipPath>`
  out += '<radialGradient id="l"><stop offset="0" stop-color="rgb(255,186,104)" stop-opacity="0.42"/><stop offset="0.45" stop-color="rgb(255,186,104)" stop-opacity="0.17"/><stop offset="1" stop-color="rgb(255,186,104)" stop-opacity="0"/></radialGradient>'
  out += '<radialGradient id="g"><stop offset="0" stop-color="rgb(255,200,110)" stop-opacity="0.7"/><stop offset="0.4" stop-color="rgb(255,190,100)" stop-opacity="0.3"/><stop offset="1" stop-color="rgb(255,180,90)" stop-opacity="0"/></radialGradient>'
  out += '<linearGradient id="w" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffb347" stop-opacity="0.3"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></linearGradient>'
  if (cave.lab?.lava.length) {
    out += '<linearGradient id="v" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="rgb(255,110,40)" stop-opacity="0.26"/><stop offset="1" stop-color="rgb(255,110,40)" stop-opacity="0"/></linearGradient>'
    out += '<linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="0.22" stop-color="#ff8a2a"/><stop offset="0.62" stop-color="#a8124f"/></linearGradient>'
  }
  out += '</defs>'

  // The rock, its layers and its pebbles, where they are in the cave.
  out += `<rect width="${w}" height="${h}" fill="${css(base)}"/>`
  const gap = 1.9
  const stride = Math.max(6, w / 28)
  for (let j = Math.floor(-y1 / gap) - 2; j <= Math.ceil(-y0 / gap) + 2; j++) {
    const r = mulberry32(hash2(j, 77))
    const tone = r() * 2 - 1
    const thick = 0.5 + r() * 1.1
    const ph = r() * 9
    const at = (x: number, extra: number) => Y(-j * gap + extra + 0.55 * Math.sin(x / 10.5 + ph) + 0.24 * Math.sin(x / 3.9 + ph * 2.3))
    const top: string[] = []
    const bottom: string[] = []
    for (let px = -4; px <= w + 4; px += stride) {
      top.push(`${n1(px)} ${n1(at(x0 + px / k, 0))}`)
      bottom.push(`${n1(px)} ${n1(at(x0 + px / k, -thick))}`)
    }
    out += `<path d="M${top.join('L')}L${bottom.reverse().join('L')}Z" fill="${css(tone > 0 ? PALE : INK)}" fill-opacity="${(tone > 0 ? 0.04 + 0.075 * tone : 0.06 + 0.13 * -tone).toFixed(3)}"/>`
  }
  const cell = 2.7
  for (let ix = Math.floor(x0 / cell) - 1; ix <= Math.ceil(x1 / cell); ix++) {
    for (let iy = Math.floor(y0 / cell) - 1; iy <= Math.ceil(y1 / cell); iy++) {
      const r = mulberry32(hash2(ix, iy))
      if (r() > 0.55) continue
      const s = (0.1 + r() * 0.26) * k
      if (s < 0.9) continue
      out += `<ellipse cx="${n1(X((ix + r()) * cell))}" cy="${n1(Y((iy + r()) * cell))}" rx="${n1(s * 1.4)}" ry="${n1(s)}" fill="${css(r() < 0.5 ? PALE : INK)}" fill-opacity="0.24"/>`
    }
  }
  // The tunnel's light in the rock, band on band, then the lit edge: each the air's outline stroked, so the air
  // laid over after leaves the half that's in the rock.
  for (const [d, t] of BANDS) out += `<g fill="none" stroke="${css(mix(base, LIT, t))}" stroke-width="${n1(2 * d * k)}" stroke-linejoin="round">${all}</g>`
  out += `<g fill="none" stroke="${css(rim)}" stroke-width="${n1(Math.max(1.6, 2 * RIM_W * k))}" stroke-linejoin="round">${all}</g>`
  out += `<g fill="${css(air)}">${all}</g>`
  // In the air: the cave's back wall far off, as columns in the dark; lava and water where the cave has them.
  let far = ''
  const column = 6.5
  for (let ix = Math.floor(x0 / column) - 1; ix <= Math.ceil(x1 / column); ix++) {
    const r = mulberry32(hash2(ix * 7 + 3, 76))
    if (r() < 0.3) continue
    const x = X((ix + r()) * column)
    const wide = (1.2 + r() * 2.4) * k
    far += `<path d="M${n1(x - wide / 2)} -2Q${n1(x - wide * 0.72)} ${n1(h / 2)} ${n1(x - wide / 2)} ${h + 2}H${n1(x + wide / 2)}Q${n1(x + wide * 0.3)} ${n1(h / 2)} ${n1(x + wide / 2)} -2Z"/>`
  }
  out += `<g clip-path="url(#a)"><g fill="${css(FAR)}" fill-opacity="0.5">${far}</g>`
  // Lava as the game has it (scene.ts drawLava): a molten layer along the floor, its heat rising into the air.
  for (const l of cave.lab?.lava ?? []) {
    const lx = n1(X(l.x0))
    const lw = n1((l.x1 - l.x0) * k)
    out += `<rect x="${lx}" y="${n1(Y(l.y1 + 2.8))}" width="${lw}" height="${n1(2.8 * k)}" fill="url(#v)"/>`
    out += `<rect x="${lx}" y="${n1(Y(l.y1))}" width="${lw}" height="${n1(1.6 * k)}" fill="url(#m)"/>`
  }
  for (const p of cave.lab?.pools ?? []) {
    const px = n1(X(p.x0))
    const pw = n1((p.x1 - p.x0) * k)
    out += `<rect x="${px}" y="${n1(Y(p.y))}" width="${pw}" height="${n1((p.y - p.y0) * k)}" fill="rgb(50,120,220)" fill-opacity="0.5"/><rect x="${px}" y="${n1(Y(p.y))}" width="${pw}" height="${n1(Math.max(1, 0.14 * k))}" fill="rgb(170,225,255)" fill-opacity="0.85"/>`
  }
  out += '</g>'

  // Pillars: rock standing in the air, lit round the edge as the walls are.
  for (const p of cave.pillars) {
    if (p.x < x0 - p.r || p.x > x1 + p.r || p.y < y0 - p.r || p.y > y1 + p.r) continue
    const rings: [number, RGB][] = [
      [p.r, rim],
      [p.r - RIM_W, mix(base, LIT, BANDS[2][1])],
      [p.r - 0.75, mix(base, LIT, BANDS[1][1])],
      [p.r - 1.5, mix(base, LIT, BANDS[0][1])],
      [p.r - 2.4, base],
    ]
    for (const [r, colour] of rings) if (r > 0) out += `<circle cx="${n1(X(p.x))}" cy="${n1(Y(p.y))}" r="${n1(r * k)}" fill="${css(colour)}"/>`
  }

  // What grows from the rock, where the game lays it.
  const line = `stroke="${css(INK)}" stroke-opacity="0.55"`
  for (const p of layProps(cave)) {
    if (p.x < x0 - 1 || p.x > x1 + 1 || p.y < y0 - 1 || p.y > y1 + 1) continue
    const r = mulberry32(hash2(Math.round(p.x * 10), Math.round(p.y * 10)))
    const s = k * p.size * big
    let shape = ''
    if (p.kind === 'stal') {
      const len = (0.4 + r() * 0.62) * s
      const wide = (0.17 + r() * 0.15) * s
      shape = `<path d="M${n1(-wide)} ${n1(0.12 * s)}Q${n1(-wide * 0.25)} ${n1(-len * 0.45)} 0 ${n1(-len)}Q${n1(wide * 0.25)} ${n1(-len * 0.45)} ${n1(wide)} ${n1(0.12 * s)}Z" fill="${css(STONE)}" ${line} stroke-width="${n1(Math.max(0.5, 0.05 * s))}"/>`
    } else if (p.kind === 'peb') {
      const wide = (0.15 + r() * 0.2) * s
      shape = `<ellipse cx="0" cy="${n1(-wide * 0.25)}" rx="${n1(wide)}" ry="${n1(wide * 0.6)}" fill="${css(STONE)}" ${line} stroke-width="${n1(Math.max(0.5, 0.05 * s))}"/>`
    } else if (p.kind === 'root') {
      for (let q = 0; q < 3; q++) {
        const len = (0.4 + r() * 0.7) * s
        const x = (q - 1) * 0.16 * s
        shape += `<path d="M${n1(x)} ${n1(0.1 * s)}C${n1(x + 0.14 * s)} ${n1(-len * 0.3)} ${n1(x - 0.16 * s)} ${n1(-len * 0.7)} ${n1(x + (r() - 0.5) * 0.2 * s)} ${n1(-len)}" fill="none" stroke="rgb(120,88,64)" stroke-opacity="0.9" stroke-width="${n1(Math.max(0.6, 0.06 * s))}" stroke-linecap="round"/>`
      }
    } else {
      const n = 2 + Math.floor(r() * 3)
      for (let q = 0; q < n; q++) {
        const lean = ((q - (n - 1) / 2) * 0.42 * 180) / Math.PI
        const len = (0.26 + r() * 0.38) * s
        const wide = (0.065 + r() * 0.045) * s
        shape += `<g transform="rotate(${n1(lean)})"><path d="M${n1(-wide)} ${n1(0.1 * s)}V${n1(-len * 0.72)}L0 ${n1(-len)}L${n1(wide)} ${n1(-len * 0.72)}V${n1(0.1 * s)}Z" fill="rgb(214,120,50)"/><path d="M${n1(-wide)} ${n1(0.1 * s)}V${n1(-len * 0.72)}L0 ${n1(-len)}V${n1(0.1 * s)}Z" fill="rgb(255,196,96)"/></g>`
      }
    }
    out += `<g transform="translate(${n1(X(p.x))} ${n1(Y(p.y))}) rotate(${n1((p.turn * 180) / Math.PI)})">${shape}</g>`
  }

  // A gate in view: a rope of lamps, lit once passed.
  cave.gates.forEach((g, i) => {
    const gx0 = X(g.x0)
    const gy0 = Y(g.y0)
    const gx1 = X(g.x1)
    const gy1 = Y(g.y1)
    if (Math.max(gx0, gx1) < -20 || Math.min(gx0, gx1) > w + 20 || Math.max(gy0, gy1) < -20 || Math.min(gy0, gy1) > h + 20) return
    const passed = V.gate >= i
    const len = Math.hypot(gx1 - gx0, gy1 - gy0)
    const mx = (gx0 + gx1) / 2
    const my = (gy0 + gy1) / 2 + 0.14 * len
    out += `<path d="M${n1(gx0)} ${n1(gy0)}Q${n1(mx)} ${n1(my)} ${n1(gx1)} ${n1(gy1)}" fill="none" stroke="rgb(206,170,120)" stroke-opacity="0.85" stroke-width="${n1(Math.max(0.8, 0.07 * k))}"/>`
    const n = Math.max(4, Math.round(len / (1.5 * k * big)))
    for (let q = 1; q < n; q++) {
      const u = q / n
      const lx = (1 - u) * (1 - u) * gx0 + 2 * (1 - u) * u * mx + u * u * gx1
      const ly = (1 - u) * (1 - u) * gy0 + 2 * (1 - u) * u * my + u * u * gy1 + 0.36 * k * big
      if (passed) out += `<circle cx="${n1(lx)}" cy="${n1(ly)}" r="${n1(1.3 * k * big)}" fill="url(#g)" opacity="0.5"/>`
      out += `<circle cx="${n1(lx)}" cy="${n1(ly)}" r="${n1(0.24 * k * big)}" fill="${passed ? '#ffe2a0' : 'rgb(64,50,56)'}" stroke="${passed ? '#ffb347' : 'rgb(214,170,110)'}" stroke-width="${n1(Math.max(0.5, 0.06 * k * big))}"/>`
    }
  })

  // A pad in view: planks on trestles, lights along them, light rising off the one to land on.
  for (const pad of cave.pads) {
    const px0 = X(pad.x0)
    const px1 = X(pad.x1)
    const py = Y(pad.y)
    if (px1 < -20 || px0 > w + 20 || py < -20 || py > h + 20) continue
    const ph = Math.max(2, 0.3 * k)
    if (pad.end) out += `<rect x="${n1(px0)}" y="${n1(py - 3.4 * k)}" width="${n1(px1 - px0)}" height="${n1(3.4 * k)}" fill="url(#w)"/>`
    for (const u of [0.1, 0.5, 0.9]) out += `<rect x="${n1(px0 + (px1 - px0) * u - 0.14 * k)}" y="${n1(py - ph * 0.2)}" width="${n1(0.28 * k)}" height="${n1(0.7 * k)}" fill="#7a5230"/>`
    out += `<rect x="${n1(px0 - 0.15 * k)}" y="${n1(py - ph)}" width="${n1(px1 - px0 + 0.3 * k)}" height="${n1(ph)}" fill="#b9814a" stroke="#2c1a14" stroke-width="${n1(Math.max(0.5, 0.05 * k))}"/>`
  }

  // The day's lanterns in view: each on its chain, lit with its light round it, or dark in its gold ring.
  for (const l of V.lanterns) {
    const lx = X(l.x)
    const ly = Y(l.y)
    if (lx < -40 || lx > w + 40 || ly < -40 || ly > h + 40) continue
    const s = k * 1.5 * big
    out += `<path d="M${n1(X(l.ax))} ${n1(Y(l.ay))}L${n1(lx)} ${n1(ly - 0.5 * s)}" stroke="rgb(206,170,120)" stroke-opacity="0.8" stroke-width="${n1(Math.max(0.7, 0.06 * k))}" stroke-dasharray="${n1(0.16 * k)} ${n1(0.11 * k)}"/>`
    if (l.lit) out += `<circle cx="${n1(lx)}" cy="${n1(ly)}" r="${n1(5.2 * k)}" fill="url(#l)"/><circle cx="${n1(lx)}" cy="${n1(ly)}" r="${n1(2.2 * k * big)}" fill="url(#g)"/>`
    else out += `<circle cx="${n1(lx)}" cy="${n1(ly)}" r="${n1(LIGHT_REACH * k)}" fill="none" stroke="rgb(255,209,102)" stroke-opacity="0.9" stroke-width="${n1(Math.max(0.9, 0.08 * k))}" stroke-dasharray="${n1(0.42 * k)} ${n1(0.3 * k)}"/>`
    if (l.flash) out += `<circle cx="${n1(lx)}" cy="${n1(ly)}" r="${n1(LIGHT_REACH * k * 1.25)}" fill="none" stroke="rgb(255,224,150)" stroke-opacity="0.75" stroke-width="${n1(Math.max(1, 0.1 * k))}"/>`
    out += `<path d="M${n1(lx - 0.3 * s)} ${n1(ly - 0.3 * s)}L${n1(lx)} ${n1(ly - 0.52 * s)}L${n1(lx + 0.3 * s)} ${n1(ly - 0.3 * s)}Z" fill="rgb(112,78,46)"/>`
    out += `<rect x="${n1(lx - 0.24 * s)}" y="${n1(ly - 0.3 * s)}" width="${n1(0.48 * s)}" height="${n1(0.6 * s)}" rx="${n1(0.1 * s)}" fill="${l.lit ? 'rgb(255,214,130)' : 'rgb(70,58,62)'}" stroke="rgb(112,78,46)" stroke-width="${n1(Math.max(0.5, 0.06 * s))}"/>`
    if (l.lit) out += `<ellipse cx="${n1(lx)}" cy="${n1(ly + 0.02 * s)}" rx="${n1(0.09 * s)}" ry="${n1(0.16 * s)}" fill="#fffbe8"/>`
    out += `<rect x="${n1(lx - 0.3 * s)}" y="${n1(ly + 0.28 * s)}" width="${n1(0.6 * s)}" height="${n1(0.1 * s)}" fill="rgb(112,78,46)"/>`
  }

  // The pod's lamp on the cave, its moths, and the pod.
  const ship = V.ship
  out += `<circle cx="${n1(X(ship.x))}" cy="${n1(Y(ship.y))}" r="${n1(12 * k)}" fill="url(#l)"/>`
  for (const [mx, my, turn] of V.moths) {
    const s = 0.34 * k * big * 1.25
    const wing = (side: number) =>
      `<ellipse cx="${n1(side * s * 0.7)}" cy="${n1(-s * 0.2)}" rx="${n1(s * 0.75)}" ry="${n1(s * 0.6)}" transform="rotate(${-28 * side} ${n1(side * s * 0.7)} ${n1(-s * 0.2)})" fill="rgb(255,236,190)"/>`
    out += `<circle cx="${n1(X(mx))}" cy="${n1(Y(my))}" r="${n1(1.15 * k * big)}" fill="url(#g)" opacity="0.75"/>`
    out += `<g transform="translate(${n1(X(mx))} ${n1(Y(my))}) rotate(${turn})">${wing(-1)}${wing(1)}<ellipse cx="0" cy="0" rx="${n1(s * 0.2)}" ry="${n1(s * 0.5)}" fill="#fffdf2"/></g>`
  }
  out += shipSvg(POD, X(ship.x), Y(ship.y), ship.deg, k * ship.size, ship.flame)
  return out + '</svg>'
}

/** How much bigger than true the pod is drawn, as the ship in the day's picture always has been, so a card shows it. */
const SHIP_DRAWN = 2.1

/** How far from the lantern the pod's middle is put (m): clear of the lantern's ring as big as the pod is drawn, and near enough to share a small picture with it. */
const POD_OFF = 5.8
/** The air the pod wants all round its middle (m): about what it covers, as big as it's drawn. */
const POD_ROOM = 2.4

/**
 * One of a cave's lanterns, just lit: the first that hangs from a roof (any, in a cave with none), its light
 * on the rock, its ring going out from it; the pod by it, nose toward it, on its flame; and its moths strung
 * out behind. `span`: how many metres of cave the picture is wide.
 *
 * The pod is put on the cave's middle line, a little way along from the lantern, so there's air round it in
 * any cave: the mock-ups put it at one fixed place below and left of the lantern, which in 35 of the 180
 * planned caves pushed it up against the rock, and in one, into it. It's the place past the lantern for
 * choice (it has just flown through the ring), below the lantern rather than up under its chain, out of water
 * and off lava; and its moths follow it down the same line.
 */
function byLantern(cave: Cave, w: number, h: number, span: number): string {
  const lanterns = lanternsOf(cave)
  const at = Math.max(0, lanterns.findIndex((l) => l.ax === l.x))
  const N = cave.nodes
  // A cave with nowhere to hang one (no planned cave is): a place a third of the way down stands in for it.
  const third = N[Math.floor(N.length / 3)]!
  const L = lanterns[at] ?? { x: third.x, y: third.y + 2.4 }
  let near = 0
  N.forEach((p, i) => {
    if ((p.x - L.x) ** 2 + (p.y - L.y) ** 2 < (N[near]!.x - L.x) ** 2 + (N[near]!.y - L.y) ** 2) near = i
  })
  const roomAt = (i: number) => {
    for (let q = 0; q < 12; q++) {
      const turn = (q / 12) * Math.PI * 2
      if (!inAir(cave, N[i]!.x + Math.cos(turn) * POD_ROOM, N[i]!.y + Math.sin(turn) * POD_ROOM, i)) return false
    }
    return true
  }
  const wet = (x: number, y: number) =>
    (cave.lab?.pools ?? []).some((p) => x > p.x0 - 1 && x < p.x1 + 1 && y > p.y0 - 1 && y < p.y + 2) ||
    (cave.lab?.lava ?? []).some((l) => x > l.x0 - 1 && x < l.x1 + 1 && y > l.y0 - 1 && y < l.y1 + 4)
  let pod = near
  let best = Infinity
  for (let i = 0; i < N.length; i++) {
    const p = N[i]!
    if (Math.abs(p.s - N[near]!.s) > 14) continue
    const off = Math.hypot(p.x - L.x, p.y - L.y)
    if (off < POD_OFF - 0.9) continue
    let score = Math.abs(off - POD_OFF)
    if (i < near) score += 0.6
    if (p.y > L.y - 1) score += 3
    if (!roomAt(i)) score += 2.5
    if (wet(p.x, p.y)) score += 2.5
    if (score < best) {
      best = score
      pod = i
    }
  }
  const P = N[pod]!
  // Its nose toward the lantern, as far as a lander leans.
  const lean = clamp(Math.atan2(L.x - P.x, L.y - P.y), -0.9, 0.9)
  // Its moths behind it: down the middle line away from the lantern, weaving a little, as far as the cave goes.
  const away = pod >= near ? 1 : -1
  const moths: [number, number, number][] = []
  let j = pod
  for (let m = 0; m < 4; m++) {
    const back = 3.6 + m * 1.8
    while (j + away >= 0 && j + away < N.length && Math.abs(N[j]!.s - P.s) < back) j += away
    if (Math.abs(N[j]!.s - P.s) < back - 0.8) break
    const q = N[j]!
    const a = N[Math.max(0, j - 1)]!
    const b = N[Math.min(N.length - 1, j + 1)]!
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const side = Math.sin(m * 1.9 + 0.6) * clamp(q.r - 1.6, 0, 0.9)
    const mx = q.x - ((b.y - a.y) / len) * side
    const my = q.y + ((b.x - a.x) / len) * side
    if (inAir(cave, mx, my, j) && !wet(mx, my)) moths.push([mx, my, m % 2 ? 20 : -15])
  }
  return stillSvg(cave, {
    w,
    h,
    k: w / span,
    // Between the two, nearer the pod: the lantern sits toward a corner, its chain running up out of the picture.
    cx: L.x + (P.x - L.x) * 0.55,
    cy: L.y + (P.y - L.y) * 0.6,
    big: 1.7,
    // The gates behind the pod are lit.
    gate: cave.gates.filter((g) => g.i < pod).length - 1,
    lanterns: lanterns.map((l, i) => ({ ...l, lit: i <= at, flash: i === at })),
    ship: { x: P.x, y: P.y, deg: (lean * 180) / Math.PI, size: SHIP_DRAWN, flame: 0.9 },
    moths,
  })
}

/** The day's picture, for its card on the home page: the day's own cave, at one of its own lanterns. */
export function dayPictureSvg(cave: Cave, w: number, h: number): string {
  return byLantern(cave, w, h, 27)
}

/**
 * The small game picture (components/GameArt.tsx), close on the pod and a lit lantern: in cave #1, so it's the
 * same picture whatever the day. It's about 30 pixels across in the Dailies bar, so it shows less cave.
 */
export function gameArtSvg(): string {
  const first = DAILY_CAVES[0]!
  return byLantern(plannedCave(1, first.a, first.t), 240, 180, 19)
}
