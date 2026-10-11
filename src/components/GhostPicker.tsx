import { useEffect, useId, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { plusHref } from '../hooks/useHashRoute'
import { listFriends } from '../lib/friends'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { normalizePlayerName } from '../lib/leaderboard'
import { pickRace } from '../lib/raceGhost'
import { fetchTrackBoard, type TrackBoardRow, type TrackGame } from '../lib/trackBoards'
import '../styles/raceGhost.css'

/*
 * "Who do you race?" on a racing daily's start card (race any ghost, lib/raceGhost.ts): who the ghost is now,
 * and a menu to change it: as usual (the next place up, the #1, your best or the blue), the #1, your friends on
 * the board, or anyone on it. The #1 is anyone's; everyone else's ghost is Plus's, marked so, and picking one
 * without Plus leads to it. Only for racing: nobody's time or place moves.
 */
export function GhostPicker({
  game,
  course,
  racing,
  picked,
  note,
}: {
  game: TrackGame
  course: number
  /** Who the ghost is now, as the card says it: "Beat BOLT for 6th", "Ghost · DAD". */
  racing: string
  /** The tag picked, if one is. */
  picked: string | null
  /** Why the pick isn't the ghost: it's Plus's, or they've no run here. */
  note?: string | null
}) {
  const { isPlus, signedIn } = useAuth()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<TrackBoardRow[] | null>(null)
  const [friends, setFriends] = useState<Set<string>>(new Set())
  const boxRef = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open || rows) return
    let live = true
    fetchTrackBoard(game, course, '', { limit: 50 })
      .then((b) => {
        if (live) setRows(b.entries)
      })
      .catch(() => {
        if (live) setRows([])
      })
    if (signedIn) {
      listFriends()
        .then((f) => {
          if (live) setFriends(new Set(f.friends.map((x) => normalizePlayerName(x.name))))
        })
        .catch(() => {})
    }
    return () => {
      live = false
    }
  }, [open, rows, game, course, signedIn])

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  const choose = (tag: string | null) => {
    pickRace(game, course, tag)
    setOpen(false)
  }
  const top = rows?.[0] ?? null
  const rest = (rows ?? []).slice(1)
  const friendRows = rest.filter((r) => friends.has(normalizePlayerName(r.name)))
  const others = rest.filter((r) => !friends.has(normalizePlayerName(r.name)))
  const row = (r: TrackBoardRow, free: boolean) => {
    const locked = !free && !isPlus
    const on = picked === r.name
    return (
      <li key={r.name}>
        {locked ? (
          <a className="gp-opt gp-opt--plus" href={plusHref()}>
            <span className="gp-opt__who">
              <b>{r.place ? `${r.place}. ` : ''}</b>
              {r.name}
            </span>
            <span className="gp-opt__time">{formatLeaderboardScore(game, r.score)}</span>
            <span className="gp-opt__plus">Plus</span>
          </a>
        ) : (
          <button type="button" className={`gp-opt${on ? ' gp-opt--on' : ''}`} aria-pressed={on} onClick={() => choose(r.name)}>
            <span className="gp-opt__who">
              <b>{r.place ? `${r.place}. ` : ''}</b>
              {r.name}
            </span>
            <span className="gp-opt__time">{formatLeaderboardScore(game, r.score)}</span>
          </button>
        )}
      </li>
    )
  }

  return (
    // A tap here isn't the start card's tap to start the run, nor a key press its Space or Enter.
    <div className="gp" ref={boxRef} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <button type="button" className="gp-now" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        <span className="gp-now__label">Racing</span>
        <b className="gp-now__who">{racing}</b>
        <span className="gp-now__change">Change</span>
      </button>
      {note ? <span className="gp-note">{note}</span> : null}
      {open ? (
        <div id={id} className="gp-menu" role="dialog" aria-label="Who do you race?">
          <b className="gp-menu__title">Who do you race?</b>
          <ul className="gp-menu__list">
            <li>
              <button type="button" className={`gp-opt${picked == null ? ' gp-opt--on' : ''}`} aria-pressed={picked == null} onClick={() => choose(null)}>
                <span className="gp-opt__who">As usual</span>
                <span className="gp-opt__time">next place up, or the #1</span>
              </button>
            </li>
            {rows == null ? <li className="gp-menu__wait">Loading the board…</li> : null}
            {top ? row(top, true) : null}
          </ul>
          {friendRows.length ? (
            <>
              <span className="gp-menu__group">Your friends</span>
              <ul className="gp-menu__list">{friendRows.map((r) => row(r, false))}</ul>
            </>
          ) : null}
          {others.length ? (
            <>
              <span className="gp-menu__group">Anyone on the board</span>
              <ul className="gp-menu__list gp-menu__list--scroll">{others.map((r) => row(r, false))}</ul>
            </>
          ) : null}
          {!isPlus ? <span className="gp-menu__free">Anyone but the #1 is with Plus. Ghosts are only for racing.</span> : null}
        </div>
      ) : null}
    </div>
  )
}
