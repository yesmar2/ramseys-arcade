import { useEffect, useRef, useState } from 'react'
import { GAME_PREVIEWS, type GamePreviewRun } from '../lib/gamePreviews'
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
 * runs its demo. None plays off screen, in a hidden tab, or with reduced
 * motion.
 */
export function GamePreview({
  slug,
  className,
  autoplay = false,
}: {
  slug: string
  className?: string
  /** Play whenever it is on screen, rather than only when asked. */
  autoplay?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const canvas = ref.current
    const load = GAME_PREVIEWS[slug]
    const ctx = canvas?.getContext('2d')
    if (!canvas || !load || !ctx) return
    // The tile's link is what a pointer rests on and what takes focus.
    const host = canvas.closest<HTMLElement>('a, button') ?? canvas

    let cancelled = false
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

    const draw = (dt: number) => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (preview && w > 0 && h > 0) preview.paint(ctx, w, h, dt)
    }
    const moving = () =>
      Boolean(preview) && (autoplay || hovered || focused || centred) && near && !document.hidden && !still.matches
    // Marked on the canvas while it plays, for a tile that shows its logo until then (lib/look.ts).
    const playing = (on: boolean) => canvas.classList.toggle('game-preview--playing', on)
    const frame = (now: number) => {
      raf = 0
      if (!moving()) {
        playing(false)
        return
      }
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

    // Load the game and put its still frame up once the tile comes near the screen.
    const nearby = new IntersectionObserver(
      (entries) => {
        near = entries.some((e) => e.isIntersecting)
        if (near && !preview && !loading) {
          loading = true
          load()
            .then((mod) => {
              const run = mod.createPreview()
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
        } else {
          resume()
        }
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
    // One that plays on its own has no need to take a turn in the middle of the screen, nor to hold a tile's back.
    if (!autoplay) band.observe(host)

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
    }
  }, [slug, autoplay])

  return (
    <canvas
      ref={ref}
      className={`game-preview${ready ? ' game-preview--ready' : ''}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    />
  )
}
