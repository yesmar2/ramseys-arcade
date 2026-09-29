import { point, type Course } from './sim'

/** Marble Run's magenta, the ghost's cyan, the checkpoints' amber. */
const BALL = '#d774f0'
const GHOST = '#46e4ff'
const GATE = '#f5b942'

/**
 * The map in the corner: the course from above, drawn once in the theme's ink so it reads on a light tile
 * and a dark one, with its checkpoints and the goal; the marble and the ghost dotted on it each frame. The
 * course starts at the bottom and heads up the map, as it heads away from the camera at the start.
 */
export class CourseMap {
  private readonly canvas: HTMLCanvasElement
  private readonly course: Course
  private outline: HTMLCanvasElement | null = null
  private fit: ((x: number, z: number) => [number, number]) | null = null
  private size = ''

  constructor(canvas: HTMLCanvasElement, course: Course) {
    this.canvas = canvas
    this.course = course
  }

  /** Draw the course again: the tile changed size, or the theme changed. */
  rebuild() {
    this.size = ''
  }

  private build() {
    const { canvas, course } = this
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
    const [x0, x1, z0, z1] = course.box
    const pad = 10
    const scale = Math.min((w - pad * 2) / (x1 - x0), (h - pad * 2) / (z1 - z0))
    const ox = (w - (x1 - x0) * scale) / 2
    const oz = (h - (z1 - z0) * scale) / 2
    const fit = (x: number, z: number): [number, number] => [(ox + (x - x0) * scale) * dpr, (oz + (z - z0) * scale) * dpr]
    this.fit = fit
    const outline = document.createElement('canvas')
    outline.width = canvas.width
    outline.height = canvas.height
    const g = outline.getContext('2d')!
    g.lineJoin = 'round'
    g.lineCap = 'round'
    const ink = getComputedStyle(canvas).getPropertyValue('--ink-rgb').trim() || '231, 238, 243'
    g.strokeStyle = `rgba(${ink}, 0.7)`
    g.lineWidth = 3 * dpr
    // The track, piece by piece, lifting the pen over each gap.
    for (const p of course.pieces) {
      if (p.gap) continue
      g.beginPath()
      const n = Math.max(2, Math.ceil(p.len / 2))
      for (let i = 0; i <= n; i++) {
        const [px, pz] = fit(...point(p, (p.len * i) / n, 0))
        if (i === 0) g.moveTo(px, pz)
        else g.lineTo(px, pz)
      }
      g.stroke()
    }
    for (const L of course.lines) {
      const [px, pz] = fit(...point(L.p, L.u, 0))
      g.beginPath()
      g.arc(px, pz, (L.goal ? 3.5 : 2.5) * dpr, 0, Math.PI * 2)
      g.fillStyle = L.goal ? BALL : GATE
      g.fill()
    }
    this.outline = outline
  }

  draw(ballX: number, ballZ: number, ghost: { x: number; z: number } | null) {
    this.build()
    const { canvas, outline, fit } = this
    if (!outline || !fit) return
    const g = canvas.getContext('2d')!
    g.clearRect(0, 0, canvas.width, canvas.height)
    g.drawImage(outline, 0, 0)
    const dpr = canvas.width / Math.max(1, canvas.clientWidth)
    const dot = (x: number, z: number, color: string, r: number) => {
      const [px, pz] = fit(x, z)
      g.beginPath()
      g.arc(px, pz, r * dpr, 0, Math.PI * 2)
      g.fillStyle = color
      g.fill()
    }
    if (ghost) dot(ghost.x, ghost.z, GHOST, 3.5)
    dot(ballX, ballZ, BALL, 4.5)
  }
}
