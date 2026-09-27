import { useEffect, useRef } from 'react'
import { drawPortrait, drawPortraitFitted, type Look } from './critters'

/**
 * A bug drawn into a small canvas: the whole of it for the scene card, what it holds included, or just
 * its head and hat for the badge by the clock and the day's line-up of who's wanted.
 */
export function BugPortrait({
  look,
  size,
  crop,
  className = 'findbug__portrait',
  fluid = false,
}: {
  look: Look
  /** Drawn this many CSS pixels across, and shown that size unless `fluid`. */
  size: number
  crop: 'full' | 'head'
  className?: string
  /** Sized by its stylesheet instead, as the archive's and Today's Wanted's pictures are. */
  fluid?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)
    if (crop === 'head') {
      // Head and hat fill the circle; the body drops out of the bottom, and
      // whatever it holds stays on the card rather than crowding the face.
      const h = size * 1.55
      drawPortrait(ctx, { ...look, held: 'none' }, size / 2, size / 2 + h * 0.2, h, { pose: 'stand' })
    } else {
      // All of it in view, however far it reaches: antennae, wings, a balloon.
      drawPortraitFitted(ctx, look, size, { pose: 'wave', mood: 'open' })
    }
  }, [look, size, crop])
  return <canvas ref={ref} className={className} style={fluid ? undefined : { width: size, height: size }} aria-hidden="true" />
}
