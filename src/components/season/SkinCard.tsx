import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { getGame } from '../../data/games'
import { seasonHref } from '../../hooks/useHashRoute'
import { liveSeason, useSeason } from '../../lib/season'
import { SEASON_CALENDAR } from '../../lib/seasonCalendar'
import { chooseSkin, useChosenSkin, type Skin } from '../../lib/skins'
import { hangarSkinHref, seasonDay, seasonSkinHref, skinWhere } from '../../lib/skinWhere'
import { useTickets } from '../../lib/tickets'
import { TicketGlyph } from '../prizes/Ticket'
import { RewardArt } from './RewardArt'
import '../../styles/infoTip.css'
import '../../styles/skinCard.css'

/*
 * A skin on a board, as a button: pointed at, clicked or tapped, a small card under it says what the skin is and
 * where it comes from (this season's pass at its level, Pass+, the Hangar at its price, a season gone by), and
 * leads there, to its tile on the Season page or its bay in the Hangar; one you have, it puts on. Ramsey picked
 * this (A, "A works for me", 2026-10-08) over the skin as a plain link and a strip of a board's skins.
 *
 * It floats the way an InfoTip does (components/InfoTip.tsx), in its look, and only one of either is up at a
 * time; but what's in it is pressed, so it's a small dialog the keyboard goes into, and Tab carries on past it as
 * if it sat right after its skin.
 */

/** Kept clear of the screen's edges, and between the skin and its card, in pixels. */
const EDGE = 12
const GAP = 10
/** How far left of its skin a card starts, so its arrow sits in from its corner. */
const LEAD = 12
/** A pointer passing over a board doesn't open every card on its way: it has to stop on the skin a moment. */
const OPEN_MS = 120
/** How long a card waits for the pointer to cross from its skin onto it. */
const LINGER_MS = 150
/** One coming up says so, and any other goes away: InfoTip's tips too. */
const UP_EVENT = 'infotip:up'

const TABBABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** What Tab reaches after `from` in the page, the card's own things aside. */
function nextTabbable(from: HTMLElement, card: HTMLElement | null): HTMLElement | null {
  const all = [...document.querySelectorAll<HTMLElement>(TABBABLE)].filter((el) => !card?.contains(el) && el.getClientRects().length > 0)
  const at = all.indexOf(from)
  return at >= 0 ? (all[at + 1] ?? null) : null
}

export function SkinCardButton({ skin, children }: { skin: Skin; children: ReactNode }) {
  const id = useId()
  const cardId = `${id}card`
  const nameId = `${id}name`
  const buttonRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const timer = useRef(0)
  // Opened from the keyboard: the focus goes into the card once it's drawn.
  const focusIn = useRef(false)
  const [pinned, setPinned] = useState(false)
  const [hovered, setHovered] = useState(false)
  const up = pinned || hovered

  const close = (refocus = false) => {
    window.clearTimeout(timer.current)
    setPinned(false)
    setHovered(false)
    if (refocus) buttonRef.current?.focus()
  }

  useEffect(() => () => window.clearTimeout(timer.current), [])

  // Only one up at a time.
  useEffect(() => {
    if (!up) return
    window.dispatchEvent(new CustomEvent(UP_EVENT, { detail: id }))
    const onUp = (e: Event) => {
      if ((e as CustomEvent<string>).detail === id) return
      window.clearTimeout(timer.current)
      setPinned(false)
      setHovered(false)
    }
    window.addEventListener(UP_EVENT, onUp)
    return () => window.removeEventListener(UP_EVENT, onUp)
  }, [up, id])

  // A press anywhere but the skin or its card puts it away; so does Esc, giving the skin back the focus.
  useEffect(() => {
    if (!up) return
    const onPress = (e: globalThis.PointerEvent) => {
      const target = e.target as Node | null
      if (target && (buttonRef.current?.contains(target) || cardRef.current?.contains(target))) return
      window.clearTimeout(timer.current)
      setPinned(false)
      setHovered(false)
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const focus = document.activeElement
      const inside = focus === buttonRef.current || Boolean(focus && cardRef.current?.contains(focus))
      window.clearTimeout(timer.current)
      setPinned(false)
      setHovered(false)
      if (inside) buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPress, true)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPress, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [up])

  // Under its skin, or over it when there's no room below; never past the screen's edges (InfoTip's placing). It's
  // placed again as its words come in, and goes away with its skin scrolled off the screen; but not before the skin
  // has been on it, as it may still be gliding in (the keyboard's focus scrolls it there smoothly).
  useLayoutEffect(() => {
    if (!up) return
    let seen = false
    const place = () => {
      const button = buttonRef.current
      const card = cardRef.current
      if (!button || !card) return
      const at = button.getBoundingClientRect()
      const width = document.documentElement.clientWidth
      const height = window.innerHeight
      const off = at.bottom < 0 || at.top > height
      if (off && seen) {
        setPinned(false)
        setHovered(false)
        return
      }
      seen ||= !off
      const w = card.offsetWidth
      const h = card.offsetHeight
      const below = at.bottom + GAP + h <= height - EDGE || at.top - GAP - h < EDGE
      const left = Math.max(EDGE, Math.min(at.left - LEAD, width - EDGE - w))
      const top = below ? at.bottom + GAP : at.top - GAP - h
      card.style.left = `${Math.round(left)}px`
      card.style.top = `${Math.round(Math.max(EDGE, top))}px`
      card.style.setProperty('--infotip-arrow', `${Math.round(Math.max(16, Math.min(w - 16, at.left + at.width / 2 - left)))}px`)
      card.dataset.side = below ? 'below' : 'above'
    }
    place()
    if (focusIn.current) {
      focusIn.current = false
      cardRef.current?.querySelector<HTMLElement>(TABBABLE)?.focus({ preventScroll: true })
    }
    const sized = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place)
    if (cardRef.current) sized?.observe(cardRef.current)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      sized?.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [up])

  // A mouse (or a pen) resting on the skin, or on its card; a touch is a tap, which pins it up or puts it away.
  const enter = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return
    window.clearTimeout(timer.current)
    if (!hovered) timer.current = window.setTimeout(() => setHovered(true), OPEN_MS)
  }
  const stay = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') window.clearTimeout(timer.current)
  }
  const leave = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setHovered(false), LINGER_MS)
  }

  // Tab goes on from the card as it would from its skin; Shift+Tab goes back to the skin.
  const onCardKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const items = [...(cardRef.current?.querySelectorAll<HTMLElement>(TABBABLE) ?? [])]
    const focus = document.activeElement
    if (e.shiftKey ? focus === items[0] : focus === items[items.length - 1]) {
      e.preventDefault()
      const next = e.shiftKey || !buttonRef.current ? null : nextTabbable(buttonRef.current, cardRef.current)
      close(!next)
      next?.focus()
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="skin-mark skin-mark--button"
        aria-label={`Played in the ${skin.name}`}
        aria-haspopup="dialog"
        aria-expanded={up}
        aria-controls={up ? cardId : undefined}
        data-open={up ? '' : undefined}
        onPointerEnter={enter}
        onPointerLeave={leave}
        onClick={(e) => {
          // Not the row's: the name beside it is the link to the player.
          e.preventDefault()
          e.stopPropagation()
          window.clearTimeout(timer.current)
          if (pinned) {
            close()
            return
          }
          // Enter or Space on the skin (a click with no pointer's press): the keyboard goes into the card.
          focusIn.current = e.detail === 0
          setPinned(true)
        }}
      >
        {children}
      </button>
      {up && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={cardRef}
              id={cardId}
              className="infotip-tip skin-card"
              role="dialog"
              aria-labelledby={nameId}
              onPointerEnter={stay}
              onPointerLeave={leave}
              onKeyDown={onCardKey}
            >
              <SkinCardBody skin={skin} nameId={nameId} />
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

function Tick() {
  return (
    <svg className="skin-card__tick" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <path d="M7 12.5l3.2 3.2L17 9" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PlusChip() {
  return <span className="skin-card__plus">Pass+</span>
}

/** What's in the card: the skin, where it's from, and the one thing to do about it. */
function SkinCardBody({ skin, nameId }: { skin: Skin; nameId: string }) {
  const store = useSeason()
  const { owned } = useTickets()
  const chosen = useChosenSkin(skin.game)
  const where = skinWhere(skin, store)
  const mine = owned.includes(skin.id)
  const seasonName = SEASON_CALENDAR.find((s) => s.id === skin.season)?.name ?? 'a season'
  const bay = { '--skin-card-bay': getGame(skin.game)?.accent ?? '#ff8552' } as CSSProperties

  let from: ReactNode
  let note: string | null = null
  let act: ReactNode = null
  if (mine) {
    const source = skin.price != null ? 'the Hangar' : skin.plus ? `${seasonName} Pass+` : `the ${seasonName} pass`
    from = (
      <>
        <Tick />
        <span>Yours · from {source}</span>
      </>
    )
    act =
      chosen === skin.id ? (
        <span className="skin-card__go skin-card__go--on">You’re wearing it</span>
      ) : (
        <button type="button" className="skin-card__go skin-card__go--wear" onClick={() => chooseSkin(skin.game, skin.id)}>
          Wear it
        </button>
      )
  } else if (where.kind === 'pass') {
    from = where.plus ? (
      <>
        <PlusChip />
        <span>
          {where.season.name} · level {where.level}
        </span>
      </>
    ) : (
      <span>
        {where.season.name} pass · level {where.level}
      </span>
    )
    act = (
      <a className="skin-card__go" href={seasonSkinHref(skin.id)}>
        See it on the Season page
        <Chevron />
      </a>
    )
  } else if (where.kind === 'hangar') {
    from = (
      <>
        <TicketGlyph size={18} />
        <span>{where.price.toLocaleString()} tickets · in the Hangar</span>
      </>
    )
    act = (
      <a className="skin-card__go" href={hangarSkinHref(skin.id)}>
        See it in the Hangar
        <Chevron />
      </a>
    )
  } else {
    // A season that isn't on now: it can only be named, until the season's own answer says otherwise.
    from = skin.plus ? (
      <>
        <PlusChip />
        <span>{seasonName}</span>
      </>
    ) : (
      <span>The {seasonName} pass</span>
    )
    if (store.loaded && where.season && where.when === 'over') {
      note = `${where.season.name} ended ${seasonDay(where.season.lastDay)}.`
      if (liveSeason(store)) {
        act = (
          <a className="skin-card__go" href={seasonHref()}>
            See this season’s skins
            <Chevron />
          </a>
        )
      }
    } else if (store.loaded && where.season && where.when === 'soon') {
      note = `${where.season.name} starts ${seasonDay(where.season.firstDay)}.`
    }
  }

  return (
    <>
      <div className="skin-card__head">
        <span className={`skin-card__art${skin.price != null ? ' skin-card__art--hangar' : ''}`} style={bay} aria-hidden="true">
          <RewardArt reward={{ kind: 'skin', id: skin.id, name: skin.name }} size={54} />
        </span>
        <span className="skin-card__words">
          <b className="skin-card__name" id={nameId}>
            {skin.name}
          </b>
          <span className="skin-card__what">{skin.what}</span>
        </span>
      </div>
      <p className="skin-card__from">{from}</p>
      {note ? <p className="skin-card__note">{note}</p> : null}
      {act}
    </>
  )
}
