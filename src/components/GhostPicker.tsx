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
  const { isPlus, signedIn, signedOut } = useAuth()
  // Plus's lock only once the account is known: a member's is never mistaken for none while it's asked for.
  const noPlus = !isPlus && (signedIn || signedOut)
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<TrackBoardRow[] | null>(null)
  const [friends, setFriends] = useState<Set<string>>(new Set())
  const boxRef = useRef<HTMLDivElement>(null)
  const nowRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  // Whether the open menu has been scrolled to the one you race yet.
  const shownPick = useRef(false)
  const id = useId()

  /*
   * The menu opens upward from the pill, inside the start card, so however long the board it's no taller than
   * the room it has there: the card above the pill, no more than the card shows at once. It scrolls itself
   * under its head (the title, As usual and the #1), it's brought into sight (the card may scroll), and the one
   * you race is shown just under the head.
   */
  const place = () => {
    const menu = menuRef.current
    const now = nowRef.current
    if (!menu || !now) return
    const card = now.closest<HTMLElement>('.game-card')
    if (card) {
      const above = now.getBoundingClientRect().top - card.getBoundingClientRect().top - card.clientTop + card.scrollTop
      menu.style.maxHeight = `${Math.max(120, Math.min(above, card.clientHeight) - 16)}px`
    }
    menu.scrollIntoView({ block: 'nearest' })
    const on = menu.querySelector<HTMLElement>('.gp-opt--on')
    const head = menu.querySelector<HTMLElement>('.gp-menu__head')
    if (on && !shownPick.current) {
      if (head && !head.contains(on)) menu.scrollTop = on.offsetTop - head.offsetHeight - 6
      shownPick.current = true
    }
  }

  useEffect(() => {
    if (open) place()
    else shownPick.current = false
  }, [open, rows, friends])

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
    const inside = (t: EventTarget | null) => t instanceof Node && Boolean(boxRef.current?.contains(t))
    // While it's open, a press anywhere else is only to close it, on the card or on the playfield beside it (where
    // it would start the run): nothing else hears it, and its click closes the menu. A finger that scrolls the
    // card makes no click, so the menu stays open for it.
    const press = (e: PointerEvent) => {
      if (!inside(e.target)) e.stopPropagation()
    }
    const away = (e: MouseEvent) => {
      if (inside(e.target)) return
      e.stopPropagation()
      e.preventDefault()
      setOpen(false)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', press, true)
    window.addEventListener('click', away, true)
    window.addEventListener('resize', place)
    document.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', press, true)
      window.removeEventListener('click', away, true)
      window.removeEventListener('resize', place)
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
    const locked = !free && noPlus
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
      <button ref={nowRef} type="button" className="gp-now" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        <span className="gp-now__label">Racing</span>
        <b className="gp-now__who">{racing}</b>
        <span className="gp-now__change">Change</span>
      </button>
      {note ? <span className="gp-note">{note}</span> : null}
      {open ? (
        <div ref={menuRef} id={id} className="gp-menu" role="dialog" aria-label="Who do you race?">
          <div className="gp-menu__head">
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
          </div>
          {friendRows.length ? (
            <>
              <span className="gp-menu__group">Your friends</span>
              <ul className="gp-menu__list">{friendRows.map((r) => row(r, false))}</ul>
            </>
          ) : null}
          {others.length ? (
            <>
              <span className="gp-menu__group">Anyone on the board</span>
              <ul className="gp-menu__list">{others.map((r) => row(r, false))}</ul>
            </>
          ) : null}
          {noPlus ? <span className="gp-menu__free">Anyone but the #1 is with Plus. Ghosts are only for racing.</span> : null}
        </div>
      ) : null}
    </div>
  )
}
