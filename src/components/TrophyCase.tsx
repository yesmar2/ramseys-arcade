import { useEffect, useState } from 'react'
import {
  fetchTrophies,
  formatTrophyPeriod,
  sortTrophies,
  summarizeTrophies,
  type TrophyAward,
  type TrophyPeriod,
} from '../lib/trophies'
import { medalKind, PodiumMedal } from './PodiumMedal'

type RibbonTone = 'weekly' | 'monthly'

/** Honor ribbon for global #4–10 — weekly blue, monthly violet. */
function TopTenRibbon({ tone = 'weekly' }: { tone?: RibbonTone }) {
  return (
    <span
      className={`trophy-case__ribbon trophy-case__ribbon--${tone}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 28 36" width="52" height="66" focusable="false">
        <path
          className="trophy-case__ribbon-band"
          d="M5 2h18c1.1 0 2 .9 2 2v7.5H3V4c0-1.1.9-2 2-2Z"
        />
        <path
          className="trophy-case__ribbon-shine"
          d="M7 3.2h6.5c.4 0 .7.4.55.75L12.2 9.2H6.4c-.35 0-.55-.4-.35-.7L7 3.2Z"
        />
        <path
          className="trophy-case__ribbon-tail"
          d="M5.2 11.5 9.6 33.2 14 22.8l4.4 10.4 4.4-21.7Z"
        />
        <path
          className="trophy-case__ribbon-notch"
          d="M14 22.8 9.6 33.2l4.4-4.2 4.4 4.2Z"
        />
      </svg>
    </span>
  )
}

type CupTone = 'gold' | 'silver' | 'bronze'

function MonthlyTrophyCup({ tone }: { tone: CupTone }) {
  return (
    <span className={`trophy-case__cup trophy-case__cup--${tone}`} aria-hidden="true">
      <svg viewBox="0 0 40 48" width="58" height="70" focusable="false">
        <path
          className="trophy-case__cup-bowl"
          d="M9 5h22v10.5c0 5.6-3.9 10.6-9.4 12.2C15.9 26.1 12 21.1 12 15.5V5H9Z"
        />
        <path
          className="trophy-case__cup-shine"
          d="M13.2 7.2h7.2c.45 0 .75.45.55.85l-2.1 5.4H12.5c-.4 0-.65-.45-.4-.8l1.1-5.45Z"
        />
        <path
          className="trophy-case__cup-handle"
          d="M9 8.2H5.8A3.4 3.4 0 0 0 5.8 15H9"
        />
        <path
          className="trophy-case__cup-handle"
          d="M31 8.2h3.2A3.4 3.4 0 0 1 34.2 15H31"
        />
        <path className="trophy-case__cup-stem" d="M17.4 27.5h5.2v4.2h-5.2z" />
        <path className="trophy-case__cup-knob" d="M16.2 31.5h7.6v2.2h-7.6z" />
        <path className="trophy-case__cup-base" d="M12.5 40.2h15v3.2h-15z" />
        <path className="trophy-case__cup-plinth" d="M10.2 43.2h19.6v2.6H10.2z" />
      </svg>
    </span>
  )
}

function TrophyIcon({ rank, period }: { rank: number; period: TrophyPeriod }) {
  const kind = medalKind(rank)
  if (period === 'monthly') {
    if (kind) return <MonthlyTrophyCup tone={kind} />
    return <TopTenRibbon tone="monthly" />
  }
  if (kind) return <PodiumMedal kind={kind} />
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
