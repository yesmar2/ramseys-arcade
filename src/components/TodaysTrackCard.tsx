import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { dailyTrack, nextTrackAt, trackDay } from '../games/hotlap/daily'
import { buildTrack, HALF_WIDTH, type Piece, type TrackShape } from '../games/hotlap/sim'
import { gamePlayHref } from '../hooks/useHashRoute'
import { usePersonalBest } from '../hooks/usePersonalBest'
import { usePlayerName } from '../hooks/usePlayerName'
import { inkOn } from '../lib/color'
import { playersFromRuns } from '../lib/gameBoard'
import { getLeaderboard, normalizePlayerName } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { ordinal } from '../lib/profileMath'
import { resolveGameAccent } from '../lib/theme'
import { PlayIcon } from './chromeIcons'
import { EventCountdown } from './EventCountdown'
import { GameThumbArt } from './GameThumbArt'
import '../styles/evp.css'
import '../styles/todaysTrack.css'

/*
 * Today's Track, off the track: Hot Lap's track of the day drawn from above, how the day's board stands,
 * and the way in. The card sits with the daily events on the Events page and on Hot Lap's own page; its
 * slimmer twin is on the home page's On now. Both come in a chunk of their own, with the plan.
 */

const SLUG = 'hotlap'

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)

/** The day on the boards' clock, moved on at midnight while the page is open. */
function useTrackDay(): string {
  const [day, setDay] = useState(trackDay)
  useEffect(() => {
    const timer = window.setInterval(() => setDay(trackDay()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  return day
}

type TodayBoard = {
  /** Players on today's board, at their best laps. */
  count: number
  leader: { name: string; score: number } | null
  you: { place: number; score: number } | null
}

/** Today's board, fetched again when the day turns or your best today changes. */
function useTodayBoard(day: string, me: string): TodayBoard | null {
  const [board, setBoard] = useState<TodayBoard | null>(null)
  const best = usePersonalBest(SLUG)
  useEffect(() => {
    let cancelled = false
    getLeaderboard(SLUG, 'daily', me || undefined, { limit: 100 })
      .then(({ entries, you }) => {
        if (cancelled) return
        const players = playersFromRuns(entries)
        const top = players[0]
        const mine = me ? players.find((p) => p.name === me) : undefined
        setBoard({
          count: players.length,
          leader: top ? { name: top.name, score: top.best.score } : null,
          you: mine ? { place: mine.place, score: mine.best.score } : you ? { place: you.rank, score: you.score } : null,
        })
      })
      .catch(() => {
        if (!cancelled) setBoard(null)
      })
    return () => {
      cancelled = true
    }
  }, [day, me, best])
  return board
}

const lap = (score: number) => formatLeaderboardScore(SLUG, score)

/** Where the day's board stands, and where you are on it. */
function standingWords(board: TodayBoard | null): string {
  if (!board) return ''
  const { count, leader, you } = board
  if (you && you.place === 1) {
    return count > 1 ? `You lead today with ${lap(you.score)}, of ${count} drivers.` : `You lead today with ${lap(you.score)}.`
  }
  if (you) {
    const leads = leader ? ` ${leader.name} leads with ${lap(leader.score)}.` : ''
    return `You’re ${ordinal(you.place)} of ${count} today, on ${lap(you.score)}.${leads}`
  }
  if (leader) {
    return `${leader.name} leads with ${lap(leader.score)}${count > 1 ? `, of ${count} drivers so far` : ''}.`
  }
  return 'Nobody has set a time yet: the first lap sets the bar.'
}

/** The track from above: grass, the road with its white edges, and the start line. */
function TrackPlan({ pieces, shape }: { pieces: Piece[]; shape: TrackShape }) {
  const plan = useMemo(() => {
    // Turned as it lies on the map; its hills don't show from above.
    const track = buildTrack(pieces, { heading: shape.heading })
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (let i = 0; i < track.n; i++) {
      minX = Math.min(minX, track.x[i]!)
      maxX = Math.max(maxX, track.x[i]!)
      minY = Math.min(minY, -track.y[i]!)
      maxY = Math.max(maxY, -track.y[i]!)
    }
    const size = Math.max(maxX - minX, maxY - minY)
    const pad = size * 0.16
    const stride = Math.max(1, Math.round(track.n / 420))
    const points: string[] = []
    for (let i = 0; i < track.n; i += stride) points.push(`${track.x[i]!.toFixed(1)} ${(-track.y[i]!).toFixed(1)}`)
    // The road a little wider than it is, so a big track still reads as a road.
    const road = Math.max(HALF_WIDTH * 2, size / 70)
    const s = track.startIndex
    const sx = track.x[s]!
    const sy = -track.y[s]!
    const h = track.h[s]!
    // Across the road at the start, on the screen's y (down).
    const nx = -Math.sin(-h)
    const ny = Math.cos(-h)
    const half = road * 0.62
    return {
      viewBox: `${(minX - pad).toFixed(1)} ${(minY - pad).toFixed(1)} ${(maxX - minX + pad * 2).toFixed(1)} ${(maxY - minY + pad * 2).toFixed(1)}`,
      d: `M${points.join('L')}Z`,
      road,
      start: { x1: sx - nx * half, y1: sy - ny * half, x2: sx + nx * half, y2: sy + ny * half },
      car: { x: sx - Math.cos(-h) * road * 1.1, y: sy - Math.sin(-h) * road * 1.1, r: road * 0.42 },
    }
  }, [pieces, shape.heading])
  return (
    <svg className="ttc-plan" viewBox={plan.viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <path className="ttc-plan__edge" d={plan.d} strokeWidth={plan.road * 1.3} />
      <path className="ttc-plan__road" d={plan.d} strokeWidth={plan.road} />
      <line className="ttc-plan__start" {...plan.start} strokeWidth={plan.road * 0.4} />
      <circle className="ttc-plan__car" cx={plan.car.x} cy={plan.car.y} r={plan.car.r} />
    </svg>
  )
}

/** Today's Track as a card: the track, how the day stands, the clock to the next, and Race. */
export function TodaysTrackCard() {
  const day = useTrackDay()
  const track = useMemo(() => dailyTrack(day), [day])
  const me = normalizePlayerName(usePlayerName())
  const board = useTodayBoard(day, me)
  const href = gamePlayHref(SLUG)
  const accent = resolveGameAccent(SLUG, getGame(SLUG)?.accent ?? '#f2813a')
  const style = { '--e': accent, '--e-ink': inkOn(accent) } as CSSProperties
  return (
    <section className="evp-card evp-daily ttc" style={style} aria-labelledby="ttc-title">
      <div className="evp-daily__screen">
        <a className="evp-screen ttc__screen" href={href} aria-label={`Race Today’s Track #${track.n}, ${track.name}`}>
          <TrackPlan pieces={track.pieces} shape={track.shape} />
          <span className="evp-screen__play" aria-hidden="true">
            <PlayIcon />
            Race
          </span>
        </a>
        <span className="evp-tag evp-tag--today">
          <span className="evp-dot" aria-hidden="true" />
          Today&rsquo;s Track #{track.n}
        </span>
      </div>
      <div className="evp-daily__text">
        <h2 id="ttc-title" className="evp-card__title">
          {track.name}
        </h2>
        <p className="evp-card__copy">
          Hot Lap, on a new track every day. One lap against the clock, the same track for everyone, and the fastest
          lap tops the day. {standingWords(board)}
        </p>
      </div>
      <div className="evp-daily__foot">
        <span className="evp-meta">
          <ClockIcon />
          <EventCountdown endsAt={nextTrackAt()} />
        </span>
        <a className="evp-btn evp-btn--small" href={href}>
          {board?.you ? 'Beat your lap' : 'Race the track'}
        </a>
      </div>
    </section>
  )
}

/** Today's Track in the home page's On now: the track's number and name, the clock, the day's board. */
export function TodaysTrackOnNow() {
  const day = useTrackDay()
  const track = useMemo(() => dailyTrack(day), [day])
  const me = normalizePlayerName(usePlayerName())
  const board = useTodayBoard(day, me)
  const accent = resolveGameAccent(SLUG, getGame(SLUG)?.accent ?? '#f2813a')
  return (
    <a className="onnow-card" href={gamePlayHref(SLUG)} style={{ '--ev-accent': accent } as CSSProperties}>
      <span className="onnow-card__head">
        <span className="onnow-card__art" aria-hidden="true">
          <GameThumbArt slug={SLUG} accent={accent} />
        </span>
        <span className="onnow-card__titles">
          <span className="onnow-card__title">Today&rsquo;s Track #{track.n}</span>
          <span className="onnow-card__sub">Hot Lap · {track.name}</span>
        </span>
        <EventCountdown endsAt={nextTrackAt()} className="onnow-card__clock" />
      </span>
      <span className={`onnow-card__line${board?.you ? ' onnow-card__line--you' : ''}`}>
        {standingWords(board) || 'A new track every day, the same for everyone. The fastest lap tops the day.'}
      </span>
      <span className="onnow-card__foot">
        <span className="onnow-card__go">{board?.you ? 'Race again' : 'Race'}</span>
      </span>
    </a>
  )
}
