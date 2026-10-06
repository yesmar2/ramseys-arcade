import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { boardPlayer, type BoardPlayer } from '../lib/gameBoard'
import { getLeaderboard, getPlayerBoard, type LeaderboardEntry, type LeaderboardPeriod, type YouEntry } from '../lib/leaderboard'
import { ordinal } from '../lib/scoreboard'
import { LeaderboardList } from './LeaderboardList'

/*
 * A board's players, however many there are (Ramsey's pick, 2026-10-05: "let's do a with beat x"). It opens
 * on the top ten and, for a viewer further down, their own place with the players either side; between the
 * two, a break that says how many players it skips and opens 25 at a time. Under the viewer's place, the
 * next band up and what gets into it ("Beat 4,890 to reach the top half"). Over it all, Find a player and
 * Jump to me. Every place is the API's (getPlayerBoard): the page holds only the rows it has asked for.
 */

/** 7,412th: a place with its thousands marked. */
const placeWords = (n: number) => `${n.toLocaleString()}${ordinal(n).slice(String(n).length)}`

/** Players each press of a break or Show more opens. */
const MORE = 25
const FIND_WAIT_MS = 250

type Segment = { from: number; rows: BoardPlayer[] }

/** The rows held, in runs of places with nothing missing between them. */
function segmentsOf(rows: Map<number, BoardPlayer>): Segment[] {
  const places = [...rows.keys()].sort((a, b) => a - b)
  const out: Segment[] = []
  for (const place of places) {
    const last = out[out.length - 1]
    const row = rows.get(place)!
    if (last && last.from + last.rows.length === place) last.rows.push(row)
    else out.push({ from: place, rows: [row] })
  }
  return out
}

export function BoardPlayers({
  slug,
  period,
  top,
  around,
  field,
  you,
  bandLine,
  cols,
  row,
  load,
  search,
}: {
  slug: string
  period: LeaderboardPeriod
  /** The board's first players. */
  top: BoardPlayer[]
  /** The viewer and the players either side of them. */
  around: BoardPlayer[]
  /** Players on the board. */
  field: number
  /** The viewer's tag, if they're on it. */
  you: string
  bandLine: string | null
  /** The column heads, under Find a player. */
  cols?: ReactNode
  /** One player's row: an `li`. */
  row: (player: BoardPlayer) => ReactNode
  /** Where more rows come from: a game board's players (getPlayerBoard), unless a page has its own (a record's). */
  load?: (offset: number, limit: number) => Promise<BoardPlayer[]>
  /** Finding a player by tag: a game board's, unless given; null where the API can't (a record's board). */
  search?: ((q: string) => Promise<BoardPlayer[]>) | null
}) {
  const loadRows =
    load ?? ((offset: number, limit: number) => getPlayerBoard(slug, period, undefined, { offset, limit }).then((b) => b.entries.map(boardPlayer)))
  const findRows =
    search === undefined
      ? (q: string) => getPlayerBoard(slug, period, undefined, { limit: 1, find: q }).then((b) => b.found.map(boardPlayer))
      : search
  // The rows it opens on are there on its first paint, not an effect later: under a daily's board are your
  // cards (GameBoard), which an empty board's first frame would shove down as the rows came.
  const [rows, setRows] = useState(() => {
    const opening = new Map<number, BoardPlayer>()
    for (const p of [...top, ...around]) opening.set(p.place, p)
    return opening
  })
  const [busy, setBusy] = useState<number | null>(null)
  const [find, setFind] = useState('')
  const [found, setFound] = useState<BoardPlayer[] | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  // A new board (period, group, viewer) starts again from what it opened on.
  useEffect(() => {
    const next = new Map<number, BoardPlayer>()
    for (const p of [...top, ...around]) next.set(p.place, p)
    setRows(next)
    setFind('')
    setFound(null)
  }, [top, around])

  // Players whose tag holds what's typed, asked once typing stops.
  useEffect(() => {
    const q = find.trim()
    if (!q || !findRows) {
      setFound(null)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      findRows(q)
        .then((rows) => {
          if (!cancelled) setFound(rows)
        })
        .catch(() => {
          if (!cancelled) setFound([])
        })
    }, FIND_WAIT_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // The finder is made fresh each render; the board it finds on is what's named here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [find, slug, period])

  const segments = useMemo(() => segmentsOf(rows), [rows])
  const mine = you ? around.find((p) => p.name === you) : undefined

  /** The next 25 players after `place`. */
  const openAfter = async (place: number) => {
    if (busy != null) return
    setBusy(place)
    try {
      const page = await loadRows(place, MORE)
      setRows((prev) => {
        const next = new Map(prev)
        for (const r of page) next.set(r.place, r)
        return next
      })
    } catch {
      // The button stays; another press tries again.
    } finally {
      setBusy(null)
    }
  }

  // Your row wears gb-row--you (the row renderer's), wherever it is in the list.
  const jump = () => listRef.current?.querySelector('.gb-row--you')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  // A viewer near the top is already in view: Jump to me only once their place is past the opening rows.
  const showJump = Boolean(mine && mine.place > top.length + 2)

  return (
    <div ref={listRef} className="gb-list">
      {field > top.length && (findRows || showJump) ? (
        <div className="gb-find">
          {findRows ? (
          <label className="gb-find__box" htmlFor={`gb-find-${slug}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span className="visually-hidden">Find a player</span>
            <input
              id={`gb-find-${slug}`}
              type="search"
              placeholder="Find a player"
              autoComplete="off"
              spellCheck={false}
              maxLength={12}
              value={find}
              onChange={(e) => setFind(e.target.value)}
            />
          </label>
          ) : null}
          {showJump ? (
            <button type="button" className="gb-find__me" onClick={jump}>
              Jump to me <span>{placeWords(mine!.place)}</span>
            </button>
          ) : null}
        </div>
      ) : null}
      {cols}
      {found ? (
        found.length ? (
          <ol className="gb-rows" aria-label={`Players matching ${find.trim()}`}>
            {found.map((p) => row(p))}
          </ol>
        ) : (
          <p className="gb-board__note gb-find__none">Nobody on this board goes by “{find.trim().toUpperCase()}”.</p>
        )
      ) : (
        segments.map((seg, k) => {
          const end = seg.from + seg.rows.length - 1
          const next = segments[k + 1]
          const hasMe = Boolean(mine && mine.place >= seg.from && mine.place <= end)
          const gap = next ? next.from - end - 1 : field - end
          return (
            <div key={seg.from} className="gb-seg">
              <ol className="gb-rows" start={seg.from}>
                {seg.rows.map((p) => row(p))}
              </ol>
              {hasMe && bandLine ? <p className="gb-band">{bandLine}</p> : null}
              {gap > 0 ? (
                <button type="button" className={`gb-board__more${next ? ' gb-board__more--gap' : ''}`} onClick={() => void openAfter(end)} disabled={busy === end}>
                  {busy === end ? (
                    'Loading…'
                  ) : next ? (
                    <>
                      <b aria-hidden="true">···</b> {gap.toLocaleString()} {gap === 1 ? 'player' : 'players'} between
                      <span> · Show {Math.min(gap, MORE)} more</span>
                    </>
                  ) : (
                    <>
                      Show {Math.min(gap, MORE).toLocaleString()} more {hasMe ? 'below' : 'players'}
                      <span> · {gap.toLocaleString()} to go</span>
                    </>
                  )}
                </button>
              ) : null}
            </div>
          )
        })
      )}
    </div>
  )
}

/** Every run on a board, best first, 25 at a time from the API, with the viewer's best marked. */
export function BoardRuns({
  slug,
  period,
  you,
  accent,
  formatScore,
}: {
  slug: string
  period: LeaderboardPeriod
  you: string
  accent: string
  formatScore: (score: number) => string
}) {
  const [runs, setRuns] = useState<LeaderboardEntry[]>([])
  const [youRun, setYouRun] = useState<YouEntry | null>(null)
  const [total, setTotal] = useState(0)
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    let cancelled = false
    setBusy(true)
    getLeaderboard(slug, period, you || undefined, { limit: MORE })
      .then((b) => {
        if (cancelled) return
        setRuns(b.entries)
        setYouRun(b.you)
        setTotal(b.total)
      })
      .catch(() => {
        if (!cancelled) setRuns([])
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug, period, you])

  const more = async () => {
    if (busy) return
    setBusy(true)
    try {
      const b = await getLeaderboard(slug, period, undefined, { offset: runs.length, limit: MORE })
      setRuns((prev) => [...prev, ...b.entries])
    } catch {
      /* another press tries again */
    } finally {
      setBusy(false)
    }
  }

  const left = total - runs.length
  return (
    <>
      <LeaderboardList entries={runs} you={youRun} playerName={you} accent={accent} shown={runs.length} period={period} formatScore={formatScore} />
      {left > 0 ? (
        <button type="button" className="gb-board__more" onClick={() => void more()} disabled={busy}>
          {busy ? 'Loading…' : `Show ${Math.min(left, MORE).toLocaleString()} more runs`}
          {busy ? null : <span> · {left.toLocaleString()} to go</span>}
        </button>
      ) : null}
    </>
  )
}
