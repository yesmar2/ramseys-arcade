import { heightAt, hillsSpan, type Hills } from './sim'

/** Swoop's red, the blue bird's blue, the flags' gold. */
const BIRD = '#e8564f'
const BLUE = '#4aa8e8'
const FLAG = '#f5b942'

/**
 * The map in the corner: the whole way from the start to the line, from the side, drawn once in the theme's
 * ink so it reads on a light tile and a dark one, with its flags; your bird and the run to beat dotted on it
 * each frame.
 */
export class HillsMap {
  private readonly canvas: HTMLCanvasElement
  private readonly hills: Hills
  private outline: HTMLCanvasElement | null = null
  private fit: ((x: number, y: number) => [number, number]) | null = null
  private size = ''

  constructor(canvas: HTMLCanvasElement, hills: Hills) {
    this.canvas = canvas
    this.hills = hills
  }

  /** Draw the hills again: the tile changed size, or the theme changed. */
  rebuild() {
    this.size = ''
  }

  private build() {
    const { canvas, hills } = this
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const size = `${w}x${h}@${dpr}`
    if (size === this.size && this.outline) return
    this.size = size
    if (w <= 0 || h <= 0) {
      this.outline = null
      return
    }
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    const [lo, hi] = hillsSpan(hills)
    const pad = 7
    const x1 = hills.finish
    // The hills are far longer than they're high: stretched up to fill the tile, so the tops show.
    const fit = (x: number, y: number): [number, number] => [
      (pad + (Math.min(Math.max(x, 0), x1) / x1) * (w - pad * 2)) * dpr,
      (h - pad - ((y - lo) / Math.max(1, hi - lo)) * (h - pad * 2.2)) * dpr,
    ]
    this.fit = fit
    const outline = document.createElement('canvas')
    outline.width = canvas.width
    outline.height = canvas.height
    const g = outline.getContext('2d')
    if (!g) return
    const ink = getComputedStyle(canvas).getPropertyValue('--ink-rgb').trim() || '231, 238, 243'
    g.lineJoin = 'round'
    g.lineCap = 'round'
    g.beginPath()
    for (let x = 0; x <= x1; x += 4) {
      const [px, py] = fit(x, heightAt(hills, x))
      if (x === 0) g.moveTo(px, py)
      else g.lineTo(px, py)
    }
    g.lineWidth = 1.6 * dpr
    g.strokeStyle = `rgba(${ink}, 0.6)`
    g.stroke()
    g.fillStyle = FLAG
    for (const fx of hills.flags) {
      const [px] = fit(fx, lo)
      g.fillRect(px - dpr, pad * 0.5 * dpr, 2 * dpr, (h - pad) * dpr)
    }
    const [lx] = fit(x1, lo)
    g.fillStyle = `rgba(${ink}, 0.8)`
    g.fillRect(lx - 1.5 * dpr, pad * 0.5 * dpr, 3 * dpr, (h - pad) * dpr)
    this.outline = outline
  }

  draw(birdX: number, birdY: number, ghost: { x: number; y: number } | null) {
    this.build()
    const { canvas, outline, fit } = this
    if (!outline || !fit) return
    const g = canvas.getContext('2d')
    if (!g) return
    g.clearRect(0, 0, canvas.width, canvas.height)
    g.drawImage(outline, 0, 0)
    const dpr = canvas.width / Math.max(1, canvas.clientWidth)
    const dot = (x: number, y: number, color: string, r: number) => {
      const [px, py] = fit(x, y)
      g.beginPath()
      g.arc(px, py, r * dpr, 0, Math.PI * 2)
      g.fillStyle = color
      g.fill()
    }
    if (ghost) dot(ghost.x, ghost.y, BLUE, 2.8)
    dot(birdX, birdY, BIRD, 3.4)
  }
}
