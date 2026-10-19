import { mixColor } from '../../lib/color'
import { mulberry32, pegAt, TW, type Tower } from './sim'

/*
 * A day's tower as a picture, for its cards (the home row, Today's Tower, past days, the tomorrow tease, the day's
 * share card): a stretch of its middle, drawn the way the game draws it at dusk (scene.ts): the sky with its
 * stars and moon, far towers, the shaft's walls in the day's colour with their lit edge, seam and blips, the
 * pegs as they are at the go, a bramble bar or a bug or two if the stretch has them, and Blip in the air between
 * two pegs with his dotted trail, the blue blip hanging on the peg below. One SVG string, so the share-card
 * script (scripts/today-cards.mjs) draws exactly what the site does, with no engine and no browser.
 */

/** The game's own colours at dusk (scene.ts paletteFor). */
export function towerColours(hue: string) {
  const ground = '#0e1230'
  return {
    skyTop: '#0a0e29',
    skyLow: '#47306b',
    moon: '#f3ecd2',
    far: mixColor(hue, '#1b1745', 0.78),
    mid: mixColor(hue, '#141238', 0.62),
    wall: mixColor(hue, ground, 0.45),
    wallDeep: mixColor(hue, ground, 0.68),
    edge: mixColor(hue, '#ffffff', 0.5),
    seam: mixColor(hue, ground, 0.62),
    blip: mixColor(hue, '#ffffff', 0.3),
    peg: '#dfe6f2',
    pegLine: '#8794ad',
    thorn: '#e0637a',
    bug: '#f07a8a',
    blue: '#4cb8f0',
  }
}

const n1 = (v: number) => String(Math.round(v * 10) / 10)

/** The tower `w` by `h`, as an SVG string. */
export function towerSvg(tower: Tower, w: number, h: number): string {
  const C = towerColours(tower.hue)
  const r = mulberry32(tower.n * 13 + 5)
  // The stretch: about 560 units of the middle, the shaft filling most of the picture's width.
  const k = Math.min((w * 0.86) / TW, h / 420)
  const mid = tower.height * 0.48
  const ox = (w - TW * k) / 2
  const X = (x: number) => ox + x * k
  const Y = (y: number) => h * 0.5 - (y - mid) * k
  const inView = (y: number) => Y(y) > -30 && Y(y) < h + 30
  const out: string[] = []
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">`)
  out.push(`<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.skyTop}"/><stop offset="1" stop-color="${C.skyLow}"/></linearGradient></defs>`)
  out.push(`<rect width="${w}" height="${h}" fill="url(#sky)"/>`)
  for (let i = 0; i < 40; i++) out.push(`<circle cx="${n1(r() * w)}" cy="${n1(r() * h * 0.8)}" r="${n1(0.6 + r() * 1.1)}" fill="#fff" opacity="${n1(0.3 + r() * 0.5)}"/>`)
  out.push(`<circle cx="${n1(w * 0.86)}" cy="${n1(h * 0.16)}" r="${n1(h * 0.06)}" fill="${C.moon}"/>`)
  for (const [colour, rate] of [[C.far, 0.5], [C.mid, 0.3]] as const) {
    for (let i = 0; i < 6; i++) {
      const tw = w * (0.06 + r() * 0.06)
      const tx = r() * w
      const top = h * (rate + r() * 0.3)
      out.push(`<path d="M${n1(tx)} ${h} V${n1(top)} L${n1(tx + tw / 2)} ${n1(top - tw * 0.7)} L${n1(tx + tw)} ${n1(top)} V${h} Z" fill="${colour}"/>`)
    }
  }
  // The shaft, its walls.
  const wall = 22 * k
  out.push(`<rect x="${n1(X(0))}" y="0" width="${n1(TW * k)}" height="${h}" fill="#0e1230" opacity="0.42"/>`)
  for (const side of [0, 1]) {
    const inner = side ? X(TW) : X(0)
    const left = side ? inner : inner - wall
    out.push(`<rect x="${n1(left)}" y="0" width="${n1(wall)}" height="${h}" fill="${C.wall}"/>`)
    out.push(`<rect x="${n1(side ? inner + wall * 0.62 : left)}" y="0" width="${n1(wall * 0.38)}" height="${h}" fill="${C.wallDeep}"/>`)
    out.push(`<rect x="${n1(side ? inner : inner - 3 * k)}" y="0" width="${n1(3 * k)}" height="${h}" fill="${C.edge}"/>`)
    const seam = side ? inner + wall * 0.36 : inner - wall * 0.36
    out.push(`<rect x="${n1(seam - 1.5 * k)}" y="0" width="${n1(3 * k)}" height="${h}" fill="${C.seam}"/>`)
    for (let y = side ? 23 * k : 0; y < h; y += 46 * k) out.push(`<circle cx="${n1(seam)}" cy="${n1(y)}" r="${n1(2.8 * k)}" fill="${C.blip}"/>`)
  }
  for (const br of tower.brambles) {
    if (!inView(br.y)) continue
    for (const [a, b] of [[0, br.gx0], [br.gx1, TW]] as const) {
      if (b - a > 2) out.push(`<rect x="${n1(X(a))}" y="${n1(Y(br.y) - 4 * k)}" width="${n1((b - a) * k)}" height="${n1(8 * k)}" rx="${n1(3 * k)}" fill="${C.thorn}"/>`)
    }
  }
  for (const bug of tower.bugs) {
    if (inView(bug.y)) out.push(`<circle cx="${n1(X((bug.x0 + bug.x1) / 2))}" cy="${n1(Y(bug.y))}" r="${n1(11 * k)}" fill="${C.bug}"/>`)
  }
  // The pegs at the go, and which two Blip flies between.
  let below = -1
  tower.pegs.forEach((pg, i) => {
    const at = pegAt(pg, 0)
    if (!inView(at.y)) return
    if (below < 0 && at.y > mid - 140) below = i
    const fill = pg.kind === 'clay' ? '#d98a5f' : pg.kind === 'boost' || pg.kind === 'top' ? '#f5b942' : C.peg
    out.push(`<circle cx="${n1(X(at.x))}" cy="${n1(Y(at.y))}" r="${n1(10.6 * k)}" fill="${C.pegLine}"/>`)
    out.push(`<circle cx="${n1(X(at.x))}" cy="${n1(Y(at.y))}" r="${n1(9 * k)}" fill="${fill}"/>`)
  })
  const from = pegAt(tower.pegs[Math.max(0, below)]!, 0)
  const to = pegAt(tower.pegs[Math.min(tower.pegs.length - 1, Math.max(0, below) + 1)]!, 0)
  // The blue blip on the peg below; Blip most of the way up an arc to the next one, his trail behind.
  out.push(blipSvg(X(from.x), Y(from.y - 17), k, C.blue, 0.65, true))
  const arc = (f: number) => ({ x: from.x + (to.x - from.x) * f, y: from.y + (to.y - from.y) * f + Math.sin(f * Math.PI) * 70 })
  for (let i = 0; i < 9; i++) {
    const p = arc(0.1 + i * 0.07)
    out.push(`<circle cx="${n1(X(p.x))}" cy="${n1(Y(p.y))}" r="${n1(2.4 * k)}" fill="#9ff7e2" opacity="${n1(0.2 + i * 0.07)}"/>`)
  }
  const at = arc(0.78)
  out.push(blipSvg(X(at.x), Y(at.y), k, '#34c6a8', 1, false))
  out.push('</svg>')
  return out.join('')
}

/** Blip, as the game draws him: hanging (arms up) or flying (arms out). */
function blipSvg(x: number, y: number, k: number, body: string, opacity: number, hanging: boolean): string {
  const s = k * 1.15
  const arms = hanging ? 'M-5 -6 L-2 -16 M5 -6 L2 -16' : 'M-7 -3 L-12 -9 M7 -3 L12 -9'
  return (
    `<g transform="translate(${n1(x)} ${n1(y)}) scale(${n1(s)})" opacity="${opacity}">` +
    `<path d="${arms}" stroke="#167a69" stroke-width="2.6" stroke-linecap="round" fill="none"/>` +
    `<ellipse cx="-3.6" cy="9.4" rx="3.2" ry="1.9" fill="#167a69"/><ellipse cx="3.6" cy="9.4" rx="3.2" ry="1.9" fill="#167a69"/>` +
    `<circle r="10.6" fill="hsla(164, 80%, 76%, 0.9)"/><circle r="9.6" fill="${body}"/>` +
    `<ellipse cx="-3.4" cy="-5.2" rx="3.2" ry="1.6" fill="#fff" opacity="0.35" transform="rotate(-24 -3.4 -5.2)"/>` +
    `<ellipse cx="-2.6" cy="0" rx="1.35" ry="2.2" fill="#0f2f2a"/><ellipse cx="2.6" cy="0" rx="1.35" ry="2.2" fill="#0f2f2a"/>` +
    `<ellipse cx="-5.2" cy="3.2" rx="1.5" ry="0.9" fill="#ff8fb3" opacity="0.75"/><ellipse cx="5.2" cy="3.2" rx="1.5" ry="0.9" fill="#ff8fb3" opacity="0.75"/>` +
    (hanging ? '' : `<circle cy="-17" r="5" fill="#9ff7e2" opacity="0.5"/><circle cy="-17" r="1.8" fill="#f2fffb"/>`) +
    `</g>`
  )
}
