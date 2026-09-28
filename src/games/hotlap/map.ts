import type { Track } from './sim'

/** Hot Lap's orange, and the ghost's sky blue. */
const CAR = '#f2813a'
const GHOST = '#46e4ff'

/**
 * The map in the corner: the track drawn once, in the theme's ink so it reads on a light tile and a dark
 * one, with the start in orange; the two cars dotted on it each frame.
 */
export class TrackMap {
  private readonly canvas: HTMLCanvasElement
  private readonly track: Track
  private outline: HTMLCanvasElement | null = null
  private fit: ((x: number, y: number) => [number, number]) | null = null
  private size = ''

  constructor(canvas: HTMLCanvasElement, track: Track) {
    this.canvas = canvas
    this.track = track
  }

  /** Draw the track again: the tile changed size, or the theme changed. */
  rebuild() {
    this.size = ''
  }

  private build() {
    const { canvas, track } = this
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
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (let i = 0; i < track.n; i++) {
      minX = Math.min(minX, track.x[i]!)
      maxX = Math.max(maxX, track.x[i]!)
      minY = Math.min(minY, track.y[i]!)
      maxY = Math.max(maxY, track.y[i]!)
    }
    const pad = 10
    const scale = Math.min((w - pad * 2) / (maxX - minX), (h - pad * 2) / (maxY - minY))
    const ox = (w - (maxX - minX) * scale) / 2
    const oy = (h - (maxY - minY) * scale) / 2
    const fit = (x: number, y: number): [number, number] => [(ox + (x - minX) * scale) * dpr, (h - oy - (y - minY) * scale) * dpr]
    this.fit = fit
    const outline = document.createElement('canvas')
    outline.width = canvas.width
    outline.height = canvas.height
    const g = outline.getContext('2d')!
    g.lineJoin = 'round'
    g.beginPath()
    for (let i = 0; i <= track.n; i++) {
      const [px, py] = fit(track.x[i % track.n]!, track.y[i % track.n]!)
      if (i === 0) g.moveTo(px, py)
      else g.lineTo(px, py)
    }
    const ink = getComputedStyle(canvas).getPropertyValue('--ink-rgb').trim() || '231, 238, 243'
    g.strokeStyle = `rgba(${ink}, 0.7)`
    g.lineWidth = 3 * dpr
    g.stroke()
    const [sx, sy] = fit(track.x[track.startIndex]!, track.y[track.startIndex]!)
    g.fillStyle = CAR
    g.fillRect(sx - 1.5 * dpr, sy - 5 * dpr, 3 * dpr, 10 * dpr)
    this.outline = outline
  }

  draw(carX: number, carY: number, ghost: { x: number; y: number } | null) {
    this.build()
    const { canvas, outline, fit } = this
    if (!outline || !fit) return
    const g = canvas.getContext('2d')!
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
    if (ghost) dot(ghost.x, ghost.y, GHOST, 3.5)
    dot(carX, carY, CAR, 4.5)
  }
}
