import type { ReactNode } from 'react'
import { metalTone, type MetalTone, type TrophyTone } from '../lib/trophies'
import '../styles/trophies.css'

/*
 * The arcade's trophies, drawn the way the house draws its games: an outline
 * with a faint fill of its own colour, on a 48 grid. An event's winner gets a
 * cup; a month's podium a cup with its place on it; a week's podium a medal;
 * the rest of a top ten a rosette with its place; and the all-time podium,
 * which only the boards show, a star. Colour comes from the tone class
 * (trophies.css), so each one follows the theme.
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
function Numeral({ n, x = 24, y, size }: { n: number; x?: number; y: number; size: number }) {
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
