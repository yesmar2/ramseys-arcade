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
      <svg viewBox="0 0 64 72" width="64" height="72" focusable="false">
        <path
          className="trophy-case__cup-handle"
          fill="none"
          strokeWidth="3.2"
          strokeLinecap="round"
          d="M18 15c-6.8.4-10.8 4.6-10.8 9.8 0 5.2 3.6 9 9.4 9.6"
        />
        <path
          className="trophy-case__cup-handle"
          fill="none"
          strokeWidth="3.2"
          strokeLinecap="round"
          d="M46 15c6.8.4 10.8 4.6 10.8 9.8 0 5.2-3.6 9-9.4 9.6"
        />
        <path
          className="trophy-case__cup-bowl"
          d="M17 11.2c0-.9.7-1.6 1.6-1.6h26.8c.9 0 1.6.7 1.6 1.6v1.8c0 9.6-5.4 17.4-13.8 20.4v6.4h-2.8v-6.4C22.4 30.4 17 22.6 17 13V11.2Z"
        />
        <path
          className="trophy-case__cup-rim"
          d="M15.5 9h33c.8 0 1.4.6 1.4 1.4v1.3H14.1V10.4c0-.8.6-1.4 1.4-1.4Z"
        />
        <path
          className="trophy-case__cup-shine"
          d="M22 13.4h9.2c.5 0 .9.5.7 1L29.4 23h-8.2c-.5 0-.75-.55-.5-.95L22 13.4Z"
        />
        <path className="trophy-case__cup-stem" d="M29.4 41h5.2v7.4h-5.2z" />
        <path className="trophy-case__cup-knob" d="M26.8 47.8h10.4v3h-10.4z" />
        <path className="trophy-case__cup-base" d="M22.5 55.5h19v3.4h-19z" />
        <path className="trophy-case__cup-plinth" d="M18 58.9h28v4.8H18z" />
        <path className="trophy-case__cup-foot" d="M15.2 63.7h33.6v3.6H15.2z" />
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
