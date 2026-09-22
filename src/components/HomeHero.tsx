import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from 'react'
import { getGame, homeGames } from '../data/games'
import { aboutHref, gameHref, gamePlayHref, rankHref, tournamentHref } from '../hooks/useHashRoute'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { APP_NAME } from '../lib/brand'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { useDeviceType } from '../lib/device'
import { useGlobalRank } from '../lib/globalRank'
import { cachedMyGroups, useActiveGroup } from '../lib/groups'
import { heroSlug, newestSlug } from '../lib/homePicks'
import { useRecentGames } from '../lib/lastPlayed'
import { getLeaderboard, normalizePlayerName, PERIOD_LABELS } from '../lib/leaderboard'
import { formatLeaderboardScore, isTimeBoard } from '../lib/leaderboardFormat'
import { numberWord } from '../lib/numberWord'
import { resolveGameAccent } from '../lib/theme'
import { howItWins, type TournamentSummary } from '../lib/tournaments'
import { usePlayerName } from '../hooks/usePlayerName'
import { inkOn } from '../lib/color'
import { preloadGamePage } from '../pages/gamePages'
import { EventCountdown } from './EventCountdown'
import { GameThumbArt } from './GameThumbArt'

type HeroScores = {
  best: number
  rank: number
  top: number
  topName: string
}

/** One run's place on a game's all-time board. */
type Place = { name: string; score: number; rank: number }

/**
 * Your best on the banner's game, all time, with the run just above it and
 * the nearest other player below; on top of the board, also the player after
 * that, so the line still shows second and third.
 */
type Rung = { you: Place; above: Place | null; below: Place | null; third?: Place | null }

/** What each game counts, where it is not points. Time boards count seconds. */
const UNITS: Record<string, [string, string]> = {
  crosswalk: ['row', 'rows'],
  stacker: ['block', 'blocks'],
  simon: ['round', 'rounds'],
}

/** A gap between two scores as a bare figure: 9, 1,250, 2.4s. */
function gapFigure(slug: string, gap: number): string {
  return isTimeBoard(slug) ? `${(gap / 1000).toFixed(1)}s` : gap.toLocaleString()
}

/** A gap in the game's own unit: 9 rows, 1 point, 2.4s. */
function gapText(slug: string, gap: number): string {
  if (isTimeBoard(slug)) return gapFigure(slug, gap)
  const [one, many] = UNITS[slug] ?? ['point', 'points']
  return `${gap.toLocaleString()} ${gap === 1 ? one : many}`
}

/** A points figure that agrees with itself: 1 pt, 2 pts. */
function pts(n: number) {
  return `${n.toLocaleString()} ${n === 1 ? 'pt' : 'pts'}`
}

const RUNG_PAGE = 25

/*
 * A board lists runs, not players. Your best is your highest run, so the run
 * just above it is always someone else's. The runs below can be your own, or
 * another of that player's, so they are read a page at a time, one run per
 * player, until enough other players turn up: one behind you, or two when
 * nobody is ahead of you.
 */
async function fetchRung(slug: string, name: string): Promise<Rung | null> {
  const { you } = await getLeaderboard(slug, 'all', name, { limit: 1 })
  if (!you) return null
  const wanted = you.rank === 1 ? 2 : 1
  let above: Place | null = null
  const behind: Place[] = []
  let offset = Math.max(0, you.rank - 2)
  for (let page = 0; page < 3 && behind.length < wanted; page += 1) {
    const { entries } = await getLeaderboard(slug, 'all', name, { offset, limit: RUNG_PAGE })
    for (const [i, e] of entries.entries()) {
      const place: Place = { name: e.name, score: e.score, rank: offset + 1 + i }
      if (place.name === name) continue
      if (place.rank < you.rank) above = place
      else if (place.name !== above?.name && !behind.some((b) => b.name === place.name)) behind.push(place)
    }
    if (entries.length < RUNG_PAGE) break
    offset += RUNG_PAGE
  }
  return { you: { name, score: you.score, rank: you.rank }, above, below: behind[0] ?? null, third: behind[1] ?? null }
}

/*
 * The last rungs this device saw, one per player, game and group, so a
 * returning player's banner opens on theirs instead of flashing the plain
 * banner while the board is asked again.
 */
const RUNGS_KEY = 'skermix-hero-rungs'
const RUNGS_KEPT = 12

function isRung(value: unknown): value is Rung {
  const you = (value as Rung | null)?.you
  return typeof you?.score === 'number' && typeof you.rank === 'number'
}

function readRungs(): Record<string, unknown> {
  try {
    const parsed = JSON.parse(localStorage.getItem(RUNGS_KEY) ?? '{}') as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function rememberedRung(key: string): Rung | null {
  const rung = readRungs()[key]
  return isRung(rung) ? rung : null
}

function rememberRung(key: string, rung: Rung | null) {
  try {
    const rungs = readRungs()
    // Re-adding moves the key to the end, so the oldest fall off first.
    delete rungs[key]
    if (rung) rungs[key] = rung
    const kept = Object.keys(rungs).slice(-RUNGS_KEPT)
    localStorage.setItem(RUNGS_KEY, JSON.stringify(Object.fromEntries(kept.map((k) => [k, rungs[k]]))))
  } catch {
    /* ignore */
  }
}

/*
 * The line has three slots in score order: the top of it on the right, the
 * middle, and whoever is furthest back on the left. Chasing, you are the
 * middle, between the place you are after and the player behind you. On top
 * of the board, you are the top, with second and third behind you.
 */
type Slots = { hi: Place; mid: Place; lo: Place | null }

function slots({ you, above, below, third }: Rung): Slots | null {
  if (above) return { hi: above, mid: you, lo: below }
  // Alone on the board, there is nobody to draw you against.
  return below ? { hi: you, mid: below, lo: third ?? null } : null
}

/** Where each slot sits along the line, in percent. */
function layout({ hi, mid, lo }: Slots) {
  if (!lo) return { lo: null, mid: 22, hi: 88 }
  const span = hi.score - lo.score
  const raw = span > 0 ? 8 + (84 * (mid.score - lo.score)) / span : 50
  // Kept off both ends, so the labels always have room between them.
  return { lo: 8, mid: Math.min(60, Math.max(34, raw)), hi: 92 }
}

function Flag() {
  return (
    <svg className="hero-race__flag" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 11V1.5" />
      <path d="M2.5 2h6.8L7.6 4.4l1.7 2.4H2.5z" />
    </svg>
  )
}

/**
 * The board around you, laid on a line in score order, with the stretch
 * between the middle and the top lit in the game's colour: what you still
 * have to cover, or on top, your lead. The ends are named over the line; the
 * middle is named under it, beside the lit stretch's own figure.
 */
function RaceLine({ slug, name, rung }: { slug: string; name: string; rung: Rung }) {
  const s = slots(rung)
  if (!s) return null
  const x = layout(s)
  const fmt = (score: number) => formatLeaderboardScore(slug, score)
  const onTop = s.hi === rung.you
  const gap = s.hi.score - s.mid.score
  const said = [s.hi, s.mid, s.lo].filter((p): p is Place => p != null).map((p) => `${p === rung.you ? 'you' : p.name} ${fmt(p.score)}`)

  const mark = (p: Place, at: number, slot: 'hi' | 'mid' | 'lo', edge: string) => {
    const who = p === rung.you ? 'you' : slot === 'lo' ? 'trail' : 'rival'
    return (
      <>
        <span className={`hero-race__dot hero-race__dot--${who}`} style={{ left: `${at}%` }} />
        <span
          className={`hero-race__label hero-race__label--${slot === 'mid' ? 'under' : 'over'} hero-race__label--${who}${edge}`}
          style={{ left: `${at}%` }}
        >
          {slot === 'hi' && p.rank === 1 ? <Flag /> : null}
          {p === rung.you ? 'You' : p.name} {fmt(p.score)}
        </span>
      </>
    )
  }

  return (
    <div className="hero-race" role="img" aria-label={`${name} all-time board: ${said.join(', ')}`}>
      <span className="hero-race__track" />
      {gap > 0 ? <span className="hero-race__lit" style={{ left: `${x.mid}%`, width: `${x.hi - x.mid}%` }} /> : null}
      {s.lo && x.lo != null ? mark(s.lo, x.lo, 'lo', ' hero-race__label--start') : null}
      {mark(s.hi, x.hi, 'hi', ' hero-race__label--end')}
      {/* With a mark behind it, the middle's label hangs left, so the lit stretch's figure fits to its right. */}
      {mark(s.mid, x.mid, 'mid', s.lo ? ' hero-race__label--end' : '')}
      {gap > 0 ? (
        <span className="hero-race__label hero-race__label--under hero-race__label--gap" style={{ left: `${(x.mid + x.hi) / 2}%` }}>
          {gapFigure(slug, gap)} {onTop ? 'ahead' : 'to go'}
        </span>
      ) : null}
    </div>
  )
}

type PromiseKind = 'ads' | 'install' | 'account' | 'devices'

/** What a stranger should know before anything else, long and, for a phone, short. */
const PROMISES: { kind: PromiseKind; long: string; short: string | null }[] = [
  { kind: 'ads', long: 'No ads, ever', short: 'No ads' },
  { kind: 'install', long: 'Nothing to install', short: 'No install' },
  { kind: 'account', long: 'No account needed', short: 'No account' },
  { kind: 'devices', long: 'Phone or desk', short: null },
]

function PromiseIcon({ kind }: { kind: PromiseKind }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === 'ads' ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M5.6 5.6l12.8 12.8" />
        </>
      ) : kind === 'install' ? (
        <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
      ) : kind === 'account' ? (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
        </>
      ) : (
        <>
          <rect x="2" y="4" width="14" height="10" rx="1.5" />
          <path d="M6 18h6" />
          <rect x="17" y="9" width="5" height="11" rx="1.2" />
        </>
      )}
    </svg>
  )
}

/** Browse all games: down to the wall, gliding unless motion is turned down, without a hash in the address. */
function toWall(event: MouseEvent<HTMLAnchorElement>) {
  const wall = document.getElementById('games')
  if (!wall) return
  event.preventDefault()
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // `auto` would still glide: the page asks for smooth scrolling in its stylesheet.
  wall.scrollIntoView({ behavior: still ? 'instant' : 'smooth', block: 'start' })
}

/** Today's daily on the first-visit banner: its game, how it is won, its clock, and the way in. */
function DailyCard({ t }: { t: TournamentSummary }) {
  const lead = t.games[0] ?? null
  const only = t.games.length === 1 && lead ? getGame(lead) : null
  const accent = lead ? resolveGameAccent(lead, getGame(lead)?.accent ?? 'var(--accent)') : 'var(--accent)'
  return (
    <a className="home-banner__daily" href={tournamentHref(t.id)} style={{ '--daily-accent': accent } as CSSProperties}>
      <span className="home-banner__daily-art" aria-hidden="true">
        {lead ? <GameThumbArt slug={lead} accent={accent} /> : null}
      </span>
      <span className="home-banner__daily-text">
        <span className="home-banner__daily-title">
          {only ? `Today’s daily is ${only.name}` : `Today’s daily: ${t.title}`}
        </span>
        <span className="home-banner__daily-sub">
          {howItWins(t)} ·{' '}
          <EventCountdown endsAt={t.endsAt} unlimitedDuration={Boolean(t.rules.unlimitedDuration)} />
        </span>
      </span>
      <svg
        className="home-banner__daily-go"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 12h14" />
        <path d="M13 6l6 6-6 6" />
      </svg>
    </a>
  )
}

/**
 * The banner: the one game to open right now, run big across the whole
 * width. The game's thumb leans as a big card on the right.
 *
 * For a player with a score on that game, the banner is about the next place
 * up on its all-time board: how far it is in the game's own unit, who holds
 * it, who is close behind, all laid on a line; and along the bottom, where
 * they stand across the arcade this period. A first visit, with no tag and
 * nothing played on this device, gets what the arcade is: the promise, today's
 * daily, Play, and a way to the wall. Everyone else gets the kicker, the name,
 * the game's own line about itself, Play, and the board's top and their best.
 * Tinted from the game's colour, like every hero on the site.
 */
export function HomeHero() {
  const device = useDeviceType()
  const recent = useRecentGames()
  const newest = newestSlug(device)
  const slug = heroSlug(device, recent)
  const name = normalizePlayerName(usePlayerName())
  const period = useDefaultPeriod()
  // Every figure below is group-scoped on the wire; switching group has to
  // refetch them or the banner keeps quoting the last group's board.
  const groupId = useActiveGroup()
  const [scores, setScores] = useState<HeroScores | null>(null)
  const standing = useGlobalRank()
  const { official, loading: eventsLoading } = useLiveEvents(name)
  const lastPlayed = slug != null && recent.includes(slug)
  const firstVisit = !name && recent.length === 0

  const rungKey = name && slug ? `${groupId ?? ''}|${name}|${slug}` : ''
  const [fetched, setFetched] = useState<{ key: string; rung: Rung | null } | null>(null)
  const remembered = useMemo(() => (rungKey ? rememberedRung(rungKey) : null), [rungKey])
  const rung = !rungKey ? null : fetched?.key === rungKey ? fetched.rung : remembered

  useEffect(() => {
    if (!slug) {
      setScores(null)
      return
    }
    let cancelled = false
    getLeaderboard(slug, period, name || undefined, { limit: 1 })
      .then(({ entries, you }) => {
        if (cancelled) return
        const leader = entries[0]
        setScores({
          best: you?.score ?? 0,
          rank: you?.rank ?? 0,
          top: leader?.score ?? 0,
          topName: leader?.name ?? '',
        })
      })
      .catch(() => {
        if (!cancelled) setScores(null)
      })
    return () => {
      cancelled = true
    }
  }, [name, slug, period, groupId])

  useEffect(() => {
    if (!rungKey || !slug) return
    let cancelled = false
    fetchRung(slug, name)
      .then((next) => {
        if (cancelled) return
        setFetched({ key: rungKey, rung: next })
        rememberRung(rungKey, next)
      })
      .catch(() => {
        /* keep what the device remembered */
      })
    return () => {
      cancelled = true
    }
  }, [rungKey, slug, name])

  // The game the banner offers is fetched once the banner is up, so Play opens it without a wait.
  useEffect(() => {
    if (slug) preloadGamePage(slug)
  }, [slug])

  if (!slug) return null
  const game = getGame(slug)
  if (!game) return null

  const accent = game.accent
  const style = { '--hero-accent': accent, '--hero-ink': inkOn(accent), '--tile-accent': accent } as CSSProperties
  const periodWord = PERIOD_LABELS[period].toLowerCase()
  const fmt = (score: number) => formatLeaderboardScore(slug, score)
  const acts = (
    <div className="home-banner__acts">
      <a className="home-banner__cta" href={gamePlayHref(slug)}>
        Play {game.name}
      </a>
      <a className="home-banner__ghost" href={gameHref(slug)}>
        Leaderboard
      </a>
    </div>
  )
  const art = (
    <a className="home-banner__art" href={gamePlayHref(slug)} tabIndex={-1} aria-hidden="true">
      <GameThumbArt slug={slug} accent={accent} />
    </a>
  )

  if (rung) {
    const { you, above, below } = rung
    const gap = above ? above.score - you.score : 0
    const target = above ? (above.rank === 1 ? `the ${game.name} record` : `#${above.rank} on ${game.name}`) : ''
    const behind = below ? `${below.name} is ${gapText(slug, you.score - below.score)} behind you` : null
    const kicker = above ? (above.rank === 1 ? 'Your next record' : 'Your next place') : 'Your record'
    const group = groupId ? cachedMyGroups().find((g) => g.id === groupId)?.name : undefined
    const ahead = standing.rank != null ? standing.nearby?.find((n) => n.rank === standing.rank! - 1) : undefined
    const trailing = standing.rank != null ? standing.nearby?.find((n) => n.rank === standing.rank! + 1) : undefined

    let body: string
    if (above && gap > 0) {
      body = `You’re #${you.rank} with ${fmt(you.score)}. ${above.name} holds ${above.rank === 1 ? 'it' : `#${above.rank}`} at ${fmt(above.score)}${behind ? `, and ${behind}` : ''}.`
    } else if (above) {
      body = `You’re #${you.rank} with ${fmt(you.score)}, level with ${above.name}, who got there first.${behind ? ` ${behind}.` : ''}`
    } else if (below) {
      body = `Your ${fmt(you.score)} leads ${below.name} by ${gapText(slug, you.score - below.score)}.`
    } else {
      body = `Your ${fmt(you.score)} tops the board.`
    }

    return (
      <section className="home-banner home-banner--rung" style={style} aria-label={kicker}>
        <div className="home-banner__text">
          <div className="home-banner__kicker-row">
            <p className="home-banner__kicker">{kicker}</p>
            <span className="home-banner__kicker-note">
              {game.name} · all time{group ? ` · ${group}` : ''}
            </span>
          </div>
          <h2 className="home-banner__goal">
            {above && gap > 0 ? (
              <>
                <span className="home-banner__gap">{gapText(slug, gap)}</span> from {target}.
              </>
            ) : above ? (
              <>Level with {target}.</>
            ) : (
              <>You hold the {game.name} record.</>
            )}
          </h2>
          <p className="home-banner__blurb">{body}</p>
          <RaceLine slug={slug} name={game.name} rung={rung} />
          {acts}
        </div>
        {art}
        {standing.rank != null ? (
          <div className="home-banner__strip home-banner__standing">
            <span className="home-banner__stat">
              <span className="home-banner__stat-k">Your standing</span>
              <b className="home-banner__stat-rank">#{standing.rank}</b>
              <span className="home-banner__stat-v">
                {periodWord} · {pts(standing.score)}
              </span>
            </span>
            {ahead ? (
              <span className="home-banner__stat home-banner__stat--side">
                <span className="home-banner__stat-k">Ahead</span>
                <b>{ahead.name}</b>
                <span className="home-banner__stat-v">by {pts(ahead.score - standing.score)}</span>
              </span>
            ) : null}
            {trailing ? (
              <span className="home-banner__stat home-banner__stat--side">
                <span className="home-banner__stat-k">Behind</span>
                <b>{trailing.name}</b>
                <span className="home-banner__stat-v">by {pts(standing.score - trailing.score)}</span>
              </span>
            ) : null}
            {ahead ? (
              <span className="home-banner__stat home-banner__stat--next">
                <b>{(ahead.score - standing.score).toLocaleString()}</b> to #{ahead.rank}
              </span>
            ) : null}
            <a className="home-banner__standing-link" href={rankHref()}>
              Your profile ›
            </a>
          </div>
        ) : null}
      </section>
    )
  }

  if (firstVisit) {
    const count = numberWord(homeGames(device).length)
    const daily = official.find((t) => t.cadence === 'daily') ?? null
    return (
      <section className="home-banner home-banner--welcome" style={style} aria-label="Welcome">
        <div className="home-banner__text">
          <p className="home-banner__kicker">Free browser arcade</p>
          <h2 className="home-banner__goal home-banner__goal--pitch">
            Simple games.
            <br />
            No ads. <span className="home-banner__gap">Just play.</span>
          </h2>
          <p className="home-banner__blurb">
            {count.charAt(0).toUpperCase() + count.slice(1)} original games that start in a tap, on a phone or at
            a desk. Post a score and see where you land.
          </p>
          {daily ? (
            <DailyCard t={daily} />
          ) : eventsLoading ? (
            <span className="home-banner__daily home-banner__daily--wait" aria-hidden="true" />
          ) : null}
          <div className="home-banner__acts">
            <a className="home-banner__cta" href={gamePlayHref(slug)}>
              Play {game.name}
            </a>
            <a className="home-banner__ghost" href="#games" onClick={toWall}>
              Browse all games
            </a>
          </div>
        </div>
        {art}
        <div className="home-banner__strip home-banner__promises">
          {PROMISES.map((p) => (
            <span key={p.kind} className={`home-banner__promise${p.short ? '' : ' home-banner__promise--roomy'}`}>
              <PromiseIcon kind={p.kind} />
              <span className="home-banner__promise-long">{p.long}</span>
              {p.short ? <span className="home-banner__promise-short">{p.short}</span> : null}
            </span>
          ))}
          <a className="home-banner__standing-link" href={aboutHref()}>
            About {APP_NAME} ›
          </a>
        </div>
      </section>
    )
  }

  const isNew = !lastPlayed && slug === newest
  const kicker = lastPlayed ? 'Jump back in' : isNew ? 'New in the arcade' : 'Today’s pick'

  return (
    <section className="home-banner" style={style} aria-label="Play">
      <div className="home-banner__text">
        <p className="home-banner__kicker">{kicker}</p>
        <h2 className="home-banner__name">
          <a href={gamePlayHref(slug)}>{game.name}</a>
        </h2>
        <p className="home-banner__blurb">{game.description}</p>
        {acts}
        {scores && scores.top > 0 ? (
          <dl className="home-banner__figures" aria-label={`${game.name} scores`}>
            <div className="home-banner__figure">
              <dt>Top {periodWord}</dt>
              <dd>
                {fmt(scores.top)}
                {scores.topName ? <small> by {scores.topName}</small> : null}
              </dd>
            </div>
            <div className="home-banner__figure">
              <dt>Your best</dt>
              <dd>
                {scores.best > 0 ? fmt(scores.best) : '—'}
                {scores.best > 0 && scores.rank > 0 ? <small> · #{scores.rank}</small> : null}
                {scores.best === 0 ? <small> not on the board yet</small> : null}
              </dd>
            </div>
          </dl>
        ) : null}
      </div>
      {art}
    </section>
  )
}
