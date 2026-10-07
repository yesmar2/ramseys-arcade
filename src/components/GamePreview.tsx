import { useEffect, useRef, useState } from 'react'
import { DAY_PREVIEWS, GAME_PREVIEWS, type GamePreviewRun } from '../lib/gamePreviews'
import { THEME_EVENT } from '../lib/theme'

/** Frames a second for a preview: plenty for a tile, and half the work of a full game. */
const FPS = 30

/** The most a preview's opening may take in one turn before it gives the page back. */
const WARM_SLICE_MS = 8

/*
 * On a screen with no hover, the preview nearest the middle of the screen is
 * the one that plays, like a video in a feed. Every preview inside the middle
 * band of the screen registers here, and only the one whose centre is closest
 * to the screen's centre is told to play.
 */
type Centred = { el: HTMLElement; play(on: boolean): void }
const inBand = new Set<Centred>()

function pickCentred() {
  const mid = window.innerHeight / 2
  let best: Centred | null = null
  let bestGap = Infinity
  for (const c of inBand) {
    const r = c.el.getBoundingClientRect()
    const gap = Math.abs((r.top + r.bottom) / 2 - mid)
    if (gap < bestGap) {
      bestGap = gap
      best = c
    }
  }
  for (const c of inBand) c.play(c === best)
}

/*
 * In a row that scrolls sideways on a touch screen (the home page's Dailies), the tile the row has come to
 * rest on plays, as you'd swipe through an app store's previews: the tile most in view, and of tiles wholly
 * in view the one nearest the row's middle, so the last tile has its turn too. Nothing in the row plays while
 * it moves, nor while the row is mostly off the screen. A tile that loses its turn to another lets go of
 * what it holds (its 3D scene), so a row keeps one at a time.
 */
type RailTile = { el: HTMLElement; play(on: boolean): void; release(): void }
type Rail = { tiles: Set<RailTile>; timer: number; shown: boolean; onScroll: () => void; seen: IntersectionObserver }
const rails = new Map<HTMLElement, Rail>()

/** How long a row has to be still before its tile plays, in ms. */
const SETTLE_MS = 220

function pickRail(row: HTMLElement) {
  const rail = rails.get(row)
  if (!rail) return
  let best: RailTile | null = null
  if (rail.shown) {
    const box = row.getBoundingClientRect()
    const mid = (box.left + box.right) / 2
    let most = 0
    let gap = Infinity
    for (const t of rail.tiles) {
      const r = t.el.getBoundingClientRect()
      const seen = Math.max(0, Math.min(r.right, box.right) - Math.max(r.left, box.left)) / (r.width || 1)
      const off = Math.abs((r.left + r.right) / 2 - mid)
      if (seen > most + 0.01 || (seen >= most - 0.01 && off < gap)) {
        best = t
        most = Math.max(most, seen)
        gap = off
      }
    }
    if (most < 0.5) best = null
  }
  for (const t of rail.tiles) {
    t.play(t === best)
    if (best && t !== best) t.release()
  }
}

function joinRail(row: HTMLElement, tile: RailTile) {
  let rail = rails.get(row)
  if (!rail) {
    const made: Rail = {
      tiles: new Set(),
      timer: 0,
      shown: false,
      // Moving: everything in the row waits until it comes to rest.
      onScroll: () => {
        for (const t of made.tiles) t.play(false)
        window.clearTimeout(made.timer)
        made.timer = window.setTimeout(() => pickRail(row), SETTLE_MS)
      },
      seen: new IntersectionObserver(
        (entries) => {
          made.shown = entries.some((e) => e.intersectionRatio >= 0.6)
          pickRail(row)
        },
        { threshold: [0, 0.6, 1] },
      ),
    }
    row.addEventListener('scroll', made.onScroll, { passive: true })
    made.seen.observe(row)
    rails.set(row, made)
    rail = made
  }
  rail.tiles.add(tile)
  window.clearTimeout(rail.timer)
  rail.timer = window.setTimeout(() => pickRail(row), SETTLE_MS)
}

function leaveRail(row: HTMLElement, tile: RailTile) {
  const rail = rails.get(row)
  if (!rail) return
  rail.tiles.delete(tile)
  if (rail.tiles.size) {
    pickRail(row)
    return
  }
  window.clearTimeout(rail.timer)
  row.removeEventListener('scroll', rail.onScroll)
  rail.seen.disconnect()
  rails.delete(row)
}

/** The nearest box round `el` that scrolls sideways, if any does. */
function sidewaysRow(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const x = getComputedStyle(p).overflowX
    if ((x === 'auto' || x === 'scroll') && p.scrollWidth > p.clientWidth + 1) return p
  }
  return null
}

/*
 * A wall of previews comes into view together, and each one's first frame
 * means loading its game and playing a few seconds of it. They take turns in
 * the browser's idle time, one at a time, so scrolling onto the wall never
 * stalls for all of them at once.
 */
const turns: Array<() => void> = []
let turning = false

function inTurn(job: () => void) {
  turns.push(job)
  nextTurn()
}

function nextTurn() {
  if (turning) return
  const job = turns.shift()
  if (!job) return
  turning = true
  const run = () => {
    try {
      job()
    } finally {
      turning = false
      nextTurn()
    }
  }
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 1000 })
  else window.setTimeout(run, 30)
}

/**
 * A game playing itself, drawn by the game's own engine and renderer, so it
 * never drifts from the real thing. Its code loads once the tile comes near
 * the screen, and it paints a still frame of the game over the tile's thumb.
 * A tile's preview plays only when asked: while a mouse is over the tile or
 * it has keyboard focus, or, on a touch screen, while it is the tile nearest
 * the middle of the screen. Letting go freezes it where it is. The banner's
 * (`autoplay`) plays on its own, the way the one cabinet by an arcade's door
 * runs its demo. A cabinet's (`hoverOnly`) is for a pointer that can hover:
 * it plays under one or with keyboard focus, and a touch screen never loads
 * it, so the cabinet keeps its picture. A tile in a row that scrolls sideways
 * (`rail`) plays as a cabinet does under a pointer; on a touch screen, when
 * it's the tile the row has come to rest on (above), and only then does it
 * load. None plays off screen, in a hidden tab, or with reduced motion. Given
 * a `day`, a daily plays that day (DAY_PREVIEWS) rather than the game's own
 * preview; one with no day of its own to play (Find the Bug, Half Full) plays
 * its own preview, as it would without one.
 */
export function GamePreview({
  slug,
  day,
  className,
  autoplay = false,
  hoverOnly = false,
  rail = false,
}: {
  slug: string
  /** A daily's day to play, for a daily in DAY_PREVIEWS. */
  day?: string
  className?: string
  /** Play whenever it is on screen, rather than only when asked. */
  autoplay?: boolean
  /** Play only under a pointer or with focus, and not at all on a touch screen. */
  hoverOnly?: boolean
  /** In a row that scrolls sideways: under a pointer, or on a touch screen when the row rests on it. */
  rail?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const canvas = ref.current
    const daily = day ? DAY_PREVIEWS[slug] : undefined
    const load = daily && day ? () => daily().then((m) => ({ createPreview: () => m.createDayPreview(day) })) : GAME_PREVIEWS[slug]
    const ctx = canvas?.getContext('2d')
    if (!canvas || !load || !ctx) return
    // The tile's link is what a pointer rests on and what takes focus.
    const host = canvas.closest<HTMLElement>('a, button') ?? canvas

    let cancelled = false
    // The run once it's made, still warming or not, so it can be let go of with the tile.
    let made: GamePreviewRun | null = null
    let preview: GamePreviewRun | null = null
    let loading = false
    let near = false
    let hovered = false
    let focused = false
    let centred = false
    let raf = 0
    let last = 0
    let owed = 0
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    const hoverable = window.matchMedia('(hover: hover) and (pointer: fine)')
    if (hoverOnly && !hoverable.matches) return
    // On a touch screen a rail's tile plays when its row rests on it; a row that doesn't scroll has no turns to give.
    const touchRail = rail && !hoverable.matches
    const row = touchRail ? sidewaysRow(host) : null
    if (touchRail && !row) return

    const draw = (dt: number) => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (preview && w > 0 && h > 0) preview.paint(ctx, w, h, dt)
    }
    const moving = () =>
      Boolean(preview) && (autoplay || hovered || focused || centred) && near && !document.hidden && !still.matches
    // Marked on the canvas while it plays, for a cabinet that shows its picture until then.
    const playing = (on: boolean) => canvas.classList.toggle('game-preview--playing', on)
    const frame = (now: number) => {
      raf = 0
      if (!moving()) {
        playing(false)
        return
      }
      // Marked again each frame: the ready re-render rewrites the canvas's classes, and can land just after a
      // pointer that came before the preview was ready started it.
      playing(true)
      owed += last ? Math.min(0.25, (now - last) / 1000) : 0
      last = now
      if (owed >= 1 / FPS) {
        draw(owed)
        owed = 0
      }
      raf = requestAnimationFrame(frame)
    }
    const resume = () => {
      if (raf || !moving()) return
      last = 0
      owed = 0
      playing(true)
      raf = requestAnimationFrame(frame)
    }
    // A frozen preview still redraws for a new theme or size, and once the page's fonts are in, in case its
    // lettering was first drawn in a stand-in.
    const redraw = () => {
      if (!raf) draw(0)
    }

    // Load the game and put its still frame up.
    const startLoad = () => {
      loading = true
      load()
        .then((mod) => {
          if (cancelled) return
          const run = mod.createPreview()
          made = run
          // The opening seconds are played a slice per turn, so no one turn runs long.
          const job = () => {
            if (cancelled) return
            const w = canvas.clientWidth
            const h = canvas.clientHeight
            if (run.warm && w > 0 && h > 0 && !run.warm(w, h, WARM_SLICE_MS)) {
              inTurn(job)
              return
            }
            preview = run
            draw(0)
            setReady(true)
            resume()
          }
          inTurn(job)
        })
        .catch(() => {
          /* no preview; the thumb underneath stays */
        })
    }
    // Once the tile comes near the screen; a touch screen's rail tile waits for its turn, so a phone only
    // fetches the games it plays.
    const nearby = new IntersectionObserver(
      (entries) => {
        near = entries.some((e) => e.isIntersecting)
        if (near && !preview && !loading && (!touchRail || centred)) startLoad()
        else resume()
      },
      { rootMargin: '200px' },
    )
    nearby.observe(canvas)

    // A mouse over the tile, or keyboard focus on it. A finger's touch is a tap, not a hover.
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      hovered = true
      resume()
    }
    const onLeave = () => {
      hovered = false
    }
    const onFocus = () => {
      focused = host.matches(':focus-visible')
      resume()
    }
    const onBlur = () => {
      focused = false
    }
    host.addEventListener('pointerenter', onEnter)
    host.addEventListener('pointerleave', onLeave)
    host.addEventListener('focus', onFocus)
    host.addEventListener('blur', onBlur)

    // With no hover to ask with, the tile nearest the middle of the screen plays.
    const me: Centred = {
      el: host,
      play(on) {
        centred = on
        resume()
      },
    }
    const band = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !hoverable.matches) inBand.add(me)
          else {
            inBand.delete(me)
            centred = false
          }
        }
        pickCentred()
      },
      { rootMargin: '-35% 0px -35% 0px' },
    )
    // One that plays on its own has no need to take a turn in the middle of the screen, nor to hold a tile's back;
    // a rail's tile takes its turn in its row.
    if (!autoplay && !hoverOnly && !rail) band.observe(host)

    // On a touch screen, a turn in its row: it loads when it first gets one, and lets go of its scene when it
    // loses its turn to another tile.
    const tile: RailTile = {
      el: host,
      play(on) {
        centred = on
        if (on && near && !preview && !loading) startLoad()
        resume()
      },
      release() {
        if (!centred) preview?.dispose?.()
      },
    }
    if (row) joinRail(row, tile)

    const ro = new ResizeObserver(redraw)
    ro.observe(canvas)
    document.addEventListener('visibilitychange', resume)
    still.addEventListener('change', resume)
    window.addEventListener(THEME_EVENT, redraw)
    document.fonts.addEventListener('loadingdone', redraw)

    return () => {
      cancelled = true
      nearby.disconnect()
      band.disconnect()
      inBand.delete(me)
      pickCentred()
      if (row) leaveRail(row, tile)
      ro.disconnect()
      host.removeEventListener('pointerenter', onEnter)
      host.removeEventListener('pointerleave', onLeave)
      host.removeEventListener('focus', onFocus)
      host.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', resume)
      still.removeEventListener('change', resume)
      window.removeEventListener(THEME_EVENT, redraw)
      document.fonts.removeEventListener('loadingdone', redraw)
      if (raf) cancelAnimationFrame(raf)
      made?.dispose?.()
    }
  }, [slug, day, autoplay, hoverOnly, rail])

  return (
    <canvas
      ref={ref}
      className={`game-preview${ready ? ' game-preview--ready' : ''}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    />
  )
}
