import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { games, TAG_LABELS, type Game } from '../data/games'
import { gameHref, navigate, rankHref, tournamentHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import {
  checkNameAvailable,
  fetchGlobalBoard,
  normalizePlayerName,
  type GlobalBoardEntry,
} from '../lib/leaderboard'
import { listTournaments, type TournamentSummary } from '../lib/tournaments'
import { GameThumbArt } from './GameThumbArt'

/*
 * Search, from the header: games by name, events by title, and players by
 * tag. Games are on the page already. Events and the players on the global
 * board are fetched once when the field is first used and kept for a
 * minute, and a part of a tag is enough to find a player on the board. A
 * whole tag that is not on the board is looked up on the API, with a pause
 * after typing, and offered when someone has it; your own tag counts, since
 * the API calls a tag you hold "available" to you. "/" anywhere on the page
 * puts the cursor in the field, the arrows walk the results, Enter opens
 * one, Escape clears. On a phone the field hides behind a button and drops
 * over the header when opened.
 */

type Hit =
  | { kind: 'game'; key: string; href: string; label: string; hint: string; game: Game }
  | { kind: 'event'; key: string; href: string; label: string; hint: string }
  | { kind: 'player'; key: string; href: string; label: string; hint: string }

const CACHE_TTL = 60_000
let eventsCache: { at: number; promise: Promise<TournamentSummary[]> } | null = null
let playersCache: { at: number; promise: Promise<GlobalBoardEntry[]> } | null = null

function loadEvents(): Promise<TournamentSummary[]> {
  const now = Date.now()
  if (eventsCache && now - eventsCache.at < CACHE_TTL) return eventsCache.promise
  const promise = listTournaments('all').catch(() => [] as TournamentSummary[])
  eventsCache = { at: now, promise }
  return promise
}

/** Everyone on the all-time board, which for now is everyone who has ever scored. */
function loadPlayers(): Promise<GlobalBoardEntry[]> {
  const now = Date.now()
  if (playersCache && now - playersCache.at < CACHE_TTL) return playersCache.promise
  const promise = fetchGlobalBoard(500, 'all')
    .then((board) => board.entries)
    .catch(() => [] as GlobalBoardEntry[])
  playersCache = { at: now, promise }
  return promise
}

function MagnifierIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M15.2 15.2 L20 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

export function SiteSearch() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(0)
  const [events, setEvents] = useState<TournamentSummary[] | null>(null)
  const [players, setPlayers] = useState<GlobalBoardEntry[] | null>(null)
  const [player, setPlayer] = useState<string | null>(null)
  const ownTag = normalizePlayerName(usePlayerName())
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const query = q.trim().toLowerCase()

  // Events and the board come in once the field is in use, so the page never pays for them otherwise.
  useEffect(() => {
    if (!focused || (events && players)) return
    let cancelled = false
    if (!events) {
      void loadEvents().then((list) => {
        if (!cancelled) setEvents(list)
      })
    }
    if (!players) {
      void loadPlayers().then((list) => {
        if (!cancelled) setPlayers(list)
      })
    }
    return () => {
      cancelled = true
    }
  }, [focused, events, players])

  /*
   * A whole tag is looked up so a player who has never scored can still be
   * found, and only offered when someone has it, so a typo never leads to an
   * empty profile. The API answers from the asker's side and calls a tag you
   * hold "available" to you, so your own tag is taken as found.
   */
  useEffect(() => {
    const cleaned = normalizePlayerName(q)
    if (cleaned.length < 2) {
      setPlayer(null)
      return
    }
    if (cleaned === ownTag) {
      setPlayer(cleaned)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      void checkNameAvailable(cleaned)
        .then((available) => {
          if (!cancelled) setPlayer(available ? null : cleaned)
        })
        .catch(() => {
          if (!cancelled) setPlayer(null)
        })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [q, ownTag])

  const hits = useMemo<Hit[]>(() => {
    if (!query) return []
    const out: Hit[] = []
    for (const g of games) {
      if (g.hidden) continue
      if (!g.name.toLowerCase().includes(query) && !g.slug.includes(query)) continue
      const tag = g.tags?.[0]
      out.push({
        kind: 'game',
        key: `game:${g.slug}`,
        href: gameHref(g.slug),
        label: g.name,
        hint: tag ? TAG_LABELS[tag] : 'Game',
        game: g,
      })
      if (out.length >= 5) break
    }
    if (events) {
      let n = 0
      for (const t of events) {
        if (!t.title.toLowerCase().includes(query)) continue
        out.push({
          kind: 'event',
          key: `event:${t.id}`,
          href: tournamentHref(t.id),
          label: t.title,
          hint: t.formatLabel,
        })
        if (++n >= 4) break
      }
    }
    // Players: a part of a tag finds anyone on the board, those starting with it first.
    const seen = new Set<string>()
    const upper = query.toUpperCase()
    if (players) {
      const matches = players
        .filter((p) => p.name.includes(upper))
        .sort((a, b) => {
          const aStarts = a.name.startsWith(upper) ? 0 : 1
          const bStarts = b.name.startsWith(upper) ? 0 : 1
          return aStarts - bStarts || a.rank - b.rank
        })
        .slice(0, 5)
      for (const p of matches) {
        seen.add(p.name)
        out.push({
          kind: 'player',
          key: `player:${p.name}`,
          href: rankHref(p.name),
          label: p.name,
          hint: `Player · #${p.rank}`,
        })
      }
    }
    if (player && !seen.has(player)) {
      out.push({
        kind: 'player',
        key: `player:${player}`,
        href: rankHref(player),
        label: player,
        hint: 'Player',
      })
    }
    return out
  }, [query, events, players, player])

  useEffect(() => {
    setActive(0)
  }, [query, hits.length])

  const showResults = focused && query.length > 0

  // "/" anywhere on the page is the way in, as long as nothing else is taking keys.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
      e.preventDefault()
      setOpen(true)
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // A press anywhere else closes it.
  useEffect(() => {
    if (!focused && !open) return
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return
      setFocused(false)
      setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    return () => window.removeEventListener('pointerdown', onPointer)
  }, [focused, open])

  const go = (hit: Hit | undefined) => {
    if (!hit) return
    setQ('')
    setFocused(false)
    setOpen(false)
    inputRef.current?.blur()
    navigate(hit.href)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && hits.length) {
      e.preventDefault()
      setActive((i) => (i + 1) % hits.length)
    } else if (e.key === 'ArrowUp' && hits.length) {
      e.preventDefault()
      setActive((i) => (i - 1 + hits.length) % hits.length)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (q) setQ('')
      else {
        setFocused(false)
        setOpen(false)
        inputRef.current?.blur()
      }
    }
  }

  const activeId = hits[active] ? `${listId}-${hits[active].key}` : undefined

  return (
    <div ref={rootRef} className={`site-search${open ? ' site-search--open' : ''}`}>
      <button
        type="button"
        className="site-search__toggle"
        aria-label="Search"
        aria-expanded={open}
        onClick={() => {
          setOpen((was) => {
            const next = !was
            if (next) window.setTimeout(() => inputRef.current?.focus(), 0)
            return next
          })
        }}
      >
        <MagnifierIcon />
      </button>
      <form
        className="site-search__form"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          go(hits[active] ?? hits[0])
        }}
      >
        <span className="site-search__icon" aria-hidden="true">
          <MagnifierIcon />
        </span>
        <input
          ref={inputRef}
          className="site-search__input"
          type="search"
          value={q}
          placeholder="Search games, players, events"
          aria-label="Search games, players and events"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showResults}
          aria-controls={listId}
          aria-activedescendant={showResults ? activeId : undefined}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={onKeyDown}
        />
        <kbd className="site-search__kbd" aria-hidden="true">
          /
        </kbd>
      </form>
      {showResults ? (
        <ul id={listId} className="site-search__results" role="listbox" aria-label="Results">
          {hits.length === 0 ? (
            <li className="site-search__empty" role="presentation">
              Nothing called “{q.trim()}”.
            </li>
          ) : (
            hits.map((hit, i) => (
              <li
                key={hit.key}
                id={`${listId}-${hit.key}`}
                role="option"
                aria-selected={i === active}
              >
                <a
                  className={`site-search__row${i === active ? ' site-search__row--active' : ''}`}
                  href={hit.href}
                  onMouseEnter={() => setActive(i)}
                  onClick={(e) => {
                    e.preventDefault()
                    go(hit)
                  }}
                >
                  {hit.kind === 'game' ? (
                    <GameThumbArt slug={hit.game.slug} accent={hit.game.accent} />
                  ) : (
                    <span className="site-search__mark" aria-hidden="true">
                      {hit.kind === 'player' ? hit.label.charAt(0) : '◆'}
                    </span>
                  )}
                  <span className="site-search__label">{hit.label}</span>
                  <span className="site-search__hint">{hit.hint}</span>
                </a>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
