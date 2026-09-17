import { useEffect, useState, type CSSProperties } from 'react'
import { PageShell } from '../components/PageShell'
import { PageBackLink } from '../components/PageBackLink'
import { getGame } from '../data/games'
import { gameHubHref, plusHref, rankHref, recordHref } from '../hooks/useHashRoute'
import { useAuth } from '../hooks/useAuth'
import { resolveGameAccent } from '../lib/theme'
import { PLUS_PRICE } from '../lib/plans'
import {
  dateToDayKey,
  dayKeyToDate,
  fetchMyStats,
  formatRecordValue,
  type GameStat,
  type NearRecord,
  type StatsResponse,
} from '../lib/stats'

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="st-tile">
      <strong className="st-tile__value">{value}</strong>
      <span className="st-tile__label">{label}</span>
    </div>
  )
}

/**
 * Best-per-day as a sparkline.
 *
 * Drawn from the values themselves rather than a library: a handful of points
 * on one scale does not need one, and a chart that ships with the page cannot
 * fail to load.
 */
function Trend({ points, accent }: { points: { at: number; score: number }[]; accent: string }) {
  if (points.length < 2) return null
  const w = 120
  const h = 32
  const scores = points.map((p) => p.score)
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const span = max - min || 1
  const step = w / (points.length - 1)
  const path = points
    .map((p, i) => {
      const x = i * step
      const y = h - ((p.score - min) / span) * (h - 4) - 2
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      className="st-trend"
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      role="img"
      aria-label={`Best per day, ${points.length} days`}
      preserveAspectRatio="none"
    >
      <path d={path} fill="none" stroke={accent} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

function GameRow({ stat }: { stat: GameStat }) {
  const game = getGame(stat.slug)
  const accent = resolveGameAccent(stat.slug, game?.accent ?? 'var(--accent)')
  return (
    <li className="st-game" style={{ '--st-accent': accent } as CSSProperties}>
      <a className="st-game__main" href={gameHubHref(stat.slug, 'all')}>
        <span className="st-game__name">{game?.name ?? stat.slug}</span>
        <span className="st-game__meta">
          {stat.runs} run{stat.runs === 1 ? '' : 's'} · best {stat.best.toLocaleString()} ·
          avg {stat.average.toLocaleString()}
        </span>
      </a>
      <Trend points={stat.trend} accent={accent} />
      <span className="st-game__figures">
        <span className="st-game__rank">
          {stat.rank != null ? `#${stat.rank}` : '—'}
          <span className="st-game__of">of {stat.totalPlayers}</span>
        </span>
        <span className="st-game__pct" title="Share of every run on this board your best beats">
          {stat.percentile}%
        </span>
      </span>
    </li>
  )
}

function NearRow({ rec }: { rec: NearRecord }) {
  const game = getGame(rec.game)
  const accent = resolveGameAccent(rec.game, game?.accent ?? 'var(--accent)')
  const verb = rec.direction === 'lower' ? 'under' : 'over'
  return (
    <li className="st-near" style={{ '--st-accent': accent } as CSSProperties}>
      <a className="st-near__link" href={recordHref(rec.game, rec.recordId, 'all')}>
        <span className="st-near__head">
          <span className="st-near__label">{rec.label}</span>
          <span className="st-near__game">{game?.name ?? rec.game}</span>
        </span>
        <span className="st-near__bar" aria-hidden="true">
          <span className="st-near__fill" style={{ width: `${rec.closeness}%` }} />
        </span>
        <span className="st-near__nums">
          <span>
            You {formatRecordValue(rec.yourBest, rec.unit)}
          </span>
          <span className="st-near__need">
            {verb} {formatRecordValue(rec.leader, rec.unit)} to take it from {rec.leaderName}
          </span>
        </span>
      </a>
    </li>
  )
}

/** The last 12 weeks, so a streak has somewhere to show. */
function Calendar({ days }: { days: number[] }) {
  const have = new Set(days)
  const today = new Date()
  const cells: { key: number; on: boolean }[] = []
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = dateToDayKey(d)
    cells.push({ key, on: have.has(key) })
  }
  return (
    <div className="st-cal" role="img" aria-label={`${days.length} days played in the last 12 weeks`}>
      {cells.map((cell) => (
        <span
          key={cell.key}
          className={`st-cal__day${cell.on ? ' st-cal__day--on' : ''}`}
          title={dayKeyToDate(cell.key).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        />
      ))}
    </div>
  )
}

function Locked({ what }: { what: string }) {
  return (
    <div className="st-locked">
      <p className="st-locked__what">{what}</p>
      <a className="st-locked__cta" href={plusHref()}>
        Plus · {PLUS_PRICE}
      </a>
    </div>
  )
}

/**
 * Your own numbers, over time.
 *
 * The boards stay free — they are the game. This is the part a board cannot
 * show: how you got here, how you compare to every run ever posted, and which
 * record is within reach. Free sees the headline, which is what makes the rest
 * worth having.
 */
export function StatsPage() {
  const { signedIn, loading: authLoading } = useAuth()
  const [data, setData] = useState<StatsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!signedIn) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void fetchMyStats()
      .then((body) => {
        if (!cancelled) setData(body)
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [signedIn])

  const stats = data?.stats
  const locked = Boolean(data?.locked)

  return (
    <PageShell innerClassName="lb-page__inner">
      <header className="lb-page__header lb-page__header--compact">
        <div className="lb-page__heading-row">
          <PageBackLink href={rankHref()} label="Back to profile" />
          <h1 className="lb-page__title">Your stats</h1>
          <span className="lb-page__heading-slot" aria-hidden="true" />
        </div>
      </header>

      {authLoading || loading ? (
        <p className="st-note">Loading…</p>
      ) : !signedIn ? (
        <p className="st-note">Sign in to see your stats.</p>
      ) : !stats || stats.headline.runs === 0 ? (
        <p className="st-note">
          Play a game and your numbers will start showing up here.
        </p>
      ) : (
        <>
          <section className="st-tiles" aria-label="Totals">
            <Tile value={stats.headline.runs.toLocaleString()} label="Runs" />
            <Tile value={String(stats.streak.current)} label="Day streak" />
            <Tile value={String(stats.streak.best)} label="Best streak" />
            <Tile value={String(stats.headline.games)} label="Games played" />
          </section>

          <section className="st-block" aria-labelledby="st-cal-title">
            <h2 className="st-block__title" id="st-cal-title">
              When you play
            </h2>
            {locked ? (
              <Locked what="See every day you have played, and the streaks behind them." />
            ) : (
              <Calendar days={stats.streak.days} />
            )}
          </section>

          <section className="st-block" aria-labelledby="st-near-title">
            <h2 className="st-block__title" id="st-near-title">
              Closest records
            </h2>
            <p className="st-block__blurb">
              Boards you are on but not top of, nearest first.
            </p>
            {locked ? (
              <Locked what="See which records you are closest to taking, and by how much." />
            ) : stats.nearRecords.length === 0 ? (
              <p className="st-note">
                Post a record score and the ones within reach will show up here.
              </p>
            ) : (
              <ul className="st-nears">
                {stats.nearRecords.map((rec) => (
                  <NearRow key={`${rec.game}-${rec.recordId}`} rec={rec} />
                ))}
              </ul>
            )}
          </section>

          <section className="st-block" aria-labelledby="st-games-title">
            <h2 className="st-block__title" id="st-games-title">
              By game
            </h2>
            <p className="st-block__blurb">
              Where your best sits, and how it has moved.
            </p>
            {locked ? (
              <Locked what="See your rank, your percentile and your trend on every game." />
            ) : (
              <ul className="st-games">
                {stats.games.map((stat) => (
                  <GameRow key={stat.slug} stat={stat} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </PageShell>
  )
}
