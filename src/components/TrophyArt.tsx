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

/** A month of the bug hunt caught in full: all ten, and a bug in a jar to show for it. */
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
  // Marathon: a race number, pinned on.
  14: (
    <>
      <rect className="trophy-art__fill trophy-art__fill--soft" x="9" y="10" width="30" height="28" rx="3" />
      <circle className="trophy-art__fill" cx="13.5" cy="14.5" r="1.3" />
      <circle className="trophy-art__fill" cx="34.5" cy="14.5" r="1.3" />
      <circle className="trophy-art__fill" cx="13.5" cy="33.5" r="1.3" />
      <circle className="trophy-art__fill" cx="34.5" cy="33.5" r="1.3" />
      <Numeral n={50} y={29.5} size={14} />
    </>
  ),
  // Barrel Roll: the page, going round.
  15: (
    <>
      <g transform="rotate(20 24 24)">
        <rect className="trophy-art__fill" x="17" y="15" width="14" height="18" rx="2.5" />
        <path d="M20.5 20.5h7M20.5 24.5h7M20.5 28.5h4.5" />
      </g>
      <path d="M29.8 8A17 17 0 1 1 11 13.1" />
      <path d="M6.2 14.4 11 13.1l-.4 5" />
    </>
  ),
  // Perfect Corner: the blip, bounced right into the screen's corner.
  16: (
    <>
      <rect className="trophy-art__fill trophy-art__fill--soft" x="6" y="8" width="36" height="28" rx="3" />
      <path d="M18 42h12M24 36v6" />
      <path d="M8.5 24 17 32.5 34 15.5" strokeDasharray="2.5 3" />
      <circle className="trophy-art__fill" cx="36.5" cy="13.5" r="3.2" />
      <path d="M41 6.5l2.5-2.5M43 11.5h3M36.5 4.5v-3" />
    </>
  ),
  // Nice Try: the old disguise, glasses, nose and all.
  17: (
    <>
      <path d="M10 10.5q6-3.8 12 0M26 10.5q6-3.8 12 0" />
      <circle className="trophy-art__fill trophy-art__fill--soft" cx="16.5" cy="19" r="6" />
      <circle className="trophy-art__fill trophy-art__fill--soft" cx="31.5" cy="19" r="6" />
      <path d="M22.5 19q1.5-1.6 3 0M10.5 18l-4-2.5M37.5 18l4-2.5" />
      <path className="trophy-art__fill" d="M24 22.5 20.8 30.5a3.2 3.2 0 0 0 6.4 0Z" />
      <path className="trophy-art__fill" d="M24 35.2C20 33.2 15.5 34.5 12.5 38.5 16.5 39.8 20.5 39.6 24 38.2 27.5 39.6 31.5 39.8 35.5 38.5 32.5 34.5 28 33.2 24 35.2Z" />
    </>
  ),
  // Continue?: a coin, on its way into the slot.
  18: (
    <>
      <circle className="trophy-art__fill" cx="24" cy="12" r="7" />
      <circle cx="24" cy="12" r="3.6" />
      <path d="M24 21v2.6" />
      <rect className="trophy-art__fill trophy-art__fill--soft" x="8" y="26" width="32" height="17" rx="3.5" />
      <rect className="trophy-art__fill" x="18" y="31" width="12" height="3.2" rx="1.6" />
    </>
  ),
  // Smashing: a pin standing where a plate was, the glass flying off it in pieces.
  19: (
    <>
      <path d="M24 22v15" />
      <circle className="trophy-art__fill" cx="24" cy="39.5" r="2.8" />
      <path className="trophy-art__fill trophy-art__fill--soft" d="M13 14.5 20.5 17.5 15.5 21.5Z" />
      <path className="trophy-art__fill trophy-art__fill--soft" d="M27.5 16.5 36 11.5 33.5 20Z" />
      <path className="trophy-art__fill trophy-art__fill--soft" d="M8.5 25.5 17 24 12.5 30Z" />
      <path className="trophy-art__fill trophy-art__fill--soft" d="M31 24 39.5 25.5 34 30.5Z" />
      <path className="trophy-art__fill trophy-art__fill--soft" d="M20.5 9.5 25.5 5.5 26.5 13Z" />
      <path d="M22.5 20.5l-1.5-1.8M25.5 20.5l1.5-1.8M24 19.5v-2.2" />
    </>
  ),
  // Placebo: the button at the crossing, on its pole, saying WAIT.
  20: (
    <>
      <path d="M24 27v14M18 41h12" />
      <rect className="trophy-art__fill trophy-art__fill--soft" x="15" y="6" width="18" height="21" rx="3" />
      <rect className="trophy-art__fill" x="18.5" y="9.5" width="11" height="4.5" rx="1.2" />
      <circle className="trophy-art__fill" cx="24" cy="20.5" r="3.6" />
    </>
  ),
  // Jackpot: cherries, two on a stem, and a sparkle.
  21: (
    <>
      <path d="M17 26Q19 15 27 9M31.5 27Q30 17 27 9" />
      <path className="trophy-art__fill trophy-art__fill--soft" d="M27 9q6-4 10 0q-5 4-10 0Z" />
      <circle className="trophy-art__fill" cx="16.5" cy="32" r="6.5" />
      <circle className="trophy-art__fill" cx="31.5" cy="33.5" r="6.5" />
      <path d="M40 17v5M37.5 19.5h5" />
    </>
  ),
  // Donuts: a tyre going round and round.
  22: (
    <>
      <circle className="trophy-art__fill" cx="24" cy="24" r="10.5" />
      <circle className="trophy-art__fill trophy-art__fill--soft" cx="24" cy="24" r="4" />
      <path d="M8.5 16A17 17 0 0 1 21 7.2M17.5 5.4 21 7.2l-2.3 3.4M39.5 32A17 17 0 0 1 27 40.8M30.5 42.6 27 40.8l2.3-3.4" />
    </>
  ),
  // Lost Your Marbles: off the edge they go, one after another.
  23: (
    <>
      <path d="M4 20h17v6" />
      <circle className="trophy-art__fill" cx="14" cy="15.8" r="3.4" />
      <circle className="trophy-art__fill" cx="30" cy="21" r="3.4" />
      <circle className="trophy-art__fill" cx="36" cy="38" r="3.4" />
    </>
  ),
  // Shall We Play a Game?: an old terminal, with noughts and crosses on it.
  24: (
    <>
      <rect className="trophy-art__fill trophy-art__fill--soft" x="6" y="7" width="36" height="27" rx="3" />
      <path d="M20 12v17M28 12v17M13 17.5h22M13 23.5h22" />
      <path d="M14.5 12.5l2.5 2.5M17 12.5l-2.5 2.5" />
      <circle cx="31.5" cy="20.5" r="1.6" />
      <path d="M20 34l-1.5 6h11L28 34M15 40h18" />
    </>
  ),
  // Safe Spot: tucked in a corner of the maze while a chaser wonders where you went.
  25: (
    <>
      <path d="M8 8h32M8 8v32h13" />
      <circle className="trophy-art__fill" cx="14.5" cy="33.5" r="3.6" />
      <path className="trophy-art__fill trophy-art__fill--soft" d="M27 41v-9a6.5 6.5 0 0 1 13 0v9l-2.2-1.6-2.1 1.6-2.2-1.6-2.2 1.6-2.1-1.6Z" />
      <Numeral n="?" x={33.5} y={24} size={11} />
    </>
  ),
  // Shooting Star: across the dusk, its tail behind it.
  27: (
    <>
      <path className="trophy-art__fill" d="M31.0 8.5 32.9 13.4 38.1 13.7 34.0 17.0 35.4 22.1 31.0 19.2 26.6 22.1 28.0 17.0 23.9 13.7 29.1 13.4Z" />
      <path d="M24 21 8 37M21 16.5 9 28.5M28.5 24.5 16.5 36.5" />
      <path d="M8 12v3M6.5 13.5h3M40 33v3M38.5 34.5h3" />
    </>
  ),
  // Staff Only: the back-room door, its sign over it and its keypad beside it.
  29: (
    <>
      <path className="trophy-art__fill trophy-art__fill--soft" d="M15 15h16v27H15Z" />
      <path d="M15 42V15h16v27M11 42h28" />
      <rect x="13" y="6" width="20" height="6" rx="1.5" />
      <circle className="trophy-art__fill" cx="27.5" cy="29" r="1.6" />
      <rect className="trophy-art__fill" x="35" y="24" width="5" height="8" rx="1" />
    </>
  ),
  // Shoot the Moon: a full moon with a black eye.
  28: (
    <>
      <circle className="trophy-art__fill trophy-art__fill--soft" cx="24" cy="25" r="15" />
      <circle className="trophy-art__fill" cx="18.5" cy="22" r="4.6" />
      <circle cx="18.5" cy="22" r="1" />
      <path d="M27.5 21.5h4.5M24 32.5q2.2-2 4.4 0" />
      <circle cx="31" cy="31" r="1.6" />
      <path d="M38 8l2 4M44 11l-4 1.5M42 4l-2.5 4" />
    </>
  ),
  // One Small Step: the little moon past Lander's cave, with its flag planted.
  30: (
    <>
      <circle className="trophy-art__fill trophy-art__fill--soft" cx="22" cy="30" r="13" />
      <circle cx="16.5" cy="31" r="2.6" />
      <circle cx="26" cy="37" r="1.8" />
      <circle cx="27.5" cy="27" r="1.2" />
      <path d="M29.5 19.4 34 5.5" />
      <path className="trophy-art__fill" d="M34 5.5q4.6-.4 8.4 2.6l-1.7 5.2q-3.8-3-8.4-2.6Z" />
      <path d="M9 8v3.5M7.25 9.75h3.5" />
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
