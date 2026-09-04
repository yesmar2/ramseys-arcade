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

type MetalTone = 'gold' | 'silver' | 'bronze'

/** Monthly podium award — a cup. Shapes overlap so the silhouette reads as one piece. */
function MonthlyTrophyCup({ tone }: { tone: MetalTone }) {
  return (
    <span className={`trophy-case__cup trophy-case__cup--${tone}`} aria-hidden="true">
      <svg viewBox="0 0 64 72" width="64" height="72" focusable="false">
        <path
          className="trophy-case__cup-handle"
          d="M16.8 16.5c-9 0-11.8 4.6-10 9.2 1.4 3.6 5.4 5.6 10.2 5.8"
        />
        <path
          className="trophy-case__cup-handle"
          d="M47.2 16.5c9 0 11.8 4.6 10 9.2-1.4 3.6-5.4 5.6-10.2 5.8"
        />
        <path
          className="trophy-case__cup-bowl"
          d="M16.8 12h30.4v3.8c0 10.2-6.1 18.4-13.7 20.6V42h-3v-5.6C22.9 34.2 16.8 26 16.8 15.8V12Z"
        />
        <path
          className="trophy-case__cup-rim"
          d="M14.5 8h35a1.6 1.6 0 0 1 1.6 1.6v3.2H12.9V9.6A1.6 1.6 0 0 1 14.5 8Z"
        />
        <path
          className="trophy-case__cup-shine"
          d="M21.5 14.6h9c.5 0 .85.5.66.96L28 24.4h-8.1c-.5 0-.84-.5-.66-.96L21.5 14.6Z"
        />
        <path className="trophy-case__cup-stem" d="M28.6 40h6.8v8h-6.8z" />
        <path className="trophy-case__cup-knob" d="M25 46.4h14v3.6H25z" />
        <path className="trophy-case__cup-cone" d="M26 49.2h12l4.5 8.4h-21z" />
        <path className="trophy-case__cup-base" d="M20 56.4h24v4.4H20z" />
        <path
          className="trophy-case__cup-foot"
          d="M16.4 59.8h31.2a1.6 1.6 0 0 1 1.6 1.6v3.8H14.8v-3.8a1.6 1.6 0 0 1 1.6-1.6Z"
        />
      </svg>
    </span>
  )
}

/** Weekly podium award — a medal hanging from a blue neck ribbon. */
function WeeklyMedal({ rank }: { rank: number }) {
  const tone = medalKind(rank) ?? 'gold'
  return (
    <span
      className={`trophy-case__medal trophy-case__medal--${tone}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 72" width="64" height="72" focusable="false">
        <path className="trophy-case__medal-strap" d="M23.5 5h17l-3.5 32h-10z" />
        <path
          className="trophy-case__medal-strap trophy-case__medal-strap--fold"
          d="M32 5h8.5L37 37h-5z"
        />
        <path
          className="trophy-case__medal-clasp"
          d="M22 3h20a1.8 1.8 0 0 1 1.8 1.8v3.4H20.2V4.8A1.8 1.8 0 0 1 22 3Z"
        />
        <circle className="trophy-case__medal-disk" cx="32" cy="47.5" r="15.5" />
        <circle className="trophy-case__medal-ring" cx="32" cy="47.5" r="11.8" />
        <text className="trophy-case__medal-num" x="32" y="54.2" textAnchor="middle">
          {rank}
        </text>
      </svg>
    </span>
  )
}

function TrophyIcon({ rank, period }: { rank: number; period: TrophyPeriod }) {
  const podium = medalKind(rank) != null
  if (period === 'monthly') {
    if (podium) return <MonthlyTrophyCup tone={medalKind(rank) ?? 'gold'} />
    return <TopTenRibbon tone="monthly" />
  }
  if (podium) return <WeeklyMedal rank={rank} />
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
