import type { Cave } from './sim'

/** Lander's amber, the ghost's cyan, the gates' gold. */
const SHIP = '#ff9f45'
const GHOST = '#46e4ff'
const GATE = '#f5b942'

/**
 * The map in the corner: the whole cave from the side, drawn once in the theme's ink so it reads on a light
 * tile and a dark one, with its gates and the landing pad; the ship and the ghost dotted on it each frame.
 */
export class CaveMap {
  private readonly canvas: HTMLCanvasElement
  private readonly cave: Cave
  private outline: HTMLCanvasElement | null = null
  private fit: ((x: number, y: number) => [number, number]) | null = null
  private size = ''

  constructor(canvas: HTMLCanvasElement, cave: Cave) {
    this.canvas = canvas
    this.cave = cave
  }

  /** Draw the cave again: the tile changed size, or the theme changed. */
  rebuild() {
    this.size = ''
  }

  private build() {
    const { canvas, cave } = this
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
    const [x0, x1, y0, y1] = cave.box
    const pad = 9
    const scale = Math.min((w - pad * 2) / (x1 - x0), (h - pad * 2) / (y1 - y0))
    const ox = (w - (x1 - x0) * scale) / 2
    const oy = (h - (y1 - y0) * scale) / 2
    const fit = (x: number, y: number): [number, number] => [(ox + (x - x0) * scale) * dpr, (oy + (y1 - y) * scale) * dpr]
    this.fit = fit
    const outline = document.createElement('canvas')
    outline.width = canvas.width
    outline.height = canvas.height
    const g = outline.getContext('2d')
    if (!g) return
    g.lineJoin = 'round'
    g.lineCap = 'round'
    const ink = getComputedStyle(canvas).getPropertyValue('--ink-rgb').trim() || '231, 238, 243'
    g.strokeStyle = `rgba(${ink}, 0.55)`
    g.fillStyle = `rgba(${ink}, 0.55)`
    // The tunnel down its middle, as wide as it is (but never thinner than a line), and the two rooms.
    g.lineWidth = Math.max(2 * dpr, 8 * scale * dpr)
    g.beginPath()
    cave.nodes.forEach((p, i) => {
      const [px, py] = fit(p.x, p.y)
      if (i === 0) g.moveTo(px, py)
      else g.lineTo(px, py)
    })
    g.stroke()
    for (const room of cave.rooms) {
      const [rx, ry] = fit(room.x0, room.y1)
      g.fillRect(rx, ry, (room.x1 - room.x0) * scale * dpr, (room.y1 - room.y0) * scale * dpr)
    }
    for (const gate of cave.gates.slice(0, -1)) {
      const [gx, gy] = fit(gate.x, gate.y)
      g.beginPath()
      g.arc(gx, gy, 2 * dpr, 0, Math.PI * 2)
      g.fillStyle = GATE
      g.fill()
    }
    const land = cave.pads[1]
    const [lx, ly] = fit(land.x0, land.y)
    g.fillStyle = SHIP
    g.fillRect(lx, ly - 2 * dpr, (land.x1 - land.x0) * scale * dpr, 3 * dpr)
    this.outline = outline
  }

  draw(shipX: number, shipY: number, ghost: { x: number; y: number } | null) {
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
    if (ghost) dot(ghost.x, ghost.y, GHOST, 3)
    dot(shipX, shipY, SHIP, 3.8)
  }
}
