import { useState } from 'react'
import {
  sortTrophies,
  summarizeTrophies,
  type TrophyAward,
  type TrophyPeriod,
} from '../lib/trophies'
import { medalKind, type MedalKind } from './PodiumMedal'
import { MonthlyTrophyCup, TopTenRibbon, WeeklyMedal } from './TrophyArt'

/** Tiles shown before "Show all" — two rows on a wide screen. */
const SHOWN_AT_FIRST = 12

function TrophyIcon({ rank, period }: { rank: number; period: TrophyPeriod }) {
  const kind = medalKind(rank)
  // An event win is a cup: you took the whole thing, not a place on a board.
  if (period === 'event') return <MonthlyTrophyCup tone="gold" size="md" />
  if (period === 'monthly') {
    if (kind) return <MonthlyTrophyCup tone={kind} size="md" />
    return <TopTenRibbon tone="monthly" size="md" />
  }
  if (kind) return <WeeklyMedal rank={rank} size="md" />
  return <TopTenRibbon tone="weekly" size="md" />
}

/** Short date for a tile: the year only matters on a month. */
function trophyWhen(period: TrophyPeriod, periodKey: number): string {
  try {
    if (period === 'monthly') {
      const y = Math.floor(periodKey / 100)
      const m = periodKey % 100
      return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    }
    const y = Math.floor(periodKey / 10_000)
    const m = Math.floor((periodKey % 10_000) / 100)
    const d = periodKey % 100
    const day = new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return period === 'weekly' ? `Week of ${day}` : day
  } catch {
    return ''
  }
}

/** Tone class: the metal for a podium, or the board's ribbon colour. */
function trophyTone(t: TrophyAward): MedalKind | 'weekly' | 'monthly' {
  if (t.period === 'event') return 'gold'
  return medalKind(t.rank) ?? t.period
}

function TrophyTile({ trophy }: { trophy: TrophyAward }) {
  const isEvent = trophy.period === 'event'
  const when = trophyWhen(trophy.period, trophy.periodKey)
  const title = isEvent
    ? (trophy.eventTitle ?? 'Event')
    : trophy.rank <= 3
      ? `#${trophy.rank} global`
      : `Top 10 · #${trophy.rank}`
  const kind = isEvent ? 'Won' : trophy.period === 'monthly' ? 'Month' : 'Week'
  return (
    <li
      className={`pft__tile pft__tile--${trophyTone(trophy)}`}
      aria-label={
        isEvent
          ? `Won ${title}, ${when}`
          : `#${trophy.rank} global, ${when}, ${trophy.score} points`
      }
      title={
        isEvent
          ? `Won ${title} · ${when}`
          : `#${trophy.rank} on the global board · ${when} · ${trophy.score} pts`
      }
    >
      <span className="pft__kind">{kind}</span>
      <span className="pft__icon">
        <TrophyIcon rank={trophy.rank} period={trophy.period} />
      </span>
      <span className="pft__title">{title}</span>
      <span className="pft__when">{when}</span>
    </li>
  )
}

function TrophySkeleton() {
  return (
    <ul className="pft__grid" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="pft__tile pft__tile--skel">
          <span className="pft__skel-icon" />
          <span className="pft__skel-line" />
          <span className="pft__skel-line pft__skel-line--short" />
        </li>
      ))}
    </ul>
  )
}

export function summaryLine(trophies: TrophyAward[]): string {
  const s = summarizeTrophies(trophies)
  const bits: string[] = []
  if (s.events > 0) bits.push(`${s.events} ${s.events === 1 ? 'event' : 'events'} won`)
  if (s.podium > 0) bits.push(`${s.podium} podium ${s.podium === 1 ? 'finish' : 'finishes'}`)
  if (s.topTen > 0) bits.push(`${s.topTen} top 10`)
  return bits.join(' · ')
}

/**
 * The trophy shelf: one compact tile per trophy in a grid that wraps, capped
 * at two rows until asked for the rest. Event wins first, then monthly,
 * then weekly, newest first within each — so the case reads best-to-least
 * without needing sections.
 */
export function TrophyCase({
  trophies,
  isSelf,
}: {
  /** Null while loading. */
  trophies: TrophyAward[] | null
  isSelf: boolean
}) {
  const [showAll, setShowAll] = useState(false)

  const sorted = trophies
    ? [
        ...sortTrophies(trophies.filter((t) => t.period === 'event')),
        ...sortTrophies(trophies.filter((t) => t.period === 'monthly')),
        ...sortTrophies(trophies.filter((t) => t.period === 'weekly')),
      ]
    : []
  const total = sorted.length
  const shown = showAll ? sorted : sorted.slice(0, SHOWN_AT_FIRST)
  const hidden = total - shown.length

  return (
    <section className="ev-card pft" aria-label="Trophies" aria-busy={trophies === null}>
      <div className="ev-card__head">
        <h2 className="ev-card__title">
          Trophies
          {total > 0 ? <span className="pft__count">{total}</span> : null}
        </h2>
        {trophies && total > 0 ? <p className="ev-card__note">{summaryLine(trophies)}</p> : null}
      </div>

      {trophies === null ? (
        <TrophySkeleton />
      ) : total === 0 ? (
        <div className="pft__empty">
          <p className="pft__empty-title">
            {isSelf ? 'No trophies yet' : 'No trophies yet'}
          </p>
          <p className="pft__empty-copy">
            {isSelf
              ? 'Win an event, or finish in the global top 10 at the end of a week or month.'
              : 'Events won and top-10 board finishes will show up here.'}
          </p>
          <ul className="pft__legend" aria-label="Trophy tiers">
            <li>
              <MonthlyTrophyCup tone="gold" size="sm" />
              <span>Event win</span>
            </li>
            <li>
              <WeeklyMedal rank={1} size="sm" />
              <span>Weekly top 3</span>
            </li>
            <li>
              <TopTenRibbon tone="weekly" size="sm" />
              <span>Weekly top 10</span>
            </li>
            <li>
              <MonthlyTrophyCup tone="silver" size="sm" />
              <span>Monthly top 3</span>
            </li>
            <li>
              <TopTenRibbon tone="monthly" size="sm" />
              <span>Monthly top 10</span>
            </li>
          </ul>
        </div>
      ) : (
        <>
          <ul className="pft__grid">
            {shown.map((trophy) => (
              <TrophyTile key={trophy.id} trophy={trophy} />
            ))}
          </ul>
          {hidden > 0 || showAll ? (
            <div className="pft__more">
              <button
                type="button"
                className="pft__more-btn"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? 'Show fewer' : `Show all ${total}`}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
