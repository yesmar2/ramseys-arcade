import { useEffect, useState, type CSSProperties } from 'react'
import { BoardSkeleton, PeriodSwitcher } from '../components/BoardChrome'
import { GameThumbArt } from '../components/GameThumbArt'
import { PageBanner } from '../components/PageBanner'
import { PageShell } from '../components/PageShell'
import { PlayerAvatar } from '../components/PlayerAvatar'
import { getGame } from '../data/games'
import { gameHubHref, plusHref, rankHref, recordHref } from '../hooks/useHashRoute'
import { useAuth } from '../hooks/useAuth'
import { usePlayerName } from '../hooks/usePlayerName'
import { AVATARS_ENABLED, avatarWashColor, getLocalAvatarId, resolveAvatar } from '../lib/avatars'
import { setDefaultPeriod, useDefaultPeriod } from '../lib/defaultPeriod'
import { useGlobalRank } from '../lib/globalRank'
import { normalizePlayerName, PERIOD_LABELS, type LeaderboardPeriod } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { PLUS_PRICE } from '../lib/plans'
import { resolveGameAccent } from '../lib/theme'
import {
  dateToDayKey,
  dayKeyToDate,
  fetchMyStats,
  formatRecordValue,
  type GameStat,
  type NearRecord,
  type StatsResponse,
} from '../lib/stats'

const CALENDAR_DAYS = 84

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

/** "today", "yesterday", "5 days ago", then a date. */
function whenPlayed(at: number): string {
  const days = Math.floor((Date.now() - at) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function GameRow({ stat, period }: { stat: GameStat; period: LeaderboardPeriod }) {
  const game = getGame(stat.slug)
  const accent = resolveGameAccent(stat.slug, game?.accent ?? 'var(--accent)')
  const podium = stat.rank != null && stat.rank <= 3
  return (
    <li className="st-game" style={{ '--st-accent': accent } as CSSProperties}>
      <a className="st-game__link" href={gameHubHref(stat.slug, period)}>
        <GameThumbArt slug={stat.slug} accent={accent} />
        <span className="st-game__text">
          <span className="st-game__name">{game?.name ?? stat.slug}</span>
          <span className="st-game__meta">
            {stat.runs} {stat.runs === 1 ? 'run' : 'runs'} · best{' '}
            {formatLeaderboardScore(stat.slug, stat.best)} · avg{' '}
            {formatLeaderboardScore(stat.slug, stat.average)} · {whenPlayed(stat.lastPlayedAt)}
          </span>
        </span>
        <Trend points={stat.trend} accent={accent} />
        <span className="st-game__figures">
          <span className={`st-game__rank${podium ? ' st-game__rank--podium' : ''}`}>
            {stat.rank != null ? `#${stat.rank}` : '—'}
            <small> of {stat.totalPlayers.toLocaleString()}</small>
          </span>
          <span className="st-game__pct" title="Share of every run on this board your best beats">
            Beats {stat.percentile}%
          </span>
        </span>
      </a>
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
            You <b>{formatRecordValue(rec.yourBest, rec.unit)}</b>
          </span>
          <span className="st-near__need">
            {verb} <b>{formatRecordValue(rec.leader, rec.unit)}</b> to take it from {rec.leaderName}
          </span>
        </span>
      </a>
    </li>
  )
}

/** The last 12 weeks, one column per week, so a streak has somewhere to show. */
function Calendar({ days }: { days: number[] }) {
  const have = new Set(days)
  const today = new Date()
  const cells: { key: number; on: boolean }[] = []
  for (let i = CALENDAR_DAYS - 1; i >= 0; i--) {
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

function sinceWord(at: number | null): string {
  if (!at) return ''
  return ` since ${new Date(at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
}

/**
 * Your own numbers, over time.
 *
 * The boards stay free — they are the game. This is the part a board cannot
 * show: how you got here, how you compare to every run ever posted, and which
 * record is within reach. Free sees the headline, which is what makes the rest
 * worth having.
 *
 * Laid out like the rest of the site: your banner with the four totals as
 * its figures, the period under it, then the boards' split — the games you
 * have played in the main column, when you play and the records within
 * reach in the rail.
 */
export function StatsPage() {
  const { signedIn, loading: authLoading } = useAuth()
  const period = useDefaultPeriod()
  const name = normalizePlayerName(usePlayerName())
  const { avatarId: rankAvatarId } = useGlobalRank()
  // The page reads the app-wide timeframe, and setting it here sets it there:
  // the numbers below are the same boards, cut the same way.
  const selectPeriod = (next: LeaderboardPeriod) => setDefaultPeriod(next)
  const [data, setData] = useState<StatsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!signedIn) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void fetchMyStats(period)
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
  }, [signedIn, period])

  const isSignedIn = signedIn
  const busy = authLoading || loading
  const stats = data?.stats ?? null
  const locked = Boolean(data?.locked)
  const runs = stats?.headline.runs ?? 0
  const avatar =
    AVATARS_ENABLED && name ? resolveAvatar(getLocalAvatarId(name) ?? rankAvatarId, name) : null
  const accent = avatar ? avatarWashColor(avatar) : undefined
  const blurb = !isSignedIn
    ? 'Sign in to see how you got here: your streaks, your trends, and the records within reach.'
    : stats && runs > 0
      ? `${runs.toLocaleString()} ${runs === 1 ? 'run' : 'runs'} across ${stats.headline.games} ${
          stats.headline.games === 1 ? 'game' : 'games'
        }${sinceWord(stats.headline.firstPlayedAt)}.`
      : 'Play a game and your numbers will start showing up here.'

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      <div className="ev st">
        <PageBanner
          accent={accent}
          ariaLabel="Your stats"
          back={{ href: rankHref(), label: 'Profile' }}
          kicker={
            <>
              <span className="ev-kicker__bit">Your stats</span>
              <span className="ev-kicker__bit">{PERIOD_LABELS[period]}</span>
            </>
          }
          title={name || 'Your stats'}
          blurb={blurb}
          figures={
            stats && runs > 0 ? (
              <dl className="home-banner__figures" aria-label="Totals">
                <div className="home-banner__figure">
                  <dt>Runs</dt>
                  <dd>{runs.toLocaleString()}</dd>
                </div>
                <div className="home-banner__figure">
                  <dt>Day streak</dt>
                  <dd>{stats.streak.current}</dd>
                </div>
                <div className="home-banner__figure">
                  <dt>Best streak</dt>
                  <dd>{stats.streak.best}</dd>
                </div>
                <div className="home-banner__figure">
                  <dt>Games played</dt>
                  <dd>{stats.headline.games}</dd>
                </div>
              </dl>
            ) : undefined
          }
          art={
            avatar ? (
              <PlayerAvatar avatar={avatar} name={name} size="xl" />
            ) : (
              <span className="home-banner__glyph home-banner__glyph--faint">?</span>
            )
          }
        />

        {isSignedIn ? (
          <div className="st__controls">
            <PeriodSwitcher period={period} onSelect={selectPeriod} />
          </div>
        ) : null}

        {busy ? (
          <BoardSkeleton rows={5} />
        ) : !isSignedIn ? null : !stats || runs === 0 ? null : (
          <div className="split">
            <aside className="split__side" aria-label="When you play, and the records within reach">
              <section className="ev-card" aria-labelledby="st-cal-title">
                <div className="ev-card__head">
                  <h2 className="ev-card__title" id="st-cal-title">
                    When you play
                  </h2>
                  <p className="ev-card__note">
                    {stats.streak.days.length} of the last {CALENDAR_DAYS} days
                  </p>
                </div>
                <div className="ev-card__body">
                  {locked ? (
                    <Locked what="See every day you have played, and the streaks behind them." />
                  ) : (
                    <>
                      <Calendar days={stats.streak.days} />
                      <p className="st-cal__legend">
                        <b>{stats.streak.current}</b>-day streak · best <b>{stats.streak.best}</b>
                      </p>
                    </>
                  )}
                </div>
              </section>

              <section className="ev-card" aria-labelledby="st-near-title">
                <div className="ev-card__head">
                  <h2 className="ev-card__title" id="st-near-title">
                    Closest records
                  </h2>
                  <p className="ev-card__note">Nearest first</p>
                </div>
                <div className="ev-card__body">
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
                </div>
              </section>
            </aside>

            <div className="split__main">
              <section className="lst-block" aria-labelledby="st-games-title">
                <div className="lst-block__head">
                  <h2 className="lst-block__title" id="st-games-title">
                    By game
                  </h2>
                  <p className="lst-block__note">
                    {stats.games.length} {stats.games.length === 1 ? 'game' : 'games'} · where your
                    best sits, and how it has moved
                  </p>
                </div>
                {locked ? (
                  <div className="st-games">
                    <Locked what="See your rank, your percentile and your trend on every game." />
                  </div>
                ) : (
                  <ul className="st-games">
                    {stats.games.map((stat) => (
                      <GameRow key={stat.slug} stat={stat} period={period} />
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  )
}
