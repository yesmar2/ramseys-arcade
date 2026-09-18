import { useEffect, useRef } from 'react'
import { posters } from '../games/posters'
import { THEME_EVENT } from '../lib/theme'

/**
 * A still of the game itself: a good moment of play, drawn by the game's own
 * renderer into a canvas that fills its parent. The moment is rebuilt at the
 * parent's size whenever that changes and redrawn when the theme does, so it
 * is the game as it would look in play, in either theme. The canvas stays
 * clear until its first frame has landed, so the tile behind holds the space.
 */
export function GamePoster({ slug, className }: { slug: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const host = canvas?.parentElement
    const poster = posters[slug]
    if (!canvas || !host || !poster) return

    let frame: ((ctx: CanvasRenderingContext2D, w: number, h: number) => void) | null = null
    let size = { w: 0, h: 0 }

    const draw = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx || !frame || !size.w || !size.h) return
      frame(ctx, size.w, size.h)
      canvas.classList.add('game-poster--ready')
    }
    const fit = () => {
      const w = Math.round(host.clientWidth)
      const h = Math.round(host.clientHeight)
      if (!w || !h || (w === size.w && h === size.h)) return
      size = { w, h }
      frame = poster(w, h)
      draw()
    }

    fit()
    const watcher = new ResizeObserver(fit)
    watcher.observe(host)
    window.addEventListener(THEME_EVENT, draw)
    return () => {
      watcher.disconnect()
      window.removeEventListener(THEME_EVENT, draw)
    }
  }, [slug])

  return <canvas ref={ref} className={`game-poster${className ? ` ${className}` : ''}`} aria-hidden="true" />
}
