import { useState, type CSSProperties } from 'react'
import { comingWords, isComingSoon, TAG_LABELS, wallGames, type Game, type GameTag } from '../data/games'
import { useAccountId } from '../hooks/useAccountId'
import { useBoardLeaders, type BoardLeader } from '../hooks/useBoardLeaders'
import { gameHref, gamePlayHref } from '../hooks/useHashRoute'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { usePlayerBests } from '../hooks/usePlayerBests'
import { usePlayerName } from '../hooks/usePlayerName'
import { moveChoice } from '../lib/choiceKeys'
import { tileText } from '../lib/color'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { useDeviceType } from '../lib/device'
import { hasGamePreview } from '../lib/gamePreviews'
import { useGlobalRank } from '../lib/globalRank'
import { normalizePlayerName, PERIOD_LABELS, type GlobalGamePlace, type LeaderboardPeriod } from '../lib/leaderboard'
import { ordinal, periodWord } from '../lib/profileMath'
import { formatBoardScore, formatLeaderboardScore } from '../lib/leaderboardFormat'
import { isSpotlight, liveSeason, useSeason } from '../lib/season'
import { resolveGameAccent } from '../lib/theme'
import { AlsoToday } from './AlsoToday'
import { GameArt } from './GameArt'
import { GamePreview } from './GamePreview'
import { GameThumbArt } from './GameThumbArt'
import { PlayerAvatar } from './PlayerAvatar'
import { useTicket } from './todayPunches'

type Tab = 'all' | GameTag | 'new'

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'arcade', label: TAG_LABELS.arcade },
  { id: 'puzzle', label: TAG_LABELS.puzzle },
  { id: 'quick', label: TAG_LABELS.quick },
  { id: 'sport', label: TAG_LABELS.sport },
  { id: 'new', label: 'New' },
]

function inTab(game: Game, tab: Tab) {
  if (tab === 'all') return true
  if (tab === 'new') return Boolean(game.inDevelopment || isComingSoon(game))
  return Boolean(game.tags?.includes(tab))
}

/*
 * Two tiles of one colour must not share an edge, at any width. The grid is
 * laid out here the way CSS dense auto-placement will lay it out at each of
 * its column counts, and the games keep their shelf order except that the
 * next one placed is the first that touches no tile of its own colour in
 * any of those layouts. When that runs into a corner, a few seeded runs try
 * other clean choices and the arrangement with the fewest clashes wins. A
 * lead, when one is given, goes first whatever happens.
 */
const WALL_COLUMNS = [6, 5, 4, 3, 2]

type Span = { w: number; h: number }
type Placed = Span & { c: number; r: number; accent: string }

function cellsOf(p: Span & { c: number; r: number }): string[] {
  const out: string[] = []
  for (let dr = 0; dr < p.h; dr++) {
    for (let dc = 0; dc < p.w; dc++) out.push(`${p.c + dc},${p.r + dr}`)
  }
  return out
}

/** Where dense auto-placement puts the next item of this span in a grid this wide. */
function slotFor(placed: Placed[], span: Span, cols: number): { c: number; r: number } {
  const taken = new Set(placed.flatMap(cellsOf))
  for (let r = 0; ; r++) {
    for (let c = 0; c + span.w <= cols; c++) {
      if (cellsOf({ ...span, c, r }).every((k) => !taken.has(k))) return { c, r }
    }
  }
}

function touches(a: Placed, b: Placed): boolean {
  const colsOverlap = a.c < b.c + b.w && b.c < a.c + a.w
  const rowsOverlap = a.r < b.r + b.h && b.r < a.r + a.h
  return (
    (colsOverlap && (a.r + a.h === b.r || b.r + b.h === a.r)) ||
    (rowsOverlap && (a.c + a.w === b.c || b.c + b.w === a.c))
  )
}

/** Seeded, so the wall settles the same way on every render. */
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Placed tiles of one colour that share an edge, summed over every layout. */
function clashesIn(layouts: Placed[][]): number {
  let n = 0
  for (const placed of layouts) {
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i]!
        const b = placed[j]!
        if (a.accent === b.accent && touches(a, b)) n++
      }
    }
  }
  return n
}

function arrangeOnce(
  list: Game[],
  lead: string | null,
  spanOf: (g: Game) => Span,
  random: (() => number) | null,
): { order: Game[]; clashes: number } {
  const pool = [...list]
  const out: Game[] = []
  const layouts = WALL_COLUMNS.map(() => [] as Placed[])
  const placeIn = (g: Game, placed: Placed[], cols: number): Placed => {
    const span = spanOf(g)
    return { ...span, ...slotFor(placed, span, cols), accent: g.accent }
  }
  const take = (i: number) => {
    const g = pool.splice(i, 1)[0]
    if (!g) return
    out.push(g)
    layouts.forEach((placed, li) => placed.push(placeIn(g, placed, WALL_COLUMNS[li]!)))
  }

  const leadAt = pool.findIndex((g) => g.slug === lead)
  if (leadAt >= 0) take(leadAt)
  while (pool.length) {
    const scored = pool.map((g) => {
      let clashes = 0
      layouts.forEach((placed, li) => {
        const at = placeIn(g, placed, WALL_COLUMNS[li]!)
        clashes += placed.filter((p) => p.accent === g.accent && touches(p, at)).length
      })
      return clashes
    })
    const fewest = Math.min(...scored)
    const clean = scored.flatMap((c, i) => (c === fewest ? [i] : []))
    // Shelf order first; a seeded run sometimes takes another clean candidate instead.
    const pick = random && clean.length > 1 && random() < 0.5 ? clean[Math.floor(random() * clean.length)]! : clean[0]!
    take(pick)
  }
  return { order: out, clashes: clashesIn(layouts) }
}

function arrangeWall(list: Game[], lead: string | null, spanOf: (g: Game) => Span): Game[] {
  let best = arrangeOnce(list, lead, spanOf, null)
  for (let seed = 1; seed <= 24 && best.clashes > 0; seed++) {
    const next = arrangeOnce(list, lead, spanOf, rng(seed))
    if (next.clashes < best.clashes) best = next
  }
  return best.order
}

/** Still being tuned, or on its way: the games with a row of their own. */
function isFresh(game: Game) {
  return Boolean(game.inDevelopment || isComingSoon(game))
}

const ONE: Span = { w: 1, h: 1 }

/** The places in a cabinet's high-score table: its players, each at their best. */
const PLACES = ['1st', '2nd', '3rd']

/**
 * What the number under a cabinet's screen is: the top of the board for the period, or, on a board nobody has
 * played this period, the game's high score of all time, the HI SCORE its page's screen shows.
 */
const TOP: Record<LeaderboardPeriod, string> = {
  daily: 'Top today',
  weekly: 'Top this week',
  monthly: 'Top this month',
  all: 'Top all time',
  season: 'Top this season',
}

const CrownIcon = () => (
  <svg className="wall-tile__crown" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M3 8.2l4.6 3.6L12 5l4.4 6.8L21 8.2l-2 9.8H5z" />
  </svg>
)

const PlayGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
  </svg>
)

const ChevronIcon = () => (
  <svg className="wall-tile__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M9 6l6 6-6 6" />
  </svg>
)

/**
 * The wall: every game but the dailies (they're on today's ticket, above it)
 * as an arcade cabinet, in a grid that runs five across on a desktop and three
 * on a phone, and no two cabinets of one colour side by side. The finished
 * games stand on the floor together, a newer one with a New badge (Ramsey,
 * 2026-10-14: "we don't need the 'New on the floor' section on home page, all
 * games can be together"). Each cabinet's screen shows its game, which
 * plays when asked, and a tap on it goes straight to the game; under the
 * screen go the name, the board's top score with who holds it, and where you
 * are, all of it the way to the game's page (D on the "Home page redesign"
 * canvas, 2026-10-15). Today's event's game and the weekly's wear a badge. With
 * `puzzles`, the day's puzzles, just for fun, take two cells at the end of the
 * floor. Tabs along the top cut the wall by what kind of game it is, and say
 * how many of each.
 */
export function GameWall({ puzzles: withPuzzles = false }: { puzzles?: boolean } = {}) {
  const device = useDeviceType()
  const cleaned = normalizePlayerName(usePlayerName())
  const period = useDefaultPeriod()
  const { official } = useLiveEvents(cleaned)
  const [tab, setTab] = useState<Tab>('all')
  // Your best on each game, where you stand on each board (from the rank the
  // header already fetched), and who leads each board.
  const bests = usePlayerBests(cleaned, period)
  const { byGame } = useGlobalRank()
  const { leaders, failed } = useBoardLeaders(period)
  // The day's puzzles (lib/today.ts alsoDailies), from the same punches as the ticket above.
  const viewer = useAccountId()
  const { also } = useTicket(viewer)

  const all = wallGames(device)
  const shown = all.filter((g) => inTab(g, tab))
  const floor = arrangeWall(shown, null, () => ONE)
  const puzzles = withPuzzles && (tab === 'all' || tab === 'puzzle') && also.length > 0
  // Today's event's game and the weekly's wear their badges on the wall.
  const dailySlug = official.find((t) => t.cadence === 'daily')?.games[0] ?? null
  const weekly = new Set(official.find((t) => t.cadence === 'weekly')?.games ?? [])

  const cabinet = (game: Game, index: number) => (
    <WallTile
      key={game.slug}
      game={game}
      index={index}
      best={bests?.[game.slug] ?? null}
      standing={byGame[game.slug] ?? null}
      top={leaders ? (leaders[game.slug] ?? null) : undefined}
      asking={!failed}
      daily={game.slug === dailySlug}
      weekly={weekly.has(game.slug)}
      newFlag={isFresh(game)}
      preview
      hunt={index === 0 ? 'home-wall' : undefined}
    />
  )

  return (
    <section className="wall" id="games" aria-labelledby="games-heading">
      <div className="wall__bar">
        <h2 id="games-heading" className="wall__title">
          Games
        </h2>
        <span className="wall__count">{shown.length} on the floor</span>
        {/* Tabs over the wall: one Tab stop, and the arrow keys move along them (lib/choiceKeys.ts). */}
        <div className="chips wall__tabs" role="tablist" aria-label="Kind of game" onKeyDown={moveChoice}>
          {TABS.map((t) => {
            const count = all.filter((g) => inTab(g, t.id)).length
            if (count === 0) return null
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                tabIndex={tab === t.id ? 0 : -1}
                className={`chips__item${tab === t.id ? ' chips__item--active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                <span className="wall__tab-n">{count}</span>
              </button>
            )
          })}
        </div>
      </div>
      {floor.length > 0 || puzzles ? (
        <ul className="wall__grid">
          {floor.map((g, i) => cabinet(g, i))}
          {puzzles ? (
            // Two cabinets wide at any width, the puzzles one under another (a phone's three side by side), as the
            // canvas has it: across a whole row they spread thin.
            <li className="wall__cell wall__cell--also">
              <AlsoToday punches={also} look="tile" />
            </li>
          ) : null}
        </ul>
      ) : null}
    </section>
  )
}

export function WallTile({
  game,
  index,
  best,
  standing = null,
  top,
  asking = true,
  daily = false,
  weekly = false,
  newFlag = true,
  preview = false,
  hunt,
}: {
  game: Game
  index: number
  /** Your top score on this game for the period, when you have one. */
  best: number | null
  /** Your place on this game's board for the period, and how many are on it, when you are. */
  standing?: GlobalGamePlace | null
  /**
   * The board's top players: the high score under the screen, and the table over it. Null: nobody has a score
   * yet. Undefined: not known yet, or they didn't come.
   */
  top?: BoardLeader | null
  /** Who leads is still being asked: the line under the screen shimmers rather than standing empty. */
  asking?: boolean
  daily?: boolean
  weekly?: boolean
  /** Badge a game still being tuned as new; off where its row already says so. */
  newFlag?: boolean
  /** Marks the tile as somewhere the bug hunt's bug can hide. */
  hunt?: string
  /** Let a game that can play itself do so on the screen, over its thumb. */
  preview?: boolean
}) {
  const period = useDefaultPeriod()
  const you = normalizePlayerName(usePlayerName())
  const accent = resolveGameAccent(game.slug, game.accent)
  const live = preview && hasGamePreview(game.slug)
  const spotlight = isSpotlight(liveSeason(useSeason()), game.slug)
  const style = {
    '--tile-accent': accent,
    '--tile-text': tileText(accent),
    animationDelay: `${Math.min(index, 12) * 0.04}s`,
  } as CSSProperties
  const flag = isComingSoon(game)
    ? { label: comingWords(game), kind: 'soon' }
    : daily
      ? { label: 'Today’s event', kind: 'daily' }
      : weekly
        ? { label: 'Weekly', kind: 'weekly' }
        : newFlag && game.inDevelopment
          ? { label: 'New', kind: 'new' }
          : spotlight
            ? { label: 'Season skins', kind: 'spotlight' }
            : null
  const fmt = (score: number) => formatLeaderboardScore(game.slug, score)
  // Your best and place are the period's: on a daily, that's its day points (leaderboardFormat isDayPointsBoard).
  const fmtBest = (score: number) => formatBoardScore(game.slug, score, period)
  const place = standing?.place ?? null
  const total = standing?.total ?? null
  const when = periodWord(period)
  const rows = top ? (top.entries.length > 0 ? top.entries : [top.entry]) : []
  const kind = (game.tags ?? []).map((tag) => TAG_LABELS[tag]).join(' · ') || 'Game'
  // Where you are, after what the number is: your place on the period's board, else your best; with neither,
  // or signed out, nothing.
  const mine = place ? `you’re ${ordinal(place)}${total ? ` of ${total}` : ''}` : best ? `your best ${fmtBest(best)}` : null
  const label = [
    game.name,
    flag ? flag.label.toLowerCase() : null,
    // Not known yet, or it didn't come: nothing said of who leads.
    top
      ? top.period === 'all'
        ? `high score ${fmt(top.entry.score)} by ${top.entry.name}, all time`
        : `best ${periodWord(top.period)} ${fmt(top.entry.score)} by ${top.entry.name}`
      : top === null
        ? 'no high score yet'
        : null,
    place ? `you are #${place}${total ? ` of ${total}` : ''} ${when}` : null,
    best ? `your best ${fmtBest(best)}` : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <li className="wall__cell" data-hunt={hunt}>
      <div className="wall-tile" style={style}>
        {/* The screen is the way straight in: a tap on it opens the game itself, not its page (the launch review's
            "fewer taps to play"). The game plays on it under a pointer, as ever. */}
        <a className="wall-tile__screen" href={gamePlayHref(game.slug)} aria-label={`Play ${game.name}`}>
          <span className="wall-tile__art" aria-hidden="true">
            <GameArt slug={game.slug} shape="card" fallback={<GameThumbArt slug={game.slug} accent={accent} />} />
          </span>
          {live ? <GamePreview slug={game.slug} className="wall-tile__preview" hoverOnly /> : null}
          {flag ? (
            <span className={`wall-tile__flag wall-tile__flag--${flag.kind}`} aria-hidden="true">
              {flag.label}
            </span>
          ) : null}
          <span className="wall-tile__scores" aria-hidden="true">
            <span className="wall-tile__scores-head">
              High scores
              {top ? <small>{game.daily ? 'Today' : top.period === 'all' ? 'All time' : PERIOD_LABELS[top.period]}</small> : null}
            </span>
            {rows.length > 0 ? (
              rows.map((e, i) => (
                <span
                  key={e.name}
                  className={`wall-tile__score${you && e.name === you ? ' wall-tile__score--you' : ''}`}
                >
                  <span className="wall-tile__score-place">{PLACES[i]}</span>
                  <span className="wall-tile__score-name">{e.name}</span>
                  <span className="wall-tile__score-value">{fmt(e.score)}</span>
                </span>
              ))
            ) : top === null ? (
              <>
                <span className="wall-tile__score-none">No scores yet</span>
                <span className="wall-tile__score-hint">The first run posted holds the record.</span>
              </>
            ) : asking ? (
              PLACES.map((p) => (
                <span key={p} className="wall-tile__score">
                  <span className="skel-line" style={{ '--skel-w': '100%' } as CSSProperties} />
                </span>
              ))
            ) : (
              <span className="wall-tile__score-hint">The scores didn’t load.</span>
            )}
          </span>
          <span className="wall-tile__play" aria-hidden="true">
            <PlayGlyph />
            <span className="wall-tile__play-word">Play</span>
          </span>
        </a>
        <a className="wall-tile__info" href={gameHref(game.slug)} aria-label={label}>
          <span className="wall-tile__title" aria-hidden="true">
            <span className="wall-tile__name">{game.name}</span>
            <span className="wall-tile__kind">{kind}</span>
          </span>
          {/* A pointer on the scores brings the board's table up over the screen. */}
          <span className="wall-tile__lines" aria-hidden="true">
            {/* The board's top score, the number a cabinet is played to beat, and who holds it. */}
            <span className="wall-tile__top">
              <CrownIcon />
              {top ? (
                <>
                  <b className="wall-tile__figure">{fmt(top.entry.score)}</b>
                  <span className="wall-tile__who">
                    <PlayerAvatar avatarId={top.entry.avatarId} name={top.entry.name} size="xs" />
                    <span className="wall-tile__who-name">{top.entry.name}</span>
                  </span>
                </>
              ) : top === null ? (
                <span className="wall-tile__open">No score yet</span>
              ) : asking ? (
                // Who leads isn't known yet: nothing said, and the line holds its height.
                <span className="wall-tile__open">
                  <span className="skel-line" style={{ '--skel-w': '6.5rem' } as CSSProperties} />
                </span>
              ) : (
                // It didn't come: nothing said either way.
                <span className="wall-tile__open">—</span>
              )}
              <ChevronIcon />
            </span>
            {/* Whose board the number tops (the period's, or all time's where nobody has played the period), then
                you; on a board nobody is on, what the first run gets. */}
            <span className="wall-tile__sub">
              {top === null ? (
                <span className="wall-tile__when">First run takes it</span>
              ) : (
                <>
                  <span className="wall-tile__when">{TOP[top?.period ?? period]}</span>
                  {mine ? <span className="wall-tile__mine">{mine}</span> : null}
                </>
              )}
            </span>
          </span>
        </a>
      </div>
    </li>
  )
}
