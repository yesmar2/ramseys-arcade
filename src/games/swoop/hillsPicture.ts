import { mixColor } from '../../lib/color'
import { SWIFT_LIFT } from './birdShape'
import { heightAt, mulberry32, slopeAt, type Hills } from './sim'

/*
 * A day's hills as a picture, for their card on the home page's Dailies row: close in on the day's biggest
 * top, drawn the way the game draws its hills at dusk (scene.ts): the sky with its stars and moon, far hills,
 * the near ones in the day's colour with their turf, seams and row of blips, and your bird just off the top,
 * flying, its dotted trail behind it, with the blue bird coming up the slope after it.
 */

/** The game's own colours at dusk (scene.ts paletteFor), here so the picture needs no engine. */
export function hillsColours(hue: string) {
  const ground = '#0e1230'
  return {
    skyTop: '#0a0e29',
    skyLow: '#47306b',
    moon: '#f3ecd2',
    far: mixColor(hue, '#1b1745', 0.78),
    mid: mixColor(hue, '#141238', 0.62),
    body: mixColor(hue, ground, 0.45),
    deep: mixColor(hue, ground, 0.72),
    turf: mixColor(hue, '#ffffff', 0.12),
    seam: mixColor(hue, ground, 0.62),
    blip: mixColor(hue, '#ffffff', 0.3),
    edge: mixColor(hue, '#ffffff', 0.5),
    bird: '#e8564f',
    birdLine: mixColor('#e8564f', '#ffffff', 0.4),
    blue: '#4cb8f0',
  }
}

export type HillsView = {
  w: number
  h: number
  /** Metres to the picture's pixels. */
  k: number
  /** The near hills, filled to the bottom; their surface alone, for the lit edge and the turf. */
  ground: string
  surface: string
  /** The far hills' two rows. */
  far: string
  mid: string
  seams: string[]
  blips: Array<[number, number]>
  stars: Array<[number, number, number, number]>
  /** Your bird, flying off the top, and its trail; the blue bird on the slope behind. */
  bird: { x: number; y: number; deg: number; size: number }
  trail: Array<[number, number]>
  blue: { x: number; y: number; deg: number; size: number }
}

const n1 = (v: number) => String(Math.round(v * 10) / 10)

export function hillsView(hills: Hills, w: number, h: number): HillsView {
  // The day's biggest top: the one highest over the bottom after it, in the first nine tenths of the way.
  let top = 1
  let best = -Infinity
  for (let i = 2; i < hills.xs.length - 2; i++) {
    const y = hills.ys[i]!
    if (hills.xs[i]! > hills.finish * 0.9) break
    if (y > hills.ys[i - 1]! && y > hills.ys[i + 1]! && y - hills.ys[i + 1]! > best) {
      best = y - hills.ys[i + 1]!
      top = i
    }
  }
  const tx = hills.xs[top]!
  const ty = hills.ys[top]!
  // The window: 34 m across, the top a little left of the middle, the ground in the lower half.
  const wide = 34
  const k = w / wide
  const left = tx - wide * 0.34
  const sky = ty + (h / k) * 0.44
  const X = (x: number) => (x - left) * k
  const Y = (y: number) => (sky - y) * k
  const line = (dy: number) => {
    const pts: string[] = []
    for (let px = -4; px <= w + 4; px += 3) {
      const x = left + px / k
      pts.push(`${n1(px)} ${n1(Y(heightAt(hills, x) - dy))}`)
    }
    return `M${pts.join(' L')}`
  }
  const surface = line(0)
  const ground = `${surface} L${n1(w + 4)} ${n1(h + 4)} L-4 ${n1(h + 4)} Z`
  const seams = [4.2, 13.5].map((d) => line(d))
  const blips: Array<[number, number]> = []
  for (let x = Math.ceil(left / 3.2) * 3.2; x <= left + wide; x += 3.2) blips.push([X(x), Y(heightAt(hills, x) - 8.6)])
  // Far hills, rolling, behind.
  const rolling = (scale: number, lift: number, amp: number) => {
    const pts: string[] = []
    for (let px = 0; px <= w + 8; px += 8) {
      const u = (px + tx * 3) / scale
      const v = Math.sin(u) * 0.5 + Math.sin(u * 0.43 + 1.7) * 0.35 + Math.sin(u * 2.1 + 0.4) * 0.12
      pts.push(`${n1(px)} ${n1(h * lift - v * h * amp)}`)
    }
    return `M0 ${n1(h)} L${pts.join(' L')} L${n1(w)} ${n1(h)} Z`
  }
  const rnd = mulberry32(hills.n * 7919 + hills.attempt)
  const stars: HillsView['stars'] = []
  for (let i = 0; i < 40; i++) stars.push([rnd() * w, rnd() * h * 0.5, 0.5 + rnd() * 1.1, 0.25 + rnd() * 0.6])
  // Your bird off the top at about 22 m/s, 0.45 s into its flight, and the way it came; drawn twice its size,
  // so a card shows it.
  const s = 22
  const d = slopeAt(hills, tx + 0.5)
  const n = Math.sqrt(1 + d * d)
  const vx = s / n
  const vy0 = (s * d) / n + 4
  const at = (t: number): [number, number] => [tx + vx * t, ty + vy0 * t - 10 * t * t]
  const [bx, by] = at(0.45)
  const size = Math.max(14, 2.4 * k)
  const trail: Array<[number, number]> = []
  for (let t = 0.04; t < 0.36; t += 0.045) {
    const [x, y] = at(t)
    trail.push([X(x), Y(y) - size * SWIFT_LIFT])
  }
  const vyNow = vy0 - 20 * 0.45
  // The blue bird on the slope up to the top, behind.
  const blueX = tx - 7.5
  const bd = slopeAt(hills, blueX)
  return {
    w,
    h,
    k,
    ground,
    surface,
    far: rolling(150, 0.5, 0.07),
    mid: rolling(95, 0.62, 0.05),
    seams,
    blips,
    stars,
    bird: { x: X(bx), y: Y(by), deg: (-Math.atan2(vyNow, vx) * 180) / Math.PI, size },
    trail,
    blue: { x: X(blueX), y: Y(heightAt(hills, blueX)), deg: (-Math.atan(bd) * 180) / Math.PI, size: size * 0.85 },
  }
}
