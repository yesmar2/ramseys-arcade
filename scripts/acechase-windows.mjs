// Ace Chase: every dial setting that stops the ball on the bull, grouped into windows.
//
// A coarse pass over the powers and angles finds where the bullseyes are; then every setting the dials
// can make (halves of power, tenths of a degree) is tried round each one, flooding out until the window
// closes. Settings that touch, a half of power or a tenth of a degree apart, are one window: a window is
// what a player can find by following the misses, and its size is how hard that is.

/**
 * @param {(hole: unknown, power: number, angle: number) => { done: string }} simulate
 * @param {unknown} hole
 * @param {{ power?: [number, number], angles?: [number, number], coarse?: { power: number, angle: number } }} [opts]
 */
export function windowsFor(simulate, hole, opts = {}) {
  const POWER = opts.power ?? [30, 100]
  const angles = opts.angles ?? [-10, 10]
  const COARSE = opts.coarse ?? { power: 1, angle: 0.3 }
  const FINE = { power: 0.5, angle: 0.1 }
  const bull = new Map()
  const key = (p, a) => `${p}|${a}`
  // Angles as whole tenths of a degree, so the grid never drifts.
  const tryShot = (p, a) => {
    const k = key(p, a)
    if (!bull.has(k)) bull.set(k, simulate(hole, p, a / 10).done === 'bull')
    return bull.get(k)
  }
  const A0 = Math.round(angles[0] * 10)
  const A1 = Math.round(angles[1] * 10)
  const step = Math.max(1, Math.round(COARSE.angle * 10))
  const hits = []
  for (let p = POWER[0]; p <= POWER[1]; p += COARSE.power)
    for (let a = A0; a <= A1; a += step) if (tryShot(p, a)) hits.push([p, a])
  const queue = []
  for (const [p, a] of hits)
    for (let dp = -2; dp <= 2; dp++) for (let da = -Math.ceil(step / 2) - 2; da <= Math.ceil(step / 2) + 2; da++) queue.push([p + dp * FINE.power, a + da])
  const seen = new Set()
  const cells = []
  while (queue.length) {
    const [p, a] = queue.pop()
    if (p < POWER[0] || p > POWER[1] || a < A0 || a > A1) continue
    const k = key(p, a)
    if (seen.has(k)) continue
    seen.add(k)
    if (tryShot(p, a)) {
      cells.push([p, a])
      queue.push([p + FINE.power, a], [p - FINE.power, a], [p, a + 1], [p, a - 1])
    }
  }
  const at = new Set(cells.map(([p, a]) => key(p, a)))
  const done = new Set()
  const windows = []
  for (const [p0, a0] of cells) {
    const k0 = key(p0, a0)
    if (done.has(k0)) continue
    done.add(k0)
    const stack = [[p0, a0]]
    const w = { cells: 0, p0: Infinity, p1: -Infinity, a0: Infinity, a1: -Infinity, sample: [p0, a0 / 10] }
    while (stack.length) {
      const [p, a] = stack.pop()
      w.cells++
      w.p0 = Math.min(w.p0, p)
      w.p1 = Math.max(w.p1, p)
      w.a0 = Math.min(w.a0, a / 10)
      w.a1 = Math.max(w.a1, a / 10)
      for (const [q, b] of [
        [p + FINE.power, a],
        [p - FINE.power, a],
        [p, a + 1],
        [p, a - 1],
      ]) {
        const kk = key(q, b)
        if (at.has(kk) && !done.has(kk)) {
          done.add(kk)
          stack.push([q, b])
        }
      }
    }
    windows.push(w)
  }
  windows.sort((x, y) => y.cells - x.cells)
  return { cells: cells.length, windows: windows.slice(0, 3), sims: bull.size }
}
