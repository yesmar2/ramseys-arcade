import { useEffect, useState } from 'react'
import { globalRankingsHref } from '../hooks/useHashRoute'
import {
  fetchTrophies,
  formatTrophyPeriod,
  trophyRankLabel,
  type TrophyAward,
  type TrophyPeriod,
} from '../lib/trophies'
import { medalKind, PodiumMedal } from './PodiumMedal'

function TopTenRibbon() {
  return (
    <span className="trophy-case__ribbon" aria-hidden="true">
      <svg viewBox="0 0 20 24" width="16" height="19" focusable="false">
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
  return period === 'monthly' ? 'Monthly global rank' : 'Weekly global rank'
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
      <section className="trophy-case trophy-case--loading" aria-label="Global rank trophies">
        <h2 className="rank-page__h">Global rank trophies</h2>
        <p className="trophy-case__empty">Loading trophies…</p>
      </section>
    )
  }

  if (trophies.length === 0) {
    return (
      <section className="trophy-case" aria-label="Global rank trophies">
        <h2 className="rank-page__h">Global rank trophies</h2>
        <p className="trophy-case__empty">
          No trophies yet. Finish in the global top 10 for a week or month to earn one.
        </p>
      </section>
    )
  }

  const monthly = trophies.filter((t) => t.period === 'monthly')
  const weekly = trophies.filter((t) => t.period === 'weekly')

  return (
    <section className="trophy-case" aria-label="Global rank trophies">
      <h2 className="rank-page__h">Global rank trophies</h2>
      <p className="trophy-case__blurb">
        {trophies.length} trophy{trophies.length === 1 ? '' : 'ies'} — podium for top 3, ribbon for
        top 10.
      </p>
      {monthly.length > 0 ? (
        <TrophyGroup label={groupLabel('monthly')} trophies={monthly} />
      ) : null}
      {weekly.length > 0 ? (
        <TrophyGroup label={groupLabel('weekly')} trophies={weekly} />
      ) : null}
    </section>
  )
}

function TrophyGroup({ label, trophies }: { label: string; trophies: TrophyAward[] }) {
  return (
    <div className="trophy-case__group">
      <h3 className="trophy-case__group-title">{label}</h3>
      <ul className="trophy-case__list">
        {trophies.map((trophy) => {
          const periodLabel = formatTrophyPeriod(trophy.period, trophy.periodKey)
          const rankLabel = trophyRankLabel(trophy.rank)
          return (
            <li key={trophy.id}>
              <a
                className={`trophy-case__item trophy-case__item--${trophy.period}${trophy.rank <= 3 ? ' trophy-case__item--podium' : ''}`}
                href={globalRankingsHref(trophy.period)}
                aria-label={`${rankLabel}, ${periodLabel}, ${trophy.score} points`}
              >
                <span className="trophy-case__icon">
                  <TrophyIcon rank={trophy.rank} />
                </span>
                <span className="trophy-case__main">
                  <span className="trophy-case__game">{rankLabel}</span>
                  <span className="trophy-case__period">{periodLabel}</span>
                </span>
                <span className="trophy-case__score">
                  <strong>{trophy.score.toLocaleString()}</strong>
                  <span>pts</span>
                </span>
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
