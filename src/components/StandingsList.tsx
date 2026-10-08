import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { focusFromUrl, ROUTE_EVENT } from '../hooks/useHashRoute'
import { useHeldShape } from '../lib/heldShape'
import { ordinal, type LastFinal, type Standing, type YouStanding } from '../lib/scoreboard'
import { PlayerMark } from './PlayerMark'
import { PlayerName } from './PlayerName'

/*
 * The standings as a list: the top ten, and everyone below them a press at a time, in place, with a box to
 * find a player and the viewer's own row under a gap when they're further down. There used to be a Rankings
 * page for the rest; this is it now. The boards page shows a period's (BoardsScoreboard); a season's are on
 * its Season tab and on the Season page, with a line under the places that win its cup and under the ones
 * that win a trophy (Ramsey picked "A" of the "Season standings" canvas, and the Season page's list "like it
 * is on the Standings page", 2026-10-08).
 */

const MEDALS = ['gold', 'silver', 'bronze'] as const

export function TrophyIcon() {
  return (
    <svg className="sb-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M17 5h3v1a3 3 0 0 1-3 3" />
      <path d="M7 5H4v1a3 3 0 0 0 3 3" />
    </svg>
  )
}

/** What the list shows, wherever it comes from: a period's standings, or the season's. */
export type StandingsFeed = {
  /** Names the room it holds while loading, and its find box: the period, or 'season'. */
  key: string
  loading: boolean
  /** The top ten. */
  standings: Standing[]
  totalPlayers: number
  /** The viewer, when they have a name; `rank` is null until they're on the standings. */
  you: YouStanding | null
  /** Players from place `offset + 1`, for Show more. */
  more: (offset: number, limit: number) => Promise<Standing[]>
  /** Up to ten players whose tag holds `q`, with their places. */
  find: (q: string) => Promise<Standing[]>
  /** Where a player's row goes. */
  rowHref: (name: string) => string
}

/** The lines under the places that win something when a season ends: its cup's, then the trophies'. */
export type StandingsLines = {
  /** The last place that takes the cup, or null while too few are playing for it. */
  cup: number | null
  /** The last place that takes a trophy, or null while too few are playing for it. */
  trophy: number | null
  cupLabel: string
  trophyLabel: string
}

/** How the period before finished, under a thin list (the boards page's weeks and months). */
export type StandingsLast = {
  /** Whether the period has one before it to show, and so room to hold for it while loading. */
  expected: boolean
  rows: LastFinal | null
  title: string
  note: string
  rowHref: (name: string) => string
}

type RowData = { rank: number; name: string; score: number; games: number; avatarId?: string }

function StandingRow({
  row,
  leaderScore,
  you,
  href,
  deep = false,
}: {
  row: RowData
  leaderScore: number
  you: string
  href: string
  /** Past the fifth: a phone shows the top five and your own row, not the rest. */
  deep?: boolean
}) {
  const mine = Boolean(you) && row.name === you
  const medal = MEDALS[row.rank - 1]
  const width = leaderScore > 0 ? Math.max(2, (row.score / leaderScore) * 100) : 0
  const cls = [
    'sb-row',
    medal ? `sb-row--${medal}` : '',
    mine ? 'sb-row--you' : '',
    deep && !mine ? 'sb-row--deep' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <li className={cls}>
      <a className="sb-row__link" href={href}>
        <span className="sb-row__ord">{ordinal(row.rank).toUpperCase()}</span>
        <PlayerMark name={row.name} avatarId={row.avatarId} className="sb-row__mark" />
        <span className="sb-row__who">
          <PlayerName className="sb-row__name" name={row.name} avatarId={row.avatarId} />
          <span className="sb-row__boards">
            {row.games} {row.games === 1 ? 'game' : 'games'}
            {mine ? <span className="sb-row__you">You</span> : null}
          </span>
        </span>
        <span className="sb-row__bar" aria-hidden="true">
          <span style={{ width: `${width}%` }} />
        </span>
        <span className="sb-row__pts">
          {row.score.toLocaleString()}
          <small> pts</small>
        </span>
      </a>
    </li>
  )
}

function OpenRow({ rank }: { rank: number }) {
  return (
    <li className="sb-row sb-row--open">
      <span className="sb-row__link">
        <span className="sb-row__ord">{ordinal(rank).toUpperCase()}</span>
        <span className="sb-row__mark sb-row__mark--open" aria-hidden="true" />
        <span className="sb-row__who">
          <span className="sb-row__name">Open</span>
          <span className="sb-row__boards">One run gets you here</span>
        </span>
        <span className="sb-row__bar sb-row__bar--open" aria-hidden="true" />
        <span className="sb-row__pts">–</span>
      </span>
    </li>
  )
}

/** The line under the last place that wins something. On a phone it hides with the rows above it. */
function PrizeLine({ kind, label, deep }: { kind: 'cup' | 'trophy'; label: string; deep: boolean }) {
  return (
    <li className={`sb-line sb-line--${kind}${deep ? ' sb-row--deep' : ''}`}>
      <TrophyIcon />
      <span>{label}</span>
    </li>
  )
}

/** Players added to the list each time Show more is pressed. */
export const MORE_STANDINGS = 25

/**
 * The list, in its card. A link that asks for the standings (`?focus=standings`) opens a `focusable` one and
 * brings it into view.
 */
export function StandingsList({
  feed,
  you,
  title = 'Standings',
  sub = null,
  how = null,
  lines = null,
  last = null,
  foot = null,
  focusable = false,
  hunt,
  id,
}: {
  feed: StandingsFeed
  you: string
  title?: string
  /** A line under the title: what the points are. */
  sub?: ReactNode
  /** Where "How your rank works ›" goes; no link without one. */
  how?: string | null
  lines?: StandingsLines | null
  last?: StandingsLast | null
  /** A line under the list. */
  foot?: ReactNode
  focusable?: boolean
  /** The bug hunt's spot (data-hunt). */
  hunt?: string
  id?: string
}) {
  const { key, standings, totalPlayers, loading } = feed
  const ref = useRef<HTMLDivElement>(null)
  // The feed's asks, as of the latest render: the effects below go by its key, not by these changing.
  const asks = useRef(feed)
  asks.current = feed
  const [more, setMore] = useState<Standing[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  // A phone shows the top five until asked for more; a link to the standings is asking.
  const [opened, setOpened] = useState(() => focusable && focusFromUrl() === 'standings')
  // Find a player: what's typed, and who it found (null while nothing is typed).
  const [find, setFind] = useState('')
  const [found, setFound] = useState<Standing[] | null>(null)

  // A new period or group is a new list.
  useEffect(() => {
    setMore([])
    setFind('')
    setFound(null)
  }, [standings])

  // Asked once typing stops.
  useEffect(() => {
    const q = find.trim()
    if (!q) {
      setFound(null)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      asks.current
        .find(q)
        .then((rows) => {
          if (!cancelled) setFound(rows.map((r) => ({ ...r, games: r.games ?? Object.keys(r.byGame ?? {}).length })))
        })
        .catch(() => {
          if (!cancelled) setFound([])
        })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [find, key])

  // Brought into view once they're in, and again whenever a link asks while the page is open.
  useEffect(() => {
    if (loading || !focusable) return
    const focus = () => {
      if (focusFromUrl() !== 'standings') return
      setOpened(true)
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    focus()
    window.addEventListener(ROUTE_EVENT, focus)
    return () => window.removeEventListener(ROUTE_EVENT, focus)
  }, [loading, focusable])

  const rows = [...standings, ...more]
  const left = Math.max(0, totalPlayers - rows.length)
  const showMore = async () => {
    setOpened(true)
    if (loadingMore || left === 0) return
    setLoadingMore(true)
    try {
      const page = await asks.current.more(rows.length, MORE_STANDINGS)
      const have = new Set(rows.map((row) => row.name))
      setMore((prev) => [...prev, ...page.filter((row) => !have.has(row.name))])
    } catch {
      // The button stays; another press tries again.
    } finally {
      setLoadingMore(false)
    }
  }

  const leaderScore = standings[0]?.score ?? 0
  const standing = feed.you
  const below = standing && standing.rank != null && standing.rank > rows.length ? standing : null
  const lastRows = last?.expected && last.rows ? Math.min(5, last.rows.length) : 0
  const lastTop = last?.rows?.[0]?.score ?? 0
  const hasFoot = left > 0 || (!opened && rows.length > 5)
  // While they load, the room they took last time on this device (lib/heldShape.ts): the rows, the gap and
  // you below them, Show more, and last time's top five.
  const heldRows = useHeldShape(`standings-rows-${key}`, loading ? undefined : Math.max(3, rows.length) + (below ? 2 : 0), 10)
  const heldFoot = useHeldShape(`standings-foot-${key}`, loading ? undefined : hasFoot ? 1 : 0, 1)
  const heldLast = useHeldShape(`standings-last-${key}`, loading ? undefined : lastRows, last?.expected ? 5 : 0)
  // A line follows its place only when someone's placed under it, shown yet or not.
  const lineAfter = (rank: number) => {
    if (!lines) return null
    const kind = rank === lines.cup ? 'cup' : rank === lines.trophy ? 'trophy' : null
    if (!kind || totalPlayers <= rank) return null
    return <PrizeLine key={`line-${kind}`} kind={kind} label={kind === 'cup' ? lines.cupLabel : lines.trophyLabel} deep={!opened && rank > 5} />
  }
  return (
    <div ref={ref} id={id} className="sb-card sb-standings" data-hunt={hunt}>
      <div className="sb-standings__head">
        <h2 className="sb-card__title">{title}</h2>
        <span className="sb-standings__count">
          {loading ? (
            <span className="skel-line" style={{ '--skel-w': '4.5rem' } as CSSProperties} />
          ) : (
            `${totalPlayers.toLocaleString()} ${totalPlayers === 1 ? 'player' : 'players'}`
          )}
        </span>
        {/* The points beside each name are the one figure this list keeps; what makes them is there. */}
        {how ? (
          <a className="sb-standings__how" href={how}>
            How your rank works ›
          </a>
        ) : null}
      </div>
      {sub ? <p className="sb-standings__sub">{sub}</p> : null}
      {/* Held while the list loads too, so it doesn't push the rows down when it comes. */}
      {loading || totalPlayers > 10 ? (
        <div className="gb-find sb-standings__find">
          <label className="gb-find__box" htmlFor={`sb-find-${key}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span className="visually-hidden">Find a player</span>
            <input
              id={`sb-find-${key}`}
              type="search"
              placeholder="Find a player"
              autoComplete="off"
              spellCheck={false}
              maxLength={12}
              value={find}
              disabled={loading}
              onChange={(e) => setFind(e.target.value)}
            />
          </label>
        </div>
      ) : null}
      {loading ? (
        <ol className="sb-rows" aria-busy="true">
          {Array.from({ length: heldRows }, (_, i) => (
            // Past the fifth, a phone hides them till asked, as it hides the rows themselves.
            <li key={i} className={`sb-row sb-row--skel${!opened && i >= 5 ? ' sb-row--deep' : ''}`}>
              <span className="sb-row__link">
                <span className="skel-line" style={{ '--skel-w': '2rem' } as CSSProperties} />
                <span className="sb-row__mark sb-row__mark--open" />
                <span className="skel-line" style={{ '--skel-w': '6rem' } as CSSProperties} />
                <span className="sb-row__bar" />
                <span className="skel-line" style={{ '--skel-w': '2.5rem' } as CSSProperties} />
              </span>
            </li>
          ))}
        </ol>
      ) : found ? (
        found.length ? (
          <ol className="sb-rows" aria-label={`Players matching ${find.trim()}`}>
            {found.map((row) => (
              <StandingRow key={row.name} row={row} leaderScore={leaderScore} you={you} href={feed.rowHref(row.name)} />
            ))}
          </ol>
        ) : (
          <p className="gb-board__note gb-find__none">Nobody on the {title} goes by “{find.trim().toUpperCase()}”.</p>
        )
      ) : (
        <ol className="sb-rows">
          {rows.flatMap((row) => [
            <StandingRow
              key={row.name}
              row={row}
              leaderScore={leaderScore}
              you={you}
              href={feed.rowHref(row.name)}
              deep={!opened && row.rank > 5}
            />,
            lineAfter(row.rank),
          ])}
          {Array.from({ length: Math.max(0, 3 - rows.length) }, (_, i) => (
            <OpenRow key={`open-${i}`} rank={rows.length + i + 1} />
          ))}
          {below ? (
            <>
              <li className="sb-row sb-row--gap" aria-hidden="true">
                ⋯
              </li>
              <StandingRow
                row={{
                  rank: below.rank ?? 0,
                  name: below.name,
                  score: below.score,
                  games: Object.keys(below.byGame).length,
                  avatarId: below.avatarId,
                }}
                leaderScore={leaderScore}
                you={you}
                href={feed.rowHref(below.name)}
              />
            </>
          ) : null}
        </ol>
      )}
      {loading && heldFoot ? (
        <div className="sb-standings__foot" aria-hidden="true">
          <span className="sb-ghost sb-standings__more skel-btn">Show more</span>
        </div>
      ) : null}
      {loading && heldLast ? (
        <div className="sb-last" aria-hidden="true">
          <div className="sb-last__head">
            <h3 className="sb-last__title">
              <span className="skel-line" style={{ '--skel-w': '7rem' } as CSSProperties} />
            </h3>
          </div>
          <ol className="sb-rows sb-rows--last">
            {Array.from({ length: heldLast }, (_, i) => (
              <li key={i} className="sb-row sb-row--skel">
                <span className="sb-row__link">
                  <span className="skel-line" style={{ '--skel-w': '2rem' } as CSSProperties} />
                  <span className="sb-row__mark sb-row__mark--open" />
                  <span className="skel-line" style={{ '--skel-w': '6rem' } as CSSProperties} />
                  <span className="sb-row__bar" />
                  <span className="skel-line" style={{ '--skel-w': '2.5rem' } as CSSProperties} />
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {!loading && hasFoot && !found ? (
        <div className="sb-standings__foot">
          {/* With nobody left to fetch, it is only a phone's hidden sixth to tenth still to show. */}
          <button
            type="button"
            className={`sb-ghost sb-standings__more${left > 0 ? '' : ' sb-standings__more--phone'}`}
            onClick={() => void showMore()}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading…' : 'Show more'}
          </button>
        </div>
      ) : null}
      {last?.expected && last.rows ? (
        <div className="sb-last">
          <div className="sb-last__head">
            <h3 className="sb-last__title">{last.title}</h3>
            <span className="sb-last__note">{last.note}</span>
          </div>
          <ol className="sb-rows sb-rows--last">
            {last.rows.slice(0, 5).map((row) => (
              <StandingRow key={row.name} row={row} leaderScore={lastTop} you={you} href={last.rowHref(row.name)} />
            ))}
          </ol>
        </div>
      ) : null}
      {foot ? <p className="sb-standings__note">{foot}</p> : null}
    </div>
  )
}
