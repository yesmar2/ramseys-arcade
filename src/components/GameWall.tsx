import { useState, type CSSProperties } from 'react'
import { homeGames, TAG_LABELS, type Game, type GameTag } from '../data/games'
import { useBoardLeaders, type BoardLeader } from '../hooks/useBoardLeaders'
import { gameHref } from '../hooks/useHashRoute'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { usePlayerBests } from '../hooks/usePlayerBests'
import { usePlayerName } from '../hooks/usePlayerName'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { useDeviceType } from '../lib/device'
import { hasGamePreview } from '../lib/gamePreviews'
import { useGlobalRank } from '../lib/globalRank'
import { normalizePlayerName, PERIOD_LABELS, type GlobalGamePlace } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { numberWord } from '../lib/numberWord'
import { resolveGameAccent } from '../lib/theme'
import { GamePreview } from './GamePreview'
import { GameThumbArt } from './GameThumbArt'

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
  if (tab === 'new') return Boolean(game.inDevelopment || game.comingSoon)
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
  return Boolean(game.inDevelopment || game.comingSoon)
}

const ONE: Span = { w: 1, h: 1 }

/**
 * The wall: every game as an arcade cabinet, in a grid that runs five across
 * on a desktop and two on a phone, and no two cabinets of one colour side by
 * side. The finished games stand on the floor; the ones still being tuned get
 * a row of their own under them. Each cabinet's screen shows its game, which
 * plays when asked; under the screen go the name, the board's high score and
 * yours. The daily's game and the weekly's wear a badge. Tabs along the top
 * cut the wall by what kind of game it is, and say how many of each there are.
 */
export function GameWall() {
  const device = useDeviceType()
  const cleaned = normalizePlayerName(usePlayerName())
  const period = useDefaultPeriod()
  const { official } = useLiveEvents(cleaned)
  const [tab, setTab] = useState<Tab>('all')
  // Your best on each game, where you stand on each board (from the rank the
  // header already fetched), and who leads each board.
  const bests = usePlayerBests(cleaned, period)
  const { byGame } = useGlobalRank()
  const leaders = useBoardLeaders(period)

  const all = homeGames(device)
  const shown = all.filter((g) => inTab(g, tab))
  const floor = arrangeWall(shown.filter((g) => !isFresh(g)), null, () => ONE)
  const fresh = arrangeWall(shown.filter(isFresh), null, () => ONE)
  // The daily's game and the weekly's wear their badges on the wall.
  const dailySlug = official.find((t) => t.cadence === 'daily')?.games[0] ?? null
  const weekly = new Set(official.find((t) => t.cadence === 'weekly')?.games ?? [])

  const cabinet = (game: Game, index: number) => (
    <WallTile
      key={game.slug}
      game={game}
      index={index}
      best={bests?.[game.slug] ?? null}
      standing={byGame[game.slug] ?? null}
      top={leaders?.[game.slug] ?? null}
      daily={game.slug === dailySlug}
      weekly={weekly.has(game.slug)}
      newFlag={false}
      preview
    />
  )

  return (
    <section className="wall" id="games" aria-labelledby="games-heading">
      <div className="wall__bar">
        <h2 id="games-heading" className="wall__title">
          Games
        </h2>
        <span className="wall__count">{shown.length} on the floor</span>
        <div className="chips wall__tabs" role="tablist" aria-label="Kind of game">
          {TABS.map((t) => {
            const count = all.filter((g) => inTab(g, t.id)).length
            if (count === 0) return null
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
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
      {floor.length > 0 ? <ul className="wall__grid">{floor.map((g, i) => cabinet(g, i))}</ul> : null}
      {fresh.length > 0 ? (
        <>
          <div className="wall__sub">
            <h3 className="wall__subtitle">New on the floor</h3>
            <p className="wall__subnote">
              {tab !== 'all' && tab !== 'new'
                ? 'Still being tuned.'
                : fresh.length === 1
                  ? 'The newest, still being tuned.'
                  : `The ${numberWord(fresh.length)} newest, still being tuned.`}
            </p>
          </div>
          <ul className="wall__grid">{fresh.map((g, i) => cabinet(g, floor.length + i))}</ul>
        </>
      ) : null}
    </section>
  )
}

export function WallTile({
  game,
  index,
  best,
  standing = null,
  top = null,
  daily = false,
  weekly = false,
  newFlag = true,
  preview = false,
}: {
  game: Game
  index: number
  /** Your top score on this game for the period, when you have one. */
  best: number | null
  /** Your place on this game's board for the period, and how many are on it, when you are. */
  standing?: GlobalGamePlace | null
  /** Who leads the board: the high score under the screen. */
  top?: BoardLeader | null
  daily?: boolean
  weekly?: boolean
  /** Badge a game still being tuned as new; off where its row already says so. */
  newFlag?: boolean
  /** Let a game that can play itself do so on the screen, over its thumb. */
  preview?: boolean
}) {
  const period = useDefaultPeriod()
  const accent = resolveGameAccent(game.slug, game.accent)
  const live = preview && hasGamePreview(game.slug)
  const style = {
    '--tile-accent': accent,
    animationDelay: `${Math.min(index, 12) * 0.04}s`,
  } as CSSProperties
  const flag = game.comingSoon
    ? { label: 'Coming soon', kind: 'soon' }
    : daily
      ? { label: 'Daily', kind: 'daily' }
      : weekly
        ? { label: 'Weekly', kind: 'weekly' }
        : newFlag && game.inDevelopment
          ? { label: 'New', kind: 'new' }
          : null
  const fmt = (score: number) => formatLeaderboardScore(game.slug, score)
  const place = standing?.place ?? null
  const total = standing?.total ?? null
  const periodWord = PERIOD_LABELS[period].toLowerCase()
  const kind =(game.tags ?? []).map((tag) => TAG_LABELS[tag]).join(' · ') || 'Game'
  const label = [
    game.name,
    flag ? flag.label.toLowerCase() : null,
    top
      ? `high score ${fmt(top.entry.score)} by ${top.entry.name}${top.period === 'all' ? ', all time' : ''}`
      : 'no high score yet',
    place ? `you are #${place}${total ? ` of ${total}` : ''} ${periodWord}` : null,
    best ? `your best ${fmt(best)}` : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <li className="wall__cell">
      <a className="wall-tile" href={gameHref(game.slug)} style={style} aria-label={label}>
        <span className="wall-tile__screen">
          <span className="wall-tile__art" aria-hidden="true">
            <GameThumbArt slug={game.slug} accent={accent} />
          </span>
          {live ? <GamePreview slug={game.slug} className="wall-tile__preview" /> : null}
          {flag ? (
            <span className={`wall-tile__flag wall-tile__flag--${flag.kind}`} aria-hidden="true">
              {flag.label}
            </span>
          ) : null}
        </span>
        <span className="wall-tile__info" aria-hidden="true">
          <span className="wall-tile__title">
            <span className="wall-tile__name">{game.name}</span>
            <span className="wall-tile__kind">{kind}</span>
          </span>
          <span className="wall-tile__line">
            <span className="wall-tile__tag">HI</span>
            {top ? (
              <>
                <b className="wall-tile__figure">{fmt(top.entry.score)}</b>
                <span className="wall-tile__who">{top.entry.name}</span>
              </>
            ) : (
              <span>
                open<span className="wall-tile__roomy">, first run takes it</span>
              </span>
            )}
          </span>
          {place || best ? (
            <span className="wall-tile__line">
              <span className="wall-tile__tag wall-tile__tag--you">YOU</span>
              <span className="wall-tile__mine">
                {place ? (
                  <>
                    #{place}
                    <span className="wall-tile__roomy"> {periodWord}</span>
                  </>
                ) : null}
                {place && best ? ' · ' : null}
                {best ? fmt(best) : null}
              </span>
            </span>
          ) : null}
        </span>
      </a>
    </li>
  )
}
