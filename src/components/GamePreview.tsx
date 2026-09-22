import { useEffect, useRef, useState } from 'react'
import { GAME_PREVIEWS, type GamePreviewRun } from '../lib/gamePreviews'
import { THEME_EVENT } from '../lib/theme'

/** Frames a second for a preview: plenty for a tile, and half the work of a full game. */
const FPS = 30

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

/**
 * A game playing itself, drawn by the game's own engine and renderer, so it
 * never drifts from the real thing. Its code loads once the tile comes near
 * the screen, and it paints a still frame of the game over the tile's thumb.
 * It plays only when asked: while a mouse is over the tile or it has keyboard
 * focus, or, on a touch screen, while it is the tile nearest the middle of the
 * screen. Letting go freezes it where it is. It never plays off screen, in a
 * hidden tab, or with reduced motion.
 */
export function GamePreview({ slug, className }: { slug: string; className?: string }) {
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
      Boolean(preview) && (hovered || focused || centred) && near && !document.hidden && !still.matches
    const frame = (now: number) => {
      raf = 0
      if (!moving()) return
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
      raf = requestAnimationFrame(frame)
    }
    // A frozen preview still redraws for a new theme or size.
    const redraw = () => {
      if (!raf) draw(0)
    }

    // Load the game and put its still frame up once the tile comes near the screen.
    const nearby = new IntersectionObserver(
      (entries) => {
        near = entries.some((e) => e.isIntersecting)
        if (near && !preview) {
          load()
            .then((mod) => {
              if (cancelled) return
              preview = mod.createPreview()
              draw(0)
              setReady(true)
              resume()
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
    band.observe(host)

    const ro = new ResizeObserver(redraw)
    ro.observe(canvas)
    document.addEventListener('visibilitychange', resume)
    still.addEventListener('change', resume)
    window.addEventListener(THEME_EVENT, redraw)

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
      if (raf) cancelAnimationFrame(raf)
    }
  }, [slug])

  return (
    <canvas
      ref={ref}
      className={`game-preview${ready ? ' game-preview--ready' : ''}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    />
  )
}
