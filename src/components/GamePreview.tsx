import { useEffect, useRef, useState } from 'react'
import { GAME_PREVIEWS, type GamePreviewRun } from '../lib/gamePreviews'
import { THEME_EVENT } from '../lib/theme'

/** Frames a second for a preview: plenty for a tile, and half the work of a full game. */
const FPS = 30

/**
 * A game playing itself, drawn by the game's own engine and renderer, so it
 * never drifts from the real thing. Its code loads only once the tile comes
 * near the screen, it animates only while it is on screen in a visible tab,
 * and with reduced motion it paints one still frame. It fades in over
 * whatever sits beneath it (the tile's thumb) once that first frame is down.
 */
export function GamePreview({ slug, className }: { slug: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const canvas = ref.current
    const load = GAME_PREVIEWS[slug]
    const ctx = canvas?.getContext('2d')
    if (!canvas || !load || !ctx) return

    let cancelled = false
    let preview: GamePreviewRun | null = null
    let onScreen = false
    let raf = 0
    let last = 0
    let owed = 0
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')

    const draw = (dt: number) => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (preview && w > 0 && h > 0) preview.paint(ctx, w, h, dt)
    }
    const moving = () => Boolean(preview) && onScreen && !document.hidden && !still.matches
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
    // Without the loop running (reduced motion, or paused), a new theme or size still redraws.
    const redraw = () => {
      if (!raf) draw(0)
    }

    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((e) => e.isIntersecting)
        if (onScreen && !preview) {
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
      { rootMargin: '160px' },
    )
    io.observe(canvas)
    const ro = new ResizeObserver(redraw)
    ro.observe(canvas)
    document.addEventListener('visibilitychange', resume)
    still.addEventListener('change', resume)
    window.addEventListener(THEME_EVENT, redraw)

    return () => {
      cancelled = true
      io.disconnect()
      ro.disconnect()
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
