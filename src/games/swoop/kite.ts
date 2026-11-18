/*
 * The kite that waits on each of the day's three golden hills, in Swoop's new look (golden.ts, vista.ts):
 * pegged to the slope and flying over it, where it's seen from two hills off. Caught, it comes off its peg and
 * flies behind your bird on its string, so how many you have is plain at a glance, on a phone too.
 *
 * It was a golden bird, sitting on its slope, and Ramsey, 2026-11-18: "maybe golden bird is the wrong thing to
 * catch. it's weird that it's just sitting there, what else could we use for that". Shown a kite, a golden
 * feather stood in the turf and a fledgling in its nest, each to fly at, he said the same day: "ok, i like the
 * kites".
 *
 * It's painted in a frame of its own, in metres, y down as a canvas has it; the scene places, leans and sizes it.
 */

/** The kite's two golds, and the deep amber line round it, in place of the site's dark one, as the birds have. */
const GOLD_LIT = '#ffe28c'
const GOLD_DEEP = '#eda522'
const AMBER = '#8a5514'

/** The kite's bows, down its tail: the flock's colours. */
const BOWS = ['#e85d9a', '#3ecf8e', '#8a6ad4'] as const

/**
 * A kite, its middle at the origin, standing upright (the caller leans it into the wind): a diamond in two golds,
 * and a tail of three bows that ripples with `time`, streaming off to the left.
 */
export function paintKite(g: CanvasRenderingContext2D, time: number, seed: number, line: number) {
  // The tail first, under the kite: a ribbon from its foot, and the bows tied along it.
  const at = (j: number): [number, number] => [-0.42 * j + Math.sin(time * 5 + j * 1.3 + seed) * 0.16 * j * 0.5, 1.3 + 0.46 * j + Math.cos(time * 4 + j + seed) * 0.08 * j]
  g.strokeStyle = AMBER
  g.lineWidth = Math.max(line, 0.07)
  g.lineJoin = 'round'
  g.beginPath()
  g.moveTo(0, 1.3)
  for (let j = 1; j <= 6; j++) g.lineTo(...at(j))
  g.stroke()
  for (let b = 0; b < BOWS.length; b++) {
    const [x, y] = at(1.6 + b * 1.7)
    g.fillStyle = BOWS[b]!
    g.beginPath()
    g.moveTo(x - 0.3, y - 0.17)
    g.lineTo(x, y)
    g.lineTo(x - 0.3, y + 0.17)
    g.closePath()
    g.moveTo(x + 0.3, y - 0.17)
    g.lineTo(x, y)
    g.lineTo(x + 0.3, y + 0.17)
    g.closePath()
    g.fill()
  }
  // The diamond: its windward half lighter.
  g.fillStyle = GOLD_LIT
  g.beginPath()
  g.moveTo(0, -1.5)
  g.lineTo(-1, -0.35)
  g.lineTo(0, 1.3)
  g.closePath()
  g.fill()
  g.fillStyle = GOLD_DEEP
  g.beginPath()
  g.moveTo(0, -1.5)
  g.lineTo(1, -0.35)
  g.lineTo(0, 1.3)
  g.closePath()
  g.fill()
  // Its spars, and its edge.
  g.strokeStyle = AMBER
  g.lineWidth = Math.max(line * 0.8, 0.05)
  g.beginPath()
  g.moveTo(0, -1.5)
  g.lineTo(0, 1.3)
  g.moveTo(-1, -0.35)
  g.lineTo(1, -0.35)
  g.stroke()
  g.lineWidth = Math.max(line, 0.07)
  g.beginPath()
  g.moveTo(0, -1.5)
  g.lineTo(1, -0.35)
  g.lineTo(0, 1.3)
  g.lineTo(-1, -0.35)
  g.closePath()
  g.stroke()
}
