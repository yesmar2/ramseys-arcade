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

function TrophyIcon({ rank }: { rank: number }) {
  const kind = medalKind(rank)
  if (kind) return <PodiumMedal kind={kind} />
  return <TopTenRibbon />
}

function groupLabel(period: TrophyPeriod) {
  return period === 'monthly' ? 'Monthly' : 'Weekly'
}

function TrophySkeleton() {
  return (
    <div className="trophy-case__groups" aria-hidden="true">
      <ul className="trophy-case__grid">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className="trophy-case__skel">
            <span className="trophy-case__skel-medal" />
            <span className="trophy-case__skel-line trophy-case__skel-line--short" />
            <span className="trophy-case__skel-line" />
          </li>
        ))}
      </ul>
    </div>
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
  const monthly = sortTrophies(trophies.filter((t) => t.period === 'monthly'))
  const weekly = sortTrophies(trophies.filter((t) => t.period === 'weekly'))

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
              <span>Top 3 — podium</span>
            </li>
            <li>
              <TopTenRibbon />
              <span>#4–10 — top 10</span>
            </li>
          </ul>
        </div>
      ) : (
        <div className="trophy-case__groups">
          {monthly.length > 0 ? (
            <TrophyGroup period="monthly" label={groupLabel('monthly')} trophies={monthly} />
          ) : null}
          {weekly.length > 0 ? (
            <TrophyGroup period="weekly" label={groupLabel('weekly')} trophies={weekly} />
          ) : null}
        </div>
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

function TrophyGroup({
  period,
  label,
  trophies,
}: {
  period: TrophyPeriod
  label: string
  trophies: TrophyAward[]
}) {
  return (
    <div className={`trophy-case__group trophy-case__group--${period}`}>
      <h3 className="trophy-case__group-title">{label}</h3>
      <ul className="trophy-case__grid">
        {trophies.map((trophy) => {
          const periodLabel = formatTrophyPeriod(trophy.period, trophy.periodKey)
          const podium = trophy.rank <= 3
          return (
            <li key={trophy.id}>
              <a
                className={[
                  'trophy-case__card',
                  `trophy-case__card--${period}`,
                  podium ? 'trophy-case__card--podium' : 'trophy-case__card--top10',
                  podium ? `trophy-case__card--place-${trophy.rank}` : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                href={globalRankingsHref(trophy.period)}
                aria-label={`#${trophy.rank} global, ${periodLabel}, ${trophy.score} points`}
              >
                <span className="trophy-case__icon">
                  <TrophyIcon rank={trophy.rank} />
                </span>
                <span className="trophy-case__rank">#{trophy.rank}</span>
                <span className="trophy-case__period">{periodLabel}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
