import type { ReactNode } from 'react'
import { metalTone, type MetalTone, type TrophyTone } from '../lib/trophies'
import '../styles/trophies.css'

/*
 * The arcade's trophies, drawn the way the house draws its games: an outline
 * with a faint fill of its own colour, on a 48 grid. An event's winner gets a
 * cup; a month's podium a cup with its place on it; a week's podium a medal;
 * the rest of a top ten a rosette with its place; the all-time podium,
 * which only the boards show, a star; and each secret (lib/secrets.ts) its
 * own picture, with a question mark for one not found yet. Colour comes from
 * the tone class (trophies.css), so each one follows the theme.
 */

export type { MetalTone }
export type RibbonTone = 'weekly' | 'monthly'
export type TrophyArtSize = 'sm' | 'md' | 'lg'

const PX: Record<TrophyArtSize, number> = { sm: 26, md: 44, lg: 64 }

const PLACE: Record<MetalTone, number> = { gold: 1, silver: 2, bronze: 3 }

function Art({ tone, size, children }: { tone: TrophyTone; size: TrophyArtSize; children: ReactNode }) {
  const px = PX[size]
  return (
    <span className={`trophy-art trophy-art--${size} trophy-tone--${tone}`} aria-hidden="true">
      <svg viewBox="0 0 48 48" width={px} height={px} focusable="false">
        {children}
      </svg>
    </span>
  )
}

/** A place written on a trophy; too small to read at list size, so left off there unless it is the trophy's main mark. */
function Numeral({ n, x = 24, y, size }: { n: number | string; x?: number; y: number; size: number }) {
  return (
    <text className="trophy-art__num" x={x} y={y} textAnchor="middle" fontSize={size}>
      {n}
    </text>
  )
}

function CupShape({ place }: { place?: number }) {
  return (
    <>
      <path className="trophy-art__fill" d="M15 8h18v9a9 9 0 0 1-18 0Z" />
      <path d="M15 11H9v3a6 6 0 0 0 6 6M33 11h6v3a6 6 0 0 1-6 6" />
      <path d="M24 26v7M17 40h14M19 40l1.5-7h7l1.5 7" />
      {place ? <Numeral n={place} y={20.6} size={10.5} /> : null}
    </>
  )
}

/** An event won: the whole cup, no place on it, because first is the only place an event gives one. */
export function EventCup({ size = 'md' }: { size?: TrophyArtSize }) {
  return (
    <Art tone="gold" size={size}>
      <CupShape />
    </Art>
  )
}

/** A month's podium: a cup in its metal, with its place on the bowl where there is room to read it. */
export function MonthlyTrophyCup({ tone, size = 'md' }: { tone: MetalTone; size?: TrophyArtSize }) {
  return (
    <Art tone={tone} size={size}>
      <CupShape place={size === 'sm' ? undefined : PLACE[tone]} />
    </Art>
  )
}

/** A week's podium: a medal on its strap. Small, the disc grows so its number still reads. */
export function WeeklyMedal({ rank, size = 'md' }: { rank: number; size?: TrophyArtSize }) {
  const tone = metalTone(rank)
  return (
    <Art tone={tone} size={size}>
      {size === 'sm' ? (
        <>
          <path d="M16 3l5.5 11.5M32 3l-5.5 11.5" />
          <circle className="trophy-art__fill" cx="24" cy="29" r="15" />
          <Numeral n={rank} y={35.2} size={17} />
        </>
      ) : (
        <>
          <path d="M16 5l5 13M32 5l-5 13" />
          <circle className="trophy-art__fill" cx="24" cy="29" r="12" />
          <Numeral n={rank} y={33.6} size={13} />
        </>
      )}
    </Art>
  )
}

/** The rest of a top ten: a rosette with its place, teal for a week and violet for a month. */
export function TopTenRibbon({
  tone = 'weekly',
  size = 'md',
  rank,
}: {
  tone?: RibbonTone
  size?: TrophyArtSize
  rank?: number
}) {
  return (
    <Art tone={tone === 'monthly' ? 'month' : 'week'} size={size}>
      <circle className="trophy-art__fill trophy-art__fill--soft" cx="24" cy="19" r="12" />
      <path d="M17 29l-4 14 6-3 3 5 2-13M31 29l4 14-6-3-3 5-2-13" />
      {rank ? <Numeral n={rank} y={23.3} size={12} /> : null}
    </Art>
  )
}

/** A month of the bug hunt caught in full: all twelve, and a bug in a jar to show for it. */
export function HuntSetJar({ size = 'md' }: { size?: TrophyArtSize }) {
  return (
    <Art tone="hunt" size={size}>
      <rect x="15" y="5" width="18" height="6" rx="2" />
      <path className="trophy-art__fill trophy-art__fill--soft" d="M17 11v2.6c-3.4 2-5.4 5.4-5.4 9.4v13a6 6 0 0 0 6 6h12.8a6 6 0 0 0 6-6V23c0-4-2-7.4-5.4-9.4V11" />
      <circle className="trophy-art__fill" cx="24" cy="30.5" r="5.5" />
      <path d="M24 25v11M21.6 25.6l-2.4-3.2M26.4 25.6l2.4-3.2" />
    </Art>
  )
}

/** The all-time podium, on the boards only: a star with its place. */
export function AllTimeStar({ rank, size = 'sm' }: { rank: number; size?: Extract<TrophyArtSize, 'sm' | 'md'> }) {
  return (
    <Art tone={metalTone(rank)} size={size}>
      <path
        className="trophy-art__fill"
        d="M24 4l5.5 13.3 14.3.9-10.9 9.9 3.3 14.1L24 34.6l-12.2 7.6 3.3-14.1-10.9-9.9 14.3-.9Z"
      />
      <Numeral n={rank} y={size === 'sm' ? 31.2 : 29.6} size={size === 'sm' ? 16 : 11} />
    </Art>
  )
}

/** Each secret's picture, by its number (lib/secrets.ts). */
const SECRET_ART: Record<number, ReactNode> = {
  // Night Owl: an owl's face, ears up, eyes wide.
  1: (
    <>
      <path className="trophy-art__fill trophy-art__fill--soft" d="M12 17 15 7l7 7h4l7-7 3 10v12a12 12 0 0 1-24 0Z" />
      <circle className="trophy-art__fill" cx="19" cy="23" r="4.6" />
      <circle className="trophy-art__fill" cx="29" cy="23" r="4.6" />
      <path d="M22.4 29.5 24 32.6l1.6-3.1Z" />
    </>
  ),
  // Early Bird: the sun coming up, and a bird out already.
  2: (
    <>
      <path className="trophy-art__fill" d="M11 35a13 13 0 0 1 26 0" />
      <path d="M6 35h36M24 17v-5M13 22.5l-3.4-3.4M35 22.5l3.4-3.4" />
      <path d="M27.5 10.5q2-2.2 4 0q2-2.2 4 0" />
    </>
  ),
  // Grand Tour: the whole world.
  3: (
    <>
      <circle className="trophy-art__fill trophy-art__fill--soft" cx="24" cy="24" r="14" />
      <path d="M24 10c-4.6 3.6-7 8.4-7 14s2.4 10.4 7 14c4.6-3.6 7-8.4 7-14s-2.4-10.4-7-14ZM10 24h28M12.4 17h23.2M12.4 31h23.2" />
    </>
  ),
  // Palindrome: the same both ways.
  4: (
    <>
      <path d="M11 17h24M30 12l5 5-5 5M37 31H13M18 26l-5 5 5 5" />
      <circle className="trophy-art__fill" cx="24" cy="24" r="2.4" />
    </>
  ),
  // Lucky Sevens: three of them in a row, and the handle.
  5: (
    <>
      <rect className="trophy-art__fill trophy-art__fill--soft" x="6" y="13" width="31" height="22" rx="4" />
      <Numeral n={7} x={13.5} y={29} size={11} />
      <Numeral n={7} x={21.5} y={29} size={11} />
      <Numeral n={7} x={29.5} y={29} size={11} />
      <path d="M41 17v12M37 27h4" />
      <circle className="trophy-art__fill" cx="41" cy="14.5" r="2.6" />
    </>
  ),
  // Photo Finish: the chequered flag.
  6: (
    <>
      <path d="M13 42V7" />
      <path className="trophy-art__fill trophy-art__fill--soft" d="M13 8h24v17H13Z" />
      <path className="trophy-art__fill" d="M13 8h6v5.7h-6ZM25 8h6v5.7h-6ZM19 13.7h6v5.6h-6ZM31 13.7h6v5.6h-6ZM13 19.3h6V25h-6ZM25 19.3h6V25h-6Z" />
    </>
  ),
  // So Close: an arrow just off the middle.
  7: (
    <>
      <circle className="trophy-art__fill trophy-art__fill--soft" cx="21" cy="27" r="14" />
      <circle cx="21" cy="27" r="8.5" />
      <circle className="trophy-art__fill" cx="21" cy="27" r="3" />
      <path d="M25.5 23.5 40 9M34.5 9H40v5.5" />
    </>
  ),
  // Hole in One: the flag, and the ball in the cup.
  8: (
    <>
      <path d="M26 39V8" />
      <path className="trophy-art__fill" d="M26 9l12 4.5L26 18Z" />
      <ellipse className="trophy-art__fill trophy-art__fill--soft" cx="22" cy="39" rx="12" ry="3.6" />
      <circle cx="20" cy="38" r="2.4" />
    </>
  ),
  // Up Up Down Down: the pad the code goes in on.
  9: (
    <>
      <path className="trophy-art__fill trophy-art__fill--soft" d="M19 8h10v11h11v10H29v11H19V29H8V19h11Z" />
      <path d="M24 11.5l-2.4 3h4.8ZM24 36.5l-2.4-3h4.8ZM11.5 24l3-2.4v4.8ZM36.5 24l-3-2.4v4.8Z" />
    </>
  ),
  // Blip Blip: the blip, and its rings.
  10: (
    <>
      <circle className="trophy-art__fill" cx="24" cy="24" r="4.5" />
      <circle cx="24" cy="24" r="10.5" />
      <circle cx="24" cy="24" r="17" strokeDasharray="3.5 3.5" />
    </>
  ),
}

/** A secret trophy: its own picture, in the secrets' rose. */
export function SecretArt({ n, size = 'md' }: { n: number; size?: TrophyArtSize }) {
  return (
    <Art tone="secret" size={size}>
      {SECRET_ART[n] ?? <Numeral n="?" y={32} size={24} />}
    </Art>
  )
}

/** A secret not found yet: only a question mark. */
export function SecretUnknown({ size = 'md' }: { size?: TrophyArtSize }) {
  return (
    <Art tone="hidden" size={size}>
      <circle cx="24" cy="24" r="16" strokeDasharray="4 4" />
      <Numeral n="?" y={32} size={24} />
    </Art>
  )
}
