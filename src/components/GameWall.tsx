import { useEffect, useState, type CSSProperties } from 'react'
import { games, homeGames, type Game, type GameTag } from '../data/games'
import { gameHref } from '../hooks/useHashRoute'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { usePlayerName } from '../hooks/usePlayerName'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { useDeviceType } from '../lib/device'
import { useActiveGroup } from '../lib/groups'
import { heroSlug } from '../lib/homePicks'
import { useRecentGames } from '../lib/lastPlayed'
import { fetchPlayerBests, normalizePlayerName } from '../lib/leaderboard'
import { resolveGameAccent } from '../lib/theme'
import { GameThumbArt } from './GameThumbArt'

type Tab = 'all' | GameTag | 'new'

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'arcade', label: 'Arcade' },
  { id: 'puzzle', label: 'Puzzle' },
  { id: 'quick', label: 'Quick play' },
  { id: 'sport', label: 'Sport' },
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
 * any of those layouts. The big tile leads whatever happens.
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

function arrangeWall(list: Game[], lead: string | null, spanOf: (g: Game) => Span): Game[] {
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
    let best = 0
    let fewest = Infinity
    for (let i = 0; i < pool.length && fewest > 0; i++) {
      const g = pool[i]!
      let clashes = 0
      layouts.forEach((placed, li) => {
        const at = placeIn(g, placed, WALL_COLUMNS[li]!)
        clashes += placed.filter((p) => p.accent === g.accent && touches(p, at)).length
      })
      if (clashes < fewest) {
        best = i
        fewest = clashes
      }
    }
    take(best)
  }
  return out
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
  const groupId = useActiveGroup()
  const recent = useRecentGames()
  const { official } = useLiveEvents(cleaned)
  const [tab, setTab] = useState<Tab>('all')
  const [bests, setBests] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    if (!cleaned) {
      setBests(null)
      return
    }
    let cancelled = false
    fetchPlayerBests(cleaned, period)
      .then((next) => {
        if (!cancelled) setBests(next)
      })
      .catch(() => {
        if (!cancelled) setBests(null)
      })
    return () => {
      cancelled = true
    }
  }, [cleaned, period, groupId])

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
            daily={game.slug === dailySlug}
          />
        ))}
      </ul>
    </section>
  )
}

function WallTile({
  game,
  index,
  size,
  best,
  daily,
}: {
  game: Game
  index: number
  size: 'one' | 'wide' | 'big'
  best: number | null
  daily: boolean
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
  return (
    <li className={`wall__cell wall__cell--${size}`}>
      <a
        className="wall-tile"
        href={gameHref(game.slug)}
        style={style}
        aria-label={flag ? `${game.name}, ${flag.label.toLowerCase()}` : game.name}
      >
        <span className="wall-tile__art" aria-hidden="true">
          <GameThumbArt slug={game.slug} accent={accent} />
        </span>
        {flag ? (
          <span className={`wall-tile__flag wall-tile__flag--${flag.kind}`}>{flag.label}</span>
        ) : null}
        <span className="wall-tile__meta">
          <span className="wall-tile__name">{game.name}</span>
          {best ? (
            <span className="wall-tile__best">
              Best <b>{best.toLocaleString()}</b>
            </span>
          ) : null}
        </span>
      </a>
    </li>
  )
}
