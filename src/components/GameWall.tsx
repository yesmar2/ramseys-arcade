import { useState, type CSSProperties } from 'react'
import { games, homeGames, TAG_LABELS, type Game, type GameTag } from '../data/games'
import { useBoardLeaders, type BoardLeader } from '../hooks/useBoardLeaders'
import { gameHref } from '../hooks/useHashRoute'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { usePlayerBests } from '../hooks/usePlayerBests'
import { usePlayerName } from '../hooks/usePlayerName'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { useDeviceType } from '../lib/device'
import { hasGamePreview } from '../lib/gamePreviews'
import { useGlobalRank } from '../lib/globalRank'
import { heroSlug } from '../lib/homePicks'
import { useRecentGames } from '../lib/lastPlayed'
import { normalizePlayerName, type GlobalGamePlace } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
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
 * other clean choices and the arrangement with the fewest clashes wins. The
 * big tile leads whatever happens.
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

/**
 * The wall: every game, edge to edge, in a grid that runs six across on a
 * wide screen and two on a phone. The first game on the shelf takes a
 * two-by-two cell and the newest takes two across, so the grid has a rhythm
 * rather than a beat. Each game's thumb sits in its tile on a block of its
 * colour, with the name under it, and no two tiles of one colour touch. The
 * daily's game wears a badge. Tabs along the top cut the wall by what kind of
 * game it is.
 */
export function GameWall() {
  const device = useDeviceType()
  const name = usePlayerName()
  const cleaned = normalizePlayerName(name)
  const period = useDefaultPeriod()
  const recent = useRecentGames()
  const { official } = useLiveEvents(cleaned)
  const [tab, setTab] = useState<Tab>('all')
  // Your best on each game, where you stand on each board (from the rank the
  // header already fetched), and who leads each board where you have neither.
  const bests = usePlayerBests(cleaned, period)
  const { byGame } = useGlobalRank()
  const leaders = useBoardLeaders(period)

  const all = homeGames(device)
  const shown = all.filter((g) => inTab(g, tab))
  // The banner above already has the hero; the wall's big cell goes to the next shelf game.
  const hero = heroSlug(device, recent)
  const big = shown.find((g) => g.slug !== hero && !g.inDevelopment && !g.comingSoon)?.slug ?? null
  const newest = games.filter((g) => !g.hidden).at(-1)?.slug ?? null
  const sizeOf = (g: Game): 'one' | 'wide' | 'big' =>
    g.slug === big ? 'big' : g.slug === newest && shown.length > 4 ? 'wide' : 'one'
  const ordered = arrangeWall(shown, big, (g) => {
    const size = sizeOf(g)
    return size === 'big' ? { w: 2, h: 2 } : size === 'wide' ? { w: 2, h: 1 } : { w: 1, h: 1 }
  })
  // The daily's game wears its badge on the wall.
  const dailySlug = official.find((t) => t.cadence === 'daily')?.games[0] ?? null

  return (
    <section className="wall" aria-labelledby="games-heading">
      <div className="wall__bar">
        <h2 id="games-heading" className="wall__title">
          Games
        </h2>
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
              </button>
            )
          })}
        </div>
        <span className="wall__count">
          {shown.length} {shown.length === 1 ? 'game' : 'games'}
        </span>
      </div>
      <ul className="wall__grid">
        {ordered.map((game, index) => (
          <WallTile
            key={game.slug}
            game={game}
            index={index}
            size={sizeOf(game)}
            best={bests?.[game.slug] ?? null}
            standing={byGame[game.slug] ?? null}
            top={leaders?.[game.slug] ?? null}
            daily={game.slug === dailySlug}
            preview
          />
        ))}
      </ul>
    </section>
  )
}

export function WallTile({
  game,
  index,
  size,
  best,
  standing = null,
  top = null,
  daily,
  preview = false,
}: {
  game: Game
  index: number
  size: 'one' | 'wide' | 'big'
  /** Your top score on this game for the period, when you have one. */
  best: number | null
  /** Your place on this game's board for the period, and how many are on it, when you are. */
  standing?: GlobalGamePlace | null
  /** Who leads this game's board: shown where you have no numbers of your own. */
  top?: BoardLeader | null
  daily: boolean
  /** Let a game that can play itself do so in the tile, over its thumb. */
  preview?: boolean
}) {
  const accent = resolveGameAccent(game.slug, game.accent)
  const style = {
    '--tile-accent': accent,
    animationDelay: `${Math.min(index, 12) * 0.04}s`,
  } as CSSProperties
  const flag = game.inDevelopment
    ? { label: 'New', kind: 'new' }
    : game.comingSoon
      ? { label: 'Coming soon', kind: 'soon' }
      : daily
        ? { label: 'Daily', kind: 'daily' }
        : null
  const place = standing?.place ?? null
  const total = standing?.total ?? null
  const yours = Boolean(place || best)
  // The high score on the cabinet: this period's, or the all-time holder while nobody has posted yet.
  const topWord = top?.period === 'all' ? 'All time' : 'Top score'
  const label = [
    game.name,
    flag ? flag.label.toLowerCase() : null,
    place ? `you are #${place}${total ? ` of ${total}` : ''}` : null,
    best ? `best score ${formatLeaderboardScore(game.slug, best)}` : null,
    !yours && top
      ? `${topWord.toLowerCase()} ${formatLeaderboardScore(game.slug, top.entry.score)} by ${top.entry.name}`
      : null,
  ]
    .filter(Boolean)
    .join(', ')
  // With no score of yours and none on the board, the band says what kind of game this is.
  const kind = (game.tags ?? []).map((tag) => TAG_LABELS[tag]).join(' · ') || 'Game'
  return (
    <li className={`wall__cell wall__cell--${size}`}>
      <a className="wall-tile" href={gameHref(game.slug)} style={style} aria-label={label}>
        <span className="wall-tile__body">
          <span className="wall-tile__art" aria-hidden="true">
            <GameThumbArt slug={game.slug} accent={accent} />
          </span>
          {preview && hasGamePreview(game.slug) ? (
            <GamePreview slug={game.slug} className="wall-tile__preview" />
          ) : null}
          {flag ? (
            <span className={`wall-tile__flag wall-tile__flag--${flag.kind}`}>{flag.label}</span>
          ) : null}
          <span className="wall-tile__name" aria-hidden="true">
            {game.name}
          </span>
        </span>
        <span className="wall-tile__foot" aria-hidden="true">
          {yours ? (
            <>
              <span className="wall-tile__best">
                {best ? (
                  <>
                    Best score <b>{formatLeaderboardScore(game.slug, best)}</b>
                  </>
                ) : (
                  'No score yet'
                )}
              </span>
              {place ? (
                <span className={`wall-tile__rank${place <= 3 ? ' wall-tile__rank--podium' : ''}`}>
                  #{place}
                  {total ? <small> of {total.toLocaleString()}</small> : null}
                </span>
              ) : null}
            </>
          ) : top ? (
            <>
              <span className="wall-tile__best">
                {topWord} <b>{formatLeaderboardScore(game.slug, top.entry.score)}</b>
              </span>
              <span className="wall-tile__leader">{top.entry.name}</span>
            </>
          ) : (
            <span className="wall-tile__kind">{kind}</span>
          )}
        </span>
      </a>
    </li>
  )
}
