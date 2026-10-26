import { useId } from 'react'
import { hashString, mulberry32 } from '../lib/seededRandom'

/*
 * A player card's backdrop when they haven't picked a background: their own constellation, on a night sky in
 * their avatar's colour (--hero-accent). Its shape comes from their tag, so it's the same every visit and no two
 * players share one. Everyone starts with three stars and gets one more for each trophy; while there are fewer than
 * five, the next two are drawn dotted, as stars still to come. Ramsey picked D of the "Card backgrounds when none
 * is picked" canvas (2026-10-26) in place of their best game's picture.
 */

/** Stars every player has before their first trophy. */
export const STARTER_STARS = 3
/** The most a constellation draws; the stamp still counts them all. */
const MOST_DRAWN = 12
/** The arc the constellation follows over the avatar: from a little below its left, over the top, to below its right. */
const ARC_FROM = Math.PI - 0.45
const ARC_SPAN = Math.PI + 0.9

type Star = { x: number; y: number; r: number }

/*
 * Where the card's avatar sits (playerCard.css .fac__avatar): centred, 31% of the way down, its circle 40% of the
 * card's width across at every card size. The constellation keeps CARD_CLEAR (in card widths) from its middle, stars
 * and lines alike: its circle, its drop shadow and a star's glow. Before, a star could land at 57% of the arc's
 * reach, and the stars eased down from the top landed on the avatar's edge, so a line crossed it on nearly every
 * card (Ramsey, 2026-10-26: "sometimes the lines go behind or at least too close to the avatar").
 */
const CARD_AVATAR_Y = 0.31
const CARD_CLEAR = 0.29
/**
 * The place chip and the flip button sit along the card's top (.fac__top: 0.75rem in, up to 2rem tall). Above
 * CARD_TOP_BAND (in card heights) only the middle, CARD_TOP_GAP card widths either side of centre, stays open.
 */
const CARD_TOP_BAND = 0.125
const CARD_TOP_GAP = 0.075

/** How far a point is from a line between two others: the nearest a constellation's line comes to the avatar. */
function distanceToLine(px: number, py: number, a: Star, b: Star): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(a.x + t * dx - px, a.y + t * dy - py)
}

/** The lit stars, in order along the arc, and the dotted ones still to come at its ends. */
function constellation(tag: string, lit: number, w: number, h: number, wide: boolean): { stars: Star[]; next: { star: Star; from: Star }[] } {
  const rand = mulberry32(hashString(`card-stars:${tag}`))
  const p1 = rand() * Math.PI * 2
  const p2 = rand() * Math.PI * 2
  const jitters = Array.from({ length: MOST_DRAWN + 2 }, () => [rand() - 0.5, rand() - 0.5, rand()] as const)
  const k = Math.min(w, h) / 300
  const step = ARC_SPAN / (Math.max(lit, 5) - 1)
  const top = Math.PI * 1.5
  const angleOf = (i: number, ja: number, sway: number) =>
    Math.min(ARC_FROM + ARC_SPAN, Math.max(ARC_FROM, top + (i - (lit - 1) / 2) * step + ja * step * sway))

  // The wide sky behind the whole hero, blurred: an arc around its middle, eased down from its top.
  const cx = w / 2
  const cy = wide ? h * 0.5 : h * CARD_AVATAR_Y
  const ceiling = h * 0.08
  const wideStar = (i: number): Star => {
    const [ja, jr, js] = jitters[i + 1]!
    const angle = angleOf(i, ja, 0.6)
    const reach = 1 + 0.16 * Math.sin(2 * angle + p1) + 0.1 * Math.sin(3 * angle + p2) + jr * 0.34
    const y = cy + h * 0.38 * reach * Math.sin(angle)
    return {
      x: Math.min(w * 0.94, Math.max(w * 0.06, cx + w * 0.4 * reach * Math.cos(angle))),
      y: y < ceiling ? ceiling - (ceiling - y) * 0.4 : y,
      r: (2.1 + js * 1.1) * k,
    }
  }

  // The card: a ring around the avatar, never inside its clear circle, reaching up only through the gap
  // between the top's chips.
  const clear = w * CARD_CLEAR
  const keep = (s: Star) => {
    // The chips along the top: away from the middle, nothing above their band.
    if (s.y < h * CARD_TOP_BAND && Math.abs(s.x - cx) > w * CARD_TOP_GAP) s.y = h * CARD_TOP_BAND
    s.y = Math.max(h * 0.07, s.y)
    // Moved down, a star can come back near the avatar: out to the side, clear of it.
    const dy = s.y - cy
    if (Math.hypot(s.x - cx, dy) < clear && Math.abs(dy) < clear) s.x = cx + Math.sign(s.x - cx || 1) * Math.sqrt(clear * clear - dy * dy)
    s.x = Math.min(w * 0.94, Math.max(w * 0.06, s.x))
  }
  // One star always stands straight above the avatar, in the gap between the chips, so the lines that cross over
  // its head climb up to it rather than skim the top: the rest spread down both sides, the dotted ones to come
  // included, a step apart.
  const peak = Math.floor(lit / 2)
  const cardStep = ARC_SPAN / 2 / Math.max(1, Math.max(peak, lit - 1 - peak) + (lit < 5 ? 1 : 0))
  const cardAngle = (i: number, ja: number) =>
    Math.min(ARC_FROM + ARC_SPAN, Math.max(ARC_FROM, top + (i - peak) * cardStep + (i === peak ? 0 : ja * cardStep * 0.35)))
  const cardStar = (i: number): Star => {
    const [ja, jr, js] = jitters[i + 1]!
    const angle = cardAngle(i, ja)
    // Only ever outward of the clear circle, by a little more here and there: the constellation's own shape.
    const reach = 1.08 + 0.12 * (1 + Math.sin(2 * angle + p1)) * 0.5 + 0.08 * (1 + Math.sin(3 * angle + p2)) * 0.5 + (jr + 0.5) * 0.1
    const s = { x: cx + clear * 1.22 * reach * Math.cos(angle), y: cy + clear * reach * Math.sin(angle), r: (2.1 + js * 1.1) * k }
    keep(s)
    return s
  }

  const at = wide ? wideStar : cardStar
  const stars: Star[] = []
  for (let i = 0; i < lit; i++) stars.push(at(i))
  // Fewer than five: the next two, one at each end.
  const next = lit < 5 ? [{ star: at(-1), from: stars[0]! }, { star: at(lit), from: stars[lit - 1]! }] : []
  if (!wide) {
    // A line between two stars still cuts closer than either: one that crowds the avatar moves its stars out.
    const lines: [Star, Star][] = [...stars.slice(1).map((b, i): [Star, Star] => [stars[i]!, b]), ...next.map(({ from, star }): [Star, Star] => [from, star])]
    for (let pass = 0; pass < 8; pass++) {
      let moved = false
      for (const [a, b] of lines) {
        const d = distanceToLine(cx, cy, a, b)
        if (d >= clear) continue
        const out = Math.min(1.2, clear / Math.max(d, 1) + 0.02)
        for (const s of [a, b]) {
          s.x = cx + (s.x - cx) * out
          s.y = cy + (s.y - cy) * out
          keep(s)
        }
        moved = true
      }
      if (!moved) break
    }
  }
  return { stars, next }
}

/** The faint stars all over the sky, and where its glow sits: from the tag too. */
function sky(tag: string, w: number, h: number, wide: boolean) {
  const rand = mulberry32(hashString(`card-sky:${tag}`))
  const k = Math.min(w, h) / 300
  const dust = Array.from({ length: wide ? 70 : 28 }, () => ({
    x: rand() * w,
    y: rand() * h * 0.62,
    r: (0.5 + rand() * 0.35) * k,
    o: 0.25 + rand() * 0.3,
  }))
  return { dust, glow: { x: 0.2 + rand() * 0.6, y: 0.1 + rand() * 0.2 } }
}

const ACCENT = 'var(--hero-accent, #2eb8a0)'

/**
 * The constellation backdrop, filling a w × h box. `trophies` is null while they load: the sky draws, and the
 * constellation fades in once the count is known.
 */
export function CardStars({
  tag,
  trophies,
  width,
  height,
  wide = false,
  className,
}: {
  tag: string
  trophies: number | null
  width: number
  height: number
  /** Behind the whole hero, blurred: no stamp. */
  wide?: boolean
  className?: string
}) {
  const id = `cs${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const k = Math.min(width, height) / 300
  const count = trophies == null ? null : STARTER_STARS + trophies
  const shape = count == null ? null : constellation(tag, Math.min(count, MOST_DRAWN), width, height, wide)
  const { dust, glow } = sky(tag, width, height, wide)
  const line = shape ? shape.stars.map((s) => `${s.x.toFixed(1)},${s.y.toFixed(1)}`).join(' ') : ''
  return (
    <svg className={`cstars${className ? ` ${className}` : ''}`} viewBox={`0 0 ${width} ${height}`} width={width} height={height} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: `color-mix(in srgb, ${ACCENT} 16%, #0b0c1a)` }} />
          <stop offset="0.55" style={{ stopColor: `color-mix(in srgb, ${ACCENT} 30%, #10121f)` }} />
          <stop offset="1" stopColor="#07080d" />
        </linearGradient>
        <radialGradient id={`${id}g`} cx={glow.x} cy={glow.y} r="0.5">
          <stop offset="0" style={{ stopColor: ACCENT, stopOpacity: 0.3 }} />
          <stop offset="1" style={{ stopColor: ACCENT, stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      <rect width={width} height={height} fill={`url(#${id}s)`} />
      <rect width={width} height={height} fill={`url(#${id}g)`} />
      <g style={{ fill: `color-mix(in srgb, ${ACCENT} 18%, #ffffff)` }}>
        {dust.map((d, i) => (
          <circle key={i} cx={d.x.toFixed(1)} cy={d.y.toFixed(1)} r={d.r.toFixed(2)} opacity={d.o.toFixed(2)} />
        ))}
      </g>
      {shape ? (
        <g className="cstars__shape">
          <polyline points={line} fill="none" style={{ stroke: ACCENT }} strokeOpacity="0.6" strokeWidth={1.1 * k} strokeLinejoin="round" />
          {shape.next.length ? (
            <g fill="none" style={{ stroke: `color-mix(in srgb, ${ACCENT} 55%, #ffffff)` }} strokeOpacity="0.4" strokeWidth={k}>
              {shape.next.map(({ star, from }, i) => (
                <g key={i}>
                  <line x1={from.x} y1={from.y} x2={star.x} y2={star.y} strokeDasharray={`${2 * k} ${4 * k}`} />
                  <circle cx={star.x} cy={star.y} r={2.4 * k} />
                </g>
              ))}
            </g>
          ) : null}
          <g style={{ fill: ACCENT }} opacity="0.28">
            {shape.stars.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={s.r * 2.6} />
            ))}
          </g>
          <g style={{ fill: `color-mix(in srgb, ${ACCENT} 8%, #ffffff)` }}>
            {shape.stars.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={s.r} />
            ))}
          </g>
          {wide ? null : (
            <text className="cstars__stamp" x={width / 2} y={height * 0.552} textAnchor="middle" style={{ fill: `color-mix(in srgb, ${ACCENT} 55%, #ffffff)` }} fillOpacity="0.85">
              {`${tag} · ${count} ${count === 1 ? 'STAR' : 'STARS'}`}
            </text>
          )}
        </g>
      ) : null}
    </svg>
  )
}
