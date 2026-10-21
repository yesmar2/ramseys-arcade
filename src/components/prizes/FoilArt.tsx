import { useId, type ReactNode } from 'react'
import { sparklePath } from '../../lib/seasonArt'

/*
 * A card foil, drawn still: a little trading card leaning back, its sheen caught mid-sweep. The pass shows it on
 * its tile (season/RewardArt.tsx) and the counter on its shelf (PrizeArt.tsx). On the player card itself the foil
 * moves (FullArtCard's .fac__foil, playerCard.css). Ramsey picked the foils for level 28 of both passes, in place
 * of their signs (2026-10-20); four more took the place of titles (2026-10-21): the top of each Gold Pass, a
 * 100-day streak and the founders' Plus.
 */

/** The foils, by id. */
export const FOILS = ['fl-liftoff', 'fl-frost', 'fl-nebula', 'fl-aurora', 'fl-everyday', 'fl-founder'] as const

type Box = { x: number; y: number; w: number; h: number }

type Look = {
  /** The card's own colour, under everything. */
  card: string
  /** Its edge. */
  edge: string
  /** The sheen across it, as gradient stops: [offset, colour, opacity]. */
  sheen: readonly (readonly [number, string, number])[]
  /** What the foil adds over the card, inside its edge. */
  over: (b: Box, ids: { corner: string; cloud: string }) => ReactNode
}

const LOOKS: Record<string, Look> = {
  'fl-liftoff': {
    card: '#191b3e',
    edge: '#ffd0f4',
    sheen: [[0.26, '#ffaaf0', 0], [0.4, '#ffaaf0', 0.6], [0.5, '#8cdcff', 0.7], [0.6, '#fff0aa', 0.6], [0.74, '#fff0aa', 0]],
    over: ({ x, y, w, h }) => (
      <>
        <path d={sparklePath(x + w * 0.22, y + h * 0.2, w * 0.09)} fill="#ffffff" />
        <path d={sparklePath(x + w * 0.8, y + h * 0.62, w * 0.07)} fill="#ffffff" />
        <path d={sparklePath(x + w * 0.3, y + h * 0.78, w * 0.06)} fill="#fff0aa" />
      </>
    ),
  },
  'fl-frost': {
    card: '#16304a',
    edge: '#bfe8ff',
    sheen: [[0.28, '#bfe8ff', 0], [0.44, '#bfe8ff', 0.55], [0.5, '#ffffff', 0.85], [0.56, '#bfe8ff', 0.5], [0.72, '#bfe8ff', 0]],
    over: ({ x, y, w, h }, { corner }) => (
      <>
        <rect x={x} y={y} width={w * 0.6} height={w * 0.6} fill={`url(#${corner})`} />
        <rect x={x + w} y={y + h} width={w * 0.6} height={w * 0.6} fill={`url(#${corner})`} transform={`rotate(180 ${x + w} ${y + h})`} />
        <path
          d={`M${x} ${y + w * 0.16} L ${x + w * 0.2} ${y + w * 0.1} L ${x + w * 0.3} ${y + w * 0.2} M ${x + w * 0.2} ${y + w * 0.1} L ${x + w * 0.18} ${y}`}
          stroke="#ffffff"
          strokeWidth={w * 0.025}
          strokeLinecap="round"
          fill="none"
        />
      </>
    ),
  },
  // Nebula (Space Race's Gold Pass): clouds of pink and violet drifting over the card.
  'fl-nebula': {
    card: '#1a1236',
    edge: '#e0a8ff',
    sheen: [[0.3, '#ffb8ec', 0], [0.46, '#ffb8ec', 0.4], [0.54, '#b89cff', 0.4], [0.7, '#b89cff', 0]],
    over: ({ x, y, w, h }, { cloud }) => (
      <>
        <ellipse cx={x + w * 0.2} cy={y + h * 0.22} rx={w * 0.42} ry={h * 0.16} fill={`url(#${cloud})`} />
        <ellipse cx={x + w * 0.86} cy={y + h * 0.76} rx={w * 0.46} ry={h * 0.18} fill={`url(#${cloud})`} />
        <path d={sparklePath(x + w * 0.78, y + h * 0.18, w * 0.06)} fill="#ffffff" />
        <path d={sparklePath(x + w * 0.18, y + h * 0.7, w * 0.05)} fill="#ffd0f4" />
      </>
    ),
  },
  // Aurora (Cold Snap's Gold Pass): ribbons of green and violet across the top.
  'fl-aurora': {
    card: '#0f2238',
    edge: '#8ff0c8',
    sheen: [[0.32, '#c8fff0', 0], [0.48, '#c8fff0', 0.4], [0.52, '#c8fff0', 0.4], [0.68, '#c8fff0', 0]],
    over: ({ x, y, w, h }) => (
      <>
        <path
          d={`M${x - w * 0.1} ${y + h * 0.16} Q ${x + w * 0.3} ${y + h * 0.04} ${x + w * 0.55} ${y + h * 0.17} T ${x + w * 1.1} ${y + h * 0.12}`}
          stroke="#5ff0b0"
          strokeWidth={h * 0.07}
          strokeLinecap="round"
          fill="none"
          opacity="0.75"
        />
        <path
          d={`M${x - w * 0.1} ${y + h * 0.28} Q ${x + w * 0.35} ${y + h * 0.18} ${x + w * 0.6} ${y + h * 0.29} T ${x + w * 1.1} ${y + h * 0.24}`}
          stroke="#b48cff"
          strokeWidth={h * 0.045}
          strokeLinecap="round"
          fill="none"
          opacity="0.6"
        />
      </>
    ),
  },
  // Every Day (a 100-day streak): a gold edge, embers rising up the card.
  'fl-everyday': {
    card: '#2a1a10',
    edge: '#f5c542',
    sheen: [[0.34, '#ffe08a', 0], [0.48, '#ffe08a', 0.45], [0.52, '#ffe08a', 0.45], [0.66, '#ffe08a', 0]],
    over: ({ x, y, w, h }) => (
      <>
        <rect x={x + w * 0.05} y={y + w * 0.05} width={w * 0.9} height={h - w * 0.1} rx={w * 0.06} fill="none" stroke="#f5c542" strokeWidth={w * 0.03} opacity="0.7" />
        {([[0.24, 0.84, 0.035], [0.4, 0.66, 0.025], [0.7, 0.78, 0.03], [0.78, 0.5, 0.022], [0.3, 0.42, 0.02]] as const).map(([fx, fy, fr]) => (
          <circle key={`${fx}-${fy}`} cx={x + w * fx} cy={y + h * fy} r={w * fr} fill="#ffb347" />
        ))}
      </>
    ),
  },
  // Founder (Plus while the arcade opened): a frame of brushed gold, a slow sheen across it.
  'fl-founder': {
    card: '#1c1a24',
    edge: '#e8c66a',
    sheen: [[0.36, '#fff4cc', 0], [0.49, '#fff4cc', 0.5], [0.51, '#fff4cc', 0.5], [0.64, '#fff4cc', 0]],
    over: ({ x, y, w, h }) => (
      <>
        <rect x={x + w * 0.04} y={y + w * 0.04} width={w * 0.92} height={h - w * 0.08} rx={w * 0.06} fill="none" stroke="#c9a24a" strokeWidth={w * 0.07} />
        <rect x={x + w * 0.04} y={y + w * 0.04} width={w * 0.92} height={h - w * 0.08} rx={w * 0.06} fill="none" stroke="#fff0b8" strokeWidth={w * 0.012} opacity="0.7" />
        <path d={sparklePath(x + w * 0.5, y + h * 0.08, w * 0.06)} fill="#fff0b8" />
      </>
    ),
  },
}

/** A little card with the foil over it, `w` wide at (x, y), in the caller's SVG. */
export function FoilCard({ foil, x, y, w }: { foil: string; x: number; y: number; w: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const h = (w * 7) / 5
  const look = LOOKS[foil] ?? LOOKS['fl-frost']
  const snowy = foil === 'fl-frost' || foil === 'fl-aurora'
  const band = `fb${uid}`
  const clip = `fc${uid}`
  const corner = `fr${uid}`
  const cloud = `fn${uid}`
  return (
    <g transform={`rotate(-6 ${x + w / 2} ${y + h / 2})`}>
      <defs>
        <clipPath id={clip}>
          <rect x={x} y={y} width={w} height={h} rx={w * 0.09} />
        </clipPath>
        <linearGradient id={band} x1="0" y1="0" x2="1" y2="0.55">
          {look.sheen.map(([offset, colour, opacity]) => (
            <stop key={offset} offset={offset} stopColor={colour} stopOpacity={opacity} />
          ))}
        </linearGradient>
        <radialGradient id={corner} cx="0" cy="0" r="0.6">
          <stop offset="0" stopColor="#e6f7ff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#e6f7ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={cloud}>
          <stop offset="0" stopColor="#ff8ad8" stopOpacity="0.6" />
          <stop offset="0.6" stopColor="#9a6cff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#9a6cff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x={x} y={y} width={w} height={h} rx={w * 0.09} fill={look.card} />
      <g clipPath={`url(#${clip})`}>
        {/* The card's own picture, simply: a night, and a hill of snow or a planet. */}
        {snowy ? (
          <path d={`M${x} ${y + h * 0.7} Q ${x + w * 0.5} ${y + h * 0.58} ${x + w} ${y + h * 0.68} V ${y + h} H ${x} Z`} fill="#dbe9f5" />
        ) : (
          <circle cx={x + w * 0.72} cy={y + h * 0.28} r={w * 0.16} fill="#7c5ce0" />
        )}
        <circle cx={x + w / 2} cy={y + h * 0.42} r={w * 0.2} fill="#f08a5a" stroke="#f2c14e" strokeWidth={w * 0.03} />
        <rect x={x - w * 0.2} y={y - h * 0.1} width={w * 1.4} height={h * 1.2} fill={`url(#${band})`} />
        {look.over({ x, y, w, h }, { corner, cloud })}
      </g>
      <rect x={x} y={y} width={w} height={h} rx={w * 0.09} fill="none" stroke={look.edge} strokeWidth={w * 0.03} />
    </g>
  )
}
