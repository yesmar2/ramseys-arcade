import { useEffect, useState } from 'react'
import { globalRankingsHref } from '../hooks/useHashRoute'
import {
  fetchTrophies,
  formatTrophyPeriod,
  sortTrophies,
  summarizeTrophies,
  type TrophyAward,
  type TrophyPeriod,
} from '../lib/trophies'
import { medalKind, PodiumMedal } from './PodiumMedal'

function TopTenRibbon() {
  return (
    <span className="trophy-case__ribbon" aria-hidden="true">
      <svg viewBox="0 0 20 24" width="28" height="33" focusable="false">
        <path className="trophy-case__ribbon-band" d="M4 1.5h12v5.5H4Z" />
        <path className="trophy-case__ribbon-tail" d="m5.5 7 2.2 14.5L10 16l2.3 5.5L14.5 7Z" />
      </svg>
    </span>
  )
}

function MonthlyTrophyCup({ rank }: { rank: number }) {
  const tone =
    rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'honor'
  return (
    <span className={`trophy-case__cup trophy-case__cup--${tone}`} aria-hidden="true">
      <svg viewBox="0 0 24 28" width="34" height="40" focusable="false">
        <path
          className="trophy-case__cup-bowl"
          d="M5 2.5h14v6.8c0 3.6-2.4 6.8-6 7.8-3.6-1-6-4.2-6-7.8V2.5Z"
        />
        <path className="trophy-case__cup-handle" d="M5 4.8H3.2a2 2 0 0 0 0 4H5" />
        <path className="trophy-case__cup-handle" d="M19 4.8h1.8a2 2 0 0 1 0 4H19" />
        <path className="trophy-case__cup-stem" d="M10.5 16.8h3v2.8H9.8l-.7 3.2h5.8l-.7-3.2h-3.7z" />
        <path className="trophy-case__cup-base" d="M7.5 24.5h9v2H7.5z" />
      </svg>
    </span>
  )
}

function TrophyIcon({ rank, period }: { rank: number; period: TrophyPeriod }) {
  if (period === 'monthly') return <MonthlyTrophyCup rank={rank} />
  const kind = medalKind(rank)
  if (kind) return <PodiumMedal kind={kind} />
  return <TopTenRibbon />
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
  const podium = trophy.rank <= 3
  return (
    <li>
      <a
        className={[
          'trophy-case__card',
          `trophy-case__card--${trophy.period}`,
          podium ? 'trophy-case__card--podium' : 'trophy-case__card--top10',
          podium ? `trophy-case__card--place-${trophy.rank}` : '',
        ]
          .filter(Boolean)
          .join(' ')}
        href={globalRankingsHref(trophy.period)}
        aria-label={`#${trophy.rank} global, ${periodLabel}, ${trophy.score} points`}
      >
        <span
          className={`trophy-case__badge trophy-case__badge--${trophy.period}`}
        >
          {trophy.period === 'monthly' ? 'Monthly' : 'Weekly'}
        </span>
        <span className="trophy-case__icon">
          <TrophyIcon rank={trophy.rank} period={trophy.period} />
        </span>
        <span className="trophy-case__rank">#{trophy.rank}</span>
        <span className="trophy-case__period">{periodLabel}</span>
      </a>
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
  const sorted = [
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
            Finish in the global top 10 at the end of a week or month to earn one.
          </p>
          <ul className="trophy-case__legend" aria-label="Trophy tiers">
            <li>
              <PodiumMedal kind="gold" />
              <span>Weekly top 3 — medal</span>
            </li>
            <li>
              <TopTenRibbon />
              <span>Weekly #4–10 — ribbon</span>
            </li>
            <li>
              <MonthlyTrophyCup rank={1} />
              <span>Monthly — trophy cup</span>
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
      <h2 className="rank-page__h">Trophies</h2>
      {summary && summary.total > 0 ? (
        <div className="trophy-case__chips" aria-label="Trophy summary">
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
