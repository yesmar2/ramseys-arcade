import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from 'react'
import { getGame, homeGames, isDailyGame } from '../data/games'
import { aboutHref, gameHref, gamePlayHref, rankHref, tournamentHref } from '../hooks/useHashRoute'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { APP_NAME } from '../lib/brand'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { useDeviceType } from '../lib/device'
import { gapBetween, gapFigure, playersFromRuns, type BoardPlayer } from '../lib/gameBoard'
import { hasGamePreview } from '../lib/gamePreviews'
import { useGlobalRank } from '../lib/globalRank'
import { cachedMyGroups, useActiveGroup } from '../lib/groups'
import { heroSlug, newestSlug } from '../lib/homePicks'
import { useRecentGames } from '../lib/lastPlayed'
import {
  getLeaderboard,
  normalizePlayerName,
  PERIOD_LABELS,
  type LeaderboardEntry,
  type LeaderboardPeriod,
  type YouEntry,
} from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { numberWord } from '../lib/numberWord'
import { resolveGameAccent } from '../lib/theme'
import { howItWins, type TournamentSummary } from '../lib/tournaments'
import { usePlayerName } from '../hooks/usePlayerName'
import { inkOn } from '../lib/color'
import { preloadGamePage } from '../pages/gamePages'
import { liveSeason, useSeason, seasonTop } from '../lib/season'
import { EventCountdown } from './EventCountdown'
import { SeasonBanner } from './season/SeasonBanner'
import { SeasonWelcomeCard } from './season/SeasonSpotlight'
import { GamePreview } from './GamePreview'
import { GameThumbArt } from './GameThumbArt'

type HeroScores = {
  best: number
  /** Your place among the board's players; 0 when it isn't known. */
  place: number
  top: number
  topName: string
}

/** One player on a game's board: their best, and their place among its players. */
type Place = { name: string; score: number; place: number }

/**
 * Your best on the banner's game, all time, with the player just above you
 * and the one just behind; on top of the board, also the player after that,
 * so the line still shows second and third.
 */
type Rung = { you: Place; above: Place | null; below: Place | null; third?: Place | null }

const RUNG_PAGE = 25

/** Runs per request while reading a board down to your best, and the deepest best it is read down to. */
const READ_PAGE = 500
const READ_CAP = 2000

/** `count` runs of a board from `offset`, best first, a page at a time; fewer where the board ends. */
async function readRuns(slug: string, board: LeaderboardPeriod, offset: number, count: number): Promise<LeaderboardEntry[]> {
  const runs: LeaderboardEntry[] = []
  while (runs.length < count) {
    const limit = Math.min(READ_PAGE, count - runs.length)
    const { entries } = await getLeaderboard(slug, board, undefined, { offset: offset + runs.length, limit })
    runs.push(...entries)
    if (entries.length < limit) break
  }
  return runs
}

/*
 * A board lists runs, not players, and one player can hold several runs in a
 * row, so the API's rank for your best counts runs: #5 there can be 3rd on
 * the game's page. The API sends your place among the players with it; for
 * one that doesn't yet, it is counted here the way that page counts it, as
 * players (playersFromRuns), from every run above your best. Too deep to
 * read, it isn't known: 0.
 */
async function placeOn(slug: string, board: LeaderboardPeriod, you: YouEntry): Promise<number> {
  if (you.rank > READ_CAP) return 0
  return playersFromRuns(await readRuns(slug, board, 0, you.rank - 1)).length + 1
}

/*
 * Too deep to read from the top, the rung is taken from the place the API
 * counted for your best and one window of runs around it: the run just above
 * yours, and the next other player below, read on a page at a time. That far
 * down it is near enough, though a player's other runs can sit between yours
 * and their best.
 */
async function rungAround(slug: string, board: LeaderboardPeriod, name: string, you: YouEntry, place: number): Promise<Rung> {
  const start = Math.max(0, you.rank - 2)
  let above: Place | null = null
  let below: Place | null = null
  for (let page = 0; page < 3 && !below; page += 1) {
    const offset = start + page * RUNG_PAGE
    const runs = await readRuns(slug, board, offset, RUNG_PAGE)
    for (const [i, e] of runs.entries()) {
      if (e.name === name) continue
      if (offset + i + 1 < you.rank) above = { name: e.name, score: e.score, place: place - 1 }
      else if (!below && e.name !== above?.name) below = { name: e.name, score: e.score, place: place + 1 }
    }
    if (runs.length < RUNG_PAGE) break
  }
  return { you: { name, score: you.score, place }, above, below }
}

/*
 * The board is read from the top, down past your best, and taken as players
 * (see placeOn): your place, the player above you, and the ones behind. A
 * player's other runs can sit just under yours, so the runs below are read on
 * a page at a time until enough other players turn up: one behind you, or two
 * when nobody is ahead of you.
 */
async function fetchRung(slug: string, name: string): Promise<Rung | null> {
  // A daily's all time is its day points (leaderboardFormat isDayPointsBoard): its next place up is today's.
  const board: LeaderboardPeriod = isDailyGame(slug) ? 'daily' : 'all'
  const { you } = await getLeaderboard(slug, board, name, { limit: 1 })
  if (!you) return null
  // Deeper than that, a window around your best (rungAround) on the place the API counted; an API that sends
  // none gets the plain banner, rather than a place counted wrong.
  if (you.rank > READ_CAP) return you.place ? rungAround(slug, board, name, you, you.place) : null
  const runs = await readRuns(slug, board, 0, you.rank + RUNG_PAGE)
  let ended = runs.length < you.rank + RUNG_PAGE
  let players = playersFromRuns(runs)
  const at = players.findIndex((p) => p.name === name)
  if (at < 0) return null
  const wanted = at === 0 ? 2 : 1
  for (let page = 0; page < 2 && !ended && players.length - at - 1 < wanted; page += 1) {
    const more = await readRuns(slug, board, runs.length, RUNG_PAGE)
    runs.push(...more)
    ended = more.length < RUNG_PAGE
    players = playersFromRuns(runs)
  }
  const place = (p: BoardPlayer | undefined): Place | null => (p ? { name: p.name, score: p.best.score, place: p.place } : null)
  // Passing the player above you passes anyone tied with them too, so the place you're after is the first of those.
  const over = players[at - 1]
  const above = over ? players.find((p) => p.best.score === over.best.score) : undefined
  return { you: place(players[at])!, above: place(above), below: place(players[at + 1]), third: place(players[at + 2]) }
}

/*
 * The last rungs this device saw, one per player, game and group, so a
 * returning player's banner opens on theirs instead of flashing the plain
 * banner while the board is asked again. One kept before places were counted
 * as players carries a run's rank instead, and is passed over.
 */
const RUNGS_KEY = 'skermix-hero-rungs'
const RUNGS_KEPT = 12

function isRung(value: unknown): value is Rung {
  const you = (value as Rung | null)?.you
  return typeof you?.score === 'number' && typeof you.place === 'number'
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
          {slot === 'hi' && p.place === 1 ? <Flag /> : null}
          {p === rung.you ? 'You' : p.name} {fmt(p.score)}
        </span>
      </>
    )
  }

  return (
    <div className="hero-race" role="img" aria-label={`${name} ${isDailyGame(slug) ? 'today’s' : 'all-time'} board: ${said.join(', ')}`}>
      <span className="hero-race__track" />
      {gap > 0 ? <span className="hero-race__lit" style={{ left: `${x.mid}%`, width: `${x.hi - x.mid}%` }} /> : null}
      {s.lo && x.lo != null ? mark(s.lo, x.lo, 'lo', ' hero-race__label--start') : null}
      {mark(s.hi, x.hi, 'hi', ' hero-race__label--end')}
      {/* With a mark behind it, the middle's label hangs left, so the lit stretch's figure fits to its right. */}
      {mark(s.mid, x.mid, 'mid', s.lo ? ' hero-race__label--end' : '')}
      {gap > 0 ? (
        <span className="hero-race__label hero-race__label--under hero-race__label--gap" style={{ left: `${(x.mid + x.hi) / 2}%` }}>
          {gapFigure(slug, s.hi.score, s.mid.score)} {onTop ? 'ahead' : 'to go'}
        </span>
      ) : null}
    </div>
  )
}

type PromiseKind = 'ads' | 'install' | 'free' | 'devices'

/** What a stranger should know before anything else, long and, for a phone, short. */
const PROMISES: { kind: PromiseKind; long: string; short: string | null }[] = [
  { kind: 'ads', long: 'No ads, ever', short: 'No ads' },
  { kind: 'install', long: 'Nothing to install', short: 'No install' },
  { kind: 'free', long: 'Free to play', short: 'Free' },
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
      ) : kind === 'free' ? (
        <path d="M7 4.5v15l12.5-7.5z" />
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

/** Today's event on the first-visit banner: its game, how it is won, its clock, and the way in. */
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
          {/* Several games: the event's own title already says it's today's event. */}
          {only ? `Today’s event is ${only.name}` : t.title}
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
 * event, Play, and a way to the wall. Everyone else gets the kicker, the name,
 * the game's own line about itself, Play, and the board's top and their best.
 * Tinted from the game's colour, like every hero on the site.
 */
/**
 * Whether the welcome banner had today's event last time on this device: its slot is held while the events
 * load only then, so it never shows an empty box that goes (the arcade's own events paused, as at launch).
 */
const WELCOME_EVENT_KEY = 'skermix-welcome-event'

function hadEventLastTime(): boolean {
  try {
    return localStorage.getItem(WELCOME_EVENT_KEY) === '1'
  } catch {
    return false
  }
}

/** How long the banner waits on the API to say whether a season is on, before showing the game's banner. */
const SEASON_WAIT_MS = 4000

export function HomeHero() {
  const device = useDeviceType()
  const recent = useRecentGames()
  const newest = newestSlug(device)
  const slug = heroSlug(device, recent)
  const name = normalizePlayerName(usePlayerName())
  const period = useDefaultPeriod()
  // The game's own figures are the period's, but a daily's are today's: its week and all time are day points.
  const boardPeriod: LeaderboardPeriod = slug && isDailyGame(slug) ? 'daily' : period
  // Every figure below is group-scoped on the wire; switching group has to
  // refetch them or the banner keeps quoting the last group's board.
  const groupId = useActiveGroup()
  const [scores, setScores] = useState<HeroScores | null>(null)
  const standing = useGlobalRank()
  const { official, loading: eventsLoading } = useLiveEvents(name)
  const seasonStore = useSeason()
  // Whether a season is on isn't known until the API says (a device that saw one keeps it: lib/season.ts). Until
  // then the banner waits as a skeleton, so it never shows the game's banner and then swaps to the season's. An
  // API that's slow to wake gets a few seconds, then the game's banner, which then stays for this visit: a
  // season answering after that waits for the next (when the device has it kept), never swapping in late.
  const [gaveUp, setGaveUp] = useState(false)
  const season = gaveUp ? null : liveSeason(seasonStore)
  const lastPlayed = slug != null && recent.includes(slug)
  const firstVisit = !name && recent.length === 0
  const [eventLastTime] = useState(hadEventLastTime)
  const hasEvent = official.some((t) => t.cadence === 'daily')
  useEffect(() => {
    if (eventsLoading) return
    try {
      localStorage.setItem(WELCOME_EVENT_KEY, hasEvent ? '1' : '0')
    } catch {
      /* a private window keeps nothing: the slot isn't held */
    }
  }, [eventsLoading, hasEvent])
  const seasonUnknown = !firstVisit && !seasonStore.loaded && !seasonStore.season && !gaveUp
  useEffect(() => {
    if (!seasonUnknown) return
    const timer = window.setTimeout(() => setGaveUp(true), SEASON_WAIT_MS)
    return () => window.clearTimeout(timer)
  }, [seasonUnknown])

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
    getLeaderboard(slug, boardPeriod, name || undefined, { limit: 1 })
      .then(async ({ entries, you }) => {
        // Your place shows only on the plain banner. The API sends it with your best; for one that doesn't, the board
        // is read down to you for it (placeOn), but not with a rung remembered, as the rung banner is what shows then.
        const place = !you ? 0 : (you.place ?? (remembered ? 0 : await placeOn(slug, boardPeriod, you).catch(() => 0)))
        if (cancelled) return
        const leader = entries[0]
        setScores({
          best: you?.score ?? 0,
          place,
          top: leader?.score ?? 0,
          topName: leader?.name ?? '',
        })
      })
      .catch(() => {
        // Nothing to show, rather than null, which is still asking: the figures' place isn't held for good.
        if (!cancelled) setScores({ best: 0, place: 0, top: 0, topName: '' })
      })
    return () => {
      cancelled = true
    }
  }, [name, slug, boardPeriod, groupId, remembered])

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
  const boardWord = PERIOD_LABELS[boardPeriod].toLowerCase()
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
  // The game on its screen, playing itself the way a cabinet by the door runs its demo; its thumb until it's ready.
  const art = (
    // Shaped for its screen from the start (home.css), not once the screen has come, so the banner doesn't change shape.
    <a className={`home-banner__art${hasGamePreview(slug) ? ' home-banner__art--screen' : ''}`} href={gamePlayHref(slug)} tabIndex={-1} aria-hidden="true">
      <GameThumbArt slug={slug} accent={accent} />
      {hasGamePreview(slug) ? (
        <>
          <GamePreview slug={slug} className="home-banner__screen" autoplay />
          <span className="home-banner__fade" />
          <span className="home-banner__start">Press start</span>
        </>
      ) : null}
    </a>
  )

  if (seasonUnknown) {
    return (
      // The season banner's own parts (season/SeasonBanner.tsx), shimmering: the same shape at every width, so
      // it comes in place. The game's banner is laid out the same way.
      <section className="home-banner home-banner--skel" aria-busy="true" aria-label="Loading">
        <div className="home-banner__text" aria-hidden="true">
          <p className="home-banner__kicker">
            <span>
              <span className="skel-line" style={{ '--skel-w': '9rem' } as CSSProperties} />
            </span>
          </p>
          <h2 className="home-banner__name">
            <span className="skel-line home-banner__skel-title" style={{ '--skel-w': '13rem' } as CSSProperties} />
          </h2>
          <p className="home-banner__blurb">
            <span className="skel-line" style={{ '--skel-w': '24rem' } as CSSProperties} />
            <br />
            <span className="skel-line" style={{ '--skel-w': '17rem' } as CSSProperties} />
          </p>
          <div className="home-banner__acts">
            <span className="home-banner__cta home-banner__skel-btn">See the pass</span>
            <span className="home-banner__ghost home-banner__skel-btn">Today’s pick: Pellets</span>
          </div>
        </div>
        <span className="home-banner__art home-banner__art--season home-banner__skel-art" aria-hidden="true" />
      </section>
    )
  }

  // A live season takes the banner for everyone but a first visit, which still gets what the arcade is. The
  // game the banner would have offered becomes its second button.
  if (season && !firstVisit) {
    const kicker = lastPlayed ? 'Jump back in' : slug === newest ? 'New' : 'Today’s pick'
    return <SeasonBanner season={season} you={seasonStore.you} rewards={seasonStore.rewards} pick={{ slug, name: game.name, kicker }} top={seasonTop(seasonStore)} />
  }

  if (rung) {
    const { you, above, below } = rung
    const gap = above ? above.score - you.score : 0
    // A daily's rung is today's board, so its top is 1st today: a record is a course's best across all time.
    const daily = isDailyGame(slug)
    const target = above
      ? above.place === 1
        ? daily
          ? `1st today on ${game.name}`
          : `the ${game.name} record`
        : `#${above.place} on ${game.name}`
      : ''
    // Level with the player under you is a tie you got to first, not "0 behind".
    const belowGap = below ? you.score - below.score : 0
    const behind = below
      ? belowGap > 0
        ? `${below.name} is ${gapBetween(slug, you.score, below.score)} behind you`
        : `${below.name} is tied with you`
      : null
    const kicker = above
      ? above.place === 1 && !daily
        ? 'Your next record'
        : 'Your next place'
      : daily
        ? 'Your place'
        : 'Your record'
    const group = groupId ? cachedMyGroups().find((g) => g.id === groupId)?.name : undefined
    const ahead = standing.rank != null ? standing.nearby?.find((n) => n.rank === standing.rank! - 1) : undefined
    const trailing = standing.rank != null ? standing.nearby?.find((n) => n.rank === standing.rank! + 1) : undefined

    let body: string
    if (above && gap > 0) {
      body = `You’re #${you.place} with ${fmt(you.score)}. ${above.name} holds ${above.place === 1 ? 'it' : `#${above.place}`} at ${fmt(above.score)}${behind ? `, and ${behind}` : ''}.`
    } else if (above) {
      body = `You’re #${you.place} with ${fmt(you.score)}, tied with ${above.name}, who got there first.${behind ? ` ${behind}.` : ''}`
    } else if (below) {
      body =
        belowGap > 0
          ? `Your ${fmt(you.score)} leads ${below.name} by ${gapBetween(slug, you.score, below.score)}.`
          : `Your ${fmt(you.score)} is tied with ${below.name}, and you got there first.`
    } else {
      body = `Your ${fmt(you.score)} tops ${daily ? 'today’s' : 'the'} board.`
    }

    return (
      <section className="home-banner home-banner--rung" style={style} aria-label={kicker} data-hunt="home-hero">
        <div className="home-banner__text">
          <div className="home-banner__kicker-row">
            <p className="home-banner__kicker">{kicker}</p>
            <span className="home-banner__kicker-note">
              {/* A daily's rung is on today's board (fetchRung), so it says so. */}
              {game.name} · {daily ? 'today' : 'all time'}{group ? ` · ${group}` : ''}
            </span>
          </div>
          <h2 className="home-banner__goal">
            {above && gap > 0 ? (
              <>
                <span className="home-banner__gap">{gapBetween(slug, above.score, you.score)}</span> from {target}.
              </>
            ) : above ? (
              daily && above.place === 1 ? (
                <>Tied for {target}.</>
              ) : (
                <>Tied with {target}.</>
              )
            ) : daily ? (
              <>You’re 1st today on {game.name}.</>
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
          // Your place across every game, not on the game above it: the Standings, as the Boards page and the run
          // report name it. A bare #14 reads as a place on this board, and "All games" as the list of games.
          <div className="home-banner__strip home-banner__standing">
            <span className="home-banner__stat">
              <span className="home-banner__stat-k">Standings</span>
              <b className="home-banner__stat-rank">#{standing.rank}</b>
              <span className="home-banner__stat-v">{periodWord}</span>
            </span>
            {/* Who is either side, by name: the points between you stay on the full Standings list. */}
            {ahead ? (
              <span className="home-banner__stat home-banner__stat--side">
                <span className="home-banner__stat-k">Ahead</span>
                <b>{ahead.name}</b>
                {ahead.score === standing.score ? <span className="home-banner__stat-v">tied</span> : null}
              </span>
            ) : null}
            {trailing ? (
              <span className="home-banner__stat home-banner__stat--side">
                <span className="home-banner__stat-k">Behind</span>
                <b>{trailing.name}</b>
                {trailing.score === standing.score ? <span className="home-banner__stat-v">tied</span> : null}
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
      <section className="home-banner home-banner--welcome" style={style} aria-label="Welcome" data-hunt="home-hero">
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
          ) : eventsLoading && eventLastTime ? (
            <span className="home-banner__daily home-banner__daily--wait" aria-hidden="true" />
          ) : null}
          {/* A season on is a reason to come back: said here, with Play still first. Its room is held while it isn't
              known yet whether one is on, as there nearly always is. */}
          {season ? (
            <SeasonWelcomeCard season={season} />
          ) : !seasonStore.loaded && !seasonStore.season ? (
            <span className="season-spotcard season-spotcard--wait" aria-hidden="true" />
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
    <section className="home-banner" style={style} aria-label="Play" data-hunt="home-hero">
      <div className="home-banner__text">
        <p className="home-banner__kicker">{kicker}</p>
        <h2 className="home-banner__name">
          <a href={gamePlayHref(slug)}>{game.name}</a>
        </h2>
        <p className="home-banner__blurb">{game.description}</p>
        {acts}
        {scores === null ? (
          // Still asking: the figures hold their place, so the banner doesn't grow when they come.
          <dl className="home-banner__figures" aria-hidden="true">
            {[isDailyGame(slug) ? '1st today' : `Top ${boardWord}`, isDailyGame(slug) ? 'You today' : 'Your best'].map((label) => (
              <div key={label} className="home-banner__figure">
                <dt>{label}</dt>
                <dd>
                  <span className="skel-line" style={{ '--skel-w': '5rem' } as CSSProperties} />
                </dd>
              </div>
            ))}
          </dl>
        ) : scores.top > 0 ? (
          <dl className="home-banner__figures" aria-label={`${game.name} scores`}>
            <div className="home-banner__figure">
              {/* A daily's figures are today's board: its top is 1st today, and yours is today's too. */}
              <dt>{isDailyGame(slug) ? '1st today' : `Top ${boardWord}`}</dt>
              <dd>
                {fmt(scores.top)}
                {scores.topName ? <small> by {scores.topName}</small> : null}
              </dd>
            </div>
            <div className="home-banner__figure">
              <dt>{isDailyGame(slug) ? 'You today' : 'Your best'}</dt>
              <dd>
                {scores.best > 0 ? fmt(scores.best) : '—'}
                {scores.best > 0 && scores.place > 0 ? <small> · #{scores.place}</small> : null}
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
