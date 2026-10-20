import { useId } from 'react'
import { sparklePath } from '../../lib/seasonArt'

/*
 * A card foil, drawn still: a little trading card leaning back, its sheen caught mid-sweep. The pass shows it on
 * its level-28 tile (season/RewardArt.tsx) and the counter on its shelf (PrizeArt.tsx). On the player card itself
 * the foil moves (FullArtCard's .fac__foil, playerCard.css). Ramsey picked the foils for level 28 of both passes,
 * in place of their signs (2026-10-20).
 */

/** The foils, by id: the season pass gives each one at its level 28. */
export const FOILS = ['fl-liftoff', 'fl-frost'] as const

/** A little card with the foil over it, `w` wide at (x, y), in the caller's SVG. */
export function FoilCard({ foil, x, y, w }: { foil: string; x: number; y: number; w: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const h = (w * 7) / 5
  const frost = foil === 'fl-frost'
  const band = `fb${uid}`
  const clip = `fc${uid}`
  const corner = `fr${uid}`
  return (
    <g transform={`rotate(-6 ${x + w / 2} ${y + h / 2})`}>
      <defs>
        <clipPath id={clip}>
          <rect x={x} y={y} width={w} height={h} rx={w * 0.09} />
        </clipPath>
        <linearGradient id={band} x1="0" y1="0" x2="1" y2="0.55">
          {frost ? (
            <>
              <stop offset="0.28" stopColor="#bfe8ff" stopOpacity="0" />
              <stop offset="0.44" stopColor="#bfe8ff" stopOpacity="0.55" />
              <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.85" />
              <stop offset="0.56" stopColor="#bfe8ff" stopOpacity="0.5" />
              <stop offset="0.72" stopColor="#bfe8ff" stopOpacity="0" />
            </>
          ) : (
            <>
              <stop offset="0.26" stopColor="#ffaaf0" stopOpacity="0" />
              <stop offset="0.4" stopColor="#ffaaf0" stopOpacity="0.6" />
              <stop offset="0.5" stopColor="#8cdcff" stopOpacity="0.7" />
              <stop offset="0.6" stopColor="#fff0aa" stopOpacity="0.6" />
              <stop offset="0.74" stopColor="#fff0aa" stopOpacity="0" />
            </>
          )}
        </linearGradient>
        <radialGradient id={corner} cx="0" cy="0" r="0.6">
          <stop offset="0" stopColor="#e6f7ff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#e6f7ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x={x} y={y} width={w} height={h} rx={w * 0.09} fill={frost ? '#16304a' : '#191b3e'} />
      <g clipPath={`url(#${clip})`}>
        {/* The card's own picture, simply: a night, and a hill of snow or a planet. */}
        {frost ? (
          <path d={`M${x} ${y + h * 0.7} Q ${x + w * 0.5} ${y + h * 0.58} ${x + w} ${y + h * 0.68} V ${y + h} H ${x} Z`} fill="#dbe9f5" />
        ) : (
          <circle cx={x + w * 0.72} cy={y + h * 0.28} r={w * 0.16} fill="#7c5ce0" />
        )}
        <circle cx={x + w / 2} cy={y + h * 0.42} r={w * 0.2} fill="#f08a5a" stroke="#f2c14e" strokeWidth={w * 0.03} />
        <rect x={x - w * 0.2} y={y - h * 0.1} width={w * 1.4} height={h * 1.2} fill={`url(#${band})`} />
        {frost ? (
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
        ) : (
          <>
            <path d={sparklePath(x + w * 0.22, y + h * 0.2, w * 0.09)} fill="#ffffff" />
            <path d={sparklePath(x + w * 0.8, y + h * 0.62, w * 0.07)} fill="#ffffff" />
            <path d={sparklePath(x + w * 0.3, y + h * 0.78, w * 0.06)} fill="#fff0aa" />
          </>
        )}
      </g>
      <rect x={x} y={y} width={w} height={h} rx={w * 0.09} fill="none" stroke={frost ? '#bfe8ff' : '#ffd0f4'} strokeWidth={w * 0.03} />
    </g>
  )
}
