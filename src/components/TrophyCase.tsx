import { useEffect, useState } from 'react'
import { getGame } from '../data/games'
import { gameBoardHref } from '../hooks/useHashRoute'
import {
  fetchTrophies,
  formatTrophyPeriod,
  type TrophyAward,
  type TrophyPeriod,
} from '../lib/trophies'
import { PodiumMedal } from './PodiumMedal'

function TrophyCup({ large }: { large?: boolean }) {
  const size = large ? 28 : 20
  return (
    <span
      className={`trophy-case__cup${large ? ' trophy-case__cup--large' : ''}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 28" width={size} height={size + 4} focusable="false">
        <path
          className="trophy-case__cup-body"
          d="M5 3.5h14v6.5c0 3.6-2.4 6.7-6 7.8-3.6-1.1-6-4.2-6-7.8V3.5Z"
        />
        <path className="trophy-case__cup-handle" d="M5 5.5H2.8a2.2 2.2 0 0 0 0 4.4H5" />
        <path className="trophy-case__cup-handle" d="M19 5.5h2.2a2.2 2.2 0 0 1 0 4.4H19" />
        <path className="trophy-case__cup-stem" d="M10.5 17.8h3v3.2H8.8l-.8 3.5h7.8l-.8-3.5h-4.5z" />
        <rect className="trophy-case__cup-base" x="6.5" y="24.2" width="11" height="2.3" rx="1" />
      </svg>
    </span>
  )
}

function TrophyIcon({ period }: { period: TrophyPeriod }) {
  if (period === 'monthly') return <TrophyCup large />
  return <PodiumMedal kind="gold" />
}

function groupLabel(period: TrophyPeriod) {
  return period === 'monthly' ? 'Monthly champions' : 'Weekly champions'
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
      <section className="trophy-case trophy-case--loading" aria-label="Trophy case">
        <h2 className="rank-page__h">Trophy case</h2>
        <p className="trophy-case__empty">Loading trophies…</p>
      </section>
    )
  }

  if (trophies.length === 0) {
    return (
      <section className="trophy-case" aria-label="Trophy case">
        <h2 className="rank-page__h">Trophy case</h2>
        <p className="trophy-case__empty">
          No trophies yet. Finish #1 on a weekly or monthly board to earn one.
        </p>
      </section>
    )
  }

  const monthly = trophies.filter((t) => t.period === 'monthly')
  const weekly = trophies.filter((t) => t.period === 'weekly')

  return (
    <section className="trophy-case" aria-label="Trophy case">
      <h2 className="rank-page__h">Trophy case</h2>
      <p className="trophy-case__blurb">
        {monthly.length + weekly.length} trophy{monthly.length + weekly.length === 1 ? '' : 'ies'}{' '}
        — weekly #1 and monthly #1 per game.
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
          const game = getGame(trophy.game)
          const periodLabel = formatTrophyPeriod(trophy.period, trophy.periodKey)
          return (
            <li key={trophy.id}>
              <a
                className={`trophy-case__item trophy-case__item--${trophy.period}`}
                href={gameBoardHref(trophy.game, trophy.period)}
                aria-label={`${game?.name ?? trophy.game} ${trophy.period} champion, ${periodLabel}, score ${trophy.score}`}
              >
                <span className="trophy-case__icon">
                  <TrophyIcon period={trophy.period} />
                </span>
                <span className="trophy-case__main">
                  <span className="trophy-case__game">{game?.name ?? trophy.game}</span>
                  <span className="trophy-case__period">{periodLabel}</span>
                </span>
                <span className="trophy-case__score">{trophy.score.toLocaleString()}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
