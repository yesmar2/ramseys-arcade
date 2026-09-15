import { useEffect, useState } from 'react'
import {
  fetchTrophies,
  formatTrophyPeriod,
  sortTrophies,
  summarizeTrophies,
  type TrophyAward,
  type TrophyPeriod,
} from '../lib/trophies'
import { medalKind } from './PodiumMedal'
import { MonthlyTrophyCup, TopTenRibbon, WeeklyMedal } from './TrophyArt'

function TrophyIcon({ rank, period }: { rank: number; period: TrophyPeriod }) {
  const kind = medalKind(rank)
  // An event win is a cup: you took the whole thing, not a place on a board.
  if (period === 'event') return <MonthlyTrophyCup tone="gold" />
  if (period === 'monthly') {
    if (kind) return <MonthlyTrophyCup tone={kind} />
    return <TopTenRibbon tone="monthly" />
  }
  if (kind) return <WeeklyMedal rank={rank} />
  return <TopTenRibbon tone="weekly" />
}

function TrophySkeleton() {
  return (
    <ul className="trophy-case__grid" aria-hidden="true">
      {Array.from({ length: 3 }, (_, i) => (
        <li key={i} className="trophy-case__skel">
          <span className="trophy-case__skel-medal" />
          <span className="trophy-case__skel-line trophy-case__skel-line--short" />
          <span className="trophy-case__skel-line" />
        </li>
      ))}
    </ul>
  )
}

function TrophyCard({ trophy }: { trophy: TrophyAward }) {
  const periodLabel = formatTrophyPeriod(trophy.period, trophy.periodKey)
  const isEvent = trophy.period === 'event'
  const podium = trophy.rank <= 3
  return (
    <li>
      <div
        className={[
          'trophy-case__card',
          `trophy-case__card--${trophy.period}`,
          podium ? 'trophy-case__card--podium' : 'trophy-case__card--top10',
          podium ? `trophy-case__card--place-${trophy.rank}` : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label={
          isEvent
            ? `Won ${trophy.eventTitle ?? 'an event'}, ${periodLabel}`
            : `#${trophy.rank} global, ${periodLabel}, ${trophy.score} points`
        }
      >
        <span
          className={`trophy-case__badge trophy-case__badge--${trophy.period}`}
        >
          {isEvent ? 'Event' : trophy.period === 'monthly' ? 'Monthly' : 'Weekly'}
        </span>
        <span className="trophy-case__icon">
          <TrophyIcon rank={trophy.rank} period={trophy.period} />
        </span>
        {isEvent ? (
          <span className="trophy-case__won">Won</span>
        ) : (
          <span className="trophy-case__rank">#{trophy.rank}</span>
        )}
        <span className="trophy-case__period">
          {isEvent ? (trophy.eventTitle ?? 'Event') : periodLabel}
        </span>
        {isEvent ? <span className="trophy-case__when">{periodLabel}</span> : null}
      </div>
    </li>
  )
}

export function TrophyCase({ name }: { name: string }) {
  const [trophies, setTrophies] = useState<TrophyAward[] | null>(null)

  useEffect(() => {
    if (!name) {
      setTrophies([])
      return
    }
    let cancelled = false
    void fetchTrophies(name).then((rows) => {
      if (!cancelled) setTrophies(rows)
    })
    return () => {
      cancelled = true
    }
  }, [name])

  if (trophies === null) {
    return (
      <section className="trophy-case" aria-label="Trophies" aria-busy="true">
        <TrophyHeader summary={null} />
        <TrophySkeleton />
      </section>
    )
  }

  const summary = summarizeTrophies(trophies)
  /*
   * Every period has to be listed, not an allow-list of two: event wins were
   * counted in the summary and then filtered out of the grid, so the header
   * claimed five podiums above a case holding one.
   */
  const sorted = [
    ...sortTrophies(trophies.filter((t) => t.period === 'event')),
    ...sortTrophies(trophies.filter((t) => t.period === 'monthly')),
    ...sortTrophies(trophies.filter((t) => t.period === 'weekly')),
  ]

  return (
    <section className="trophy-case" aria-label="Trophies">
      <TrophyHeader summary={summary} />

      {trophies.length === 0 ? (
        <div className="trophy-case__panel trophy-case__empty">
          <p className="trophy-case__empty-title">No trophies yet</p>
          <p className="trophy-case__empty-copy">
            Win an event, or finish in the global top 10 at the end of a week or month.
          </p>
          <ul className="trophy-case__legend" aria-label="Trophy tiers">
            <li>
              <MonthlyTrophyCup tone="gold" />
              <span>Win an event — cup</span>
            </li>
            <li>
              <WeeklyMedal rank={1} />
              <span>Weekly top 3 — medal</span>
            </li>
            <li>
              <TopTenRibbon tone="weekly" />
              <span>Weekly #4–10 — blue ribbon</span>
            </li>
            <li>
              <MonthlyTrophyCup tone="gold" />
              <span>Monthly top 3 — cup</span>
            </li>
            <li>
              <TopTenRibbon tone="monthly" />
              <span>Monthly #4–10 — violet ribbon</span>
            </li>
          </ul>
        </div>
      ) : (
        <ul className="trophy-case__grid">
          {sorted.map((trophy) => (
            <TrophyCard key={trophy.id} trophy={trophy} />
          ))}
        </ul>
      )}
    </section>
  )
}

function TrophyHeader({
  summary,
}: {
  summary: ReturnType<typeof summarizeTrophies> | null
}) {
  return (
    <header className="trophy-case__head">
      <div className="trophy-case__titles">
        <h2 className="rank-page__h">Trophies</h2>
        <p className="trophy-case__sub">Events won, and past weekly and monthly boards</p>
      </div>
      {summary && summary.total > 0 ? (
        <div className="trophy-case__chips" aria-label="Trophy summary">
          {summary.events > 0 ? (
            <span className="trophy-case__chip trophy-case__chip--event">
              {summary.events} event{summary.events === 1 ? '' : 's'} won
            </span>
          ) : null}
          {summary.podium > 0 ? (
            <span className="trophy-case__chip trophy-case__chip--podium">
              {summary.podium} podium
            </span>
          ) : null}
          {summary.topTen > 0 ? (
            <span className="trophy-case__chip trophy-case__chip--top10">
              {summary.topTen} top 10
            </span>
          ) : null}
        </div>
      ) : null}
    </header>
  )
}
