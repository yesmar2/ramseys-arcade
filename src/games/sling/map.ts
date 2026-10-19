import { type Tower } from './sim'

/** Blip's mint, the blue blip's blue, the flags' gold. */
const BLIP = '#34c6a8'
const BLUE = '#4aa8e8'
const FLAG = '#f5b942'

/**
 * The map by the side: the whole tower from the bottom peg to the top, its pegs as dots up a rail, drawn once
 * in the theme's ink so it reads on a light tile and a dark one, with its flags; Blip and the run to beat dotted
 * on it each frame by how high they are.
 */
export class TowerMap {
  private readonly canvas: HTMLCanvasElement
  private readonly tower: Tower
  private outline: HTMLCanvasElement | null = null
  private at: ((y: number) => number) | null = null
  private size = ''

  constructor(canvas: HTMLCanvasElement, tower: Tower) {
    this.canvas = canvas
    this.tower = tower
  }

  /** Draw the tower again: the tile changed size, or the theme changed. */
  rebuild() {
    this.size = ''
  }

  private build() {
    const { canvas, tower } = this
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
    const pad = 8
    const at = (y: number) => (h - pad - (Math.max(0, Math.min(tower.height, y)) / tower.height) * (h - pad * 2)) * dpr
    this.at = at
    const outline = document.createElement('canvas')
    outline.width = canvas.width
    outline.height = canvas.height
    const g = outline.getContext('2d')
    if (!g) return
    const ink = getComputedStyle(canvas).getPropertyValue('--ink-rgb').trim() || '231, 238, 243'
    const cx = (w / 2) * dpr
    g.fillStyle = `rgba(${ink}, 0.22)`
    g.fillRect(cx - dpr, at(tower.height), 2 * dpr, at(0) - at(tower.height))
    tower.pegs.forEach((pg, i) => {
      g.beginPath()
      g.arc(cx + ((pg.x - 180) / 180) * (w / 2 - 4) * dpr * 0.6, at(pg.y), (i === tower.pegs.length - 1 ? 2.6 : 1.4) * dpr, 0, Math.PI * 2)
      g.fillStyle = `rgba(${ink}, ${i === tower.pegs.length - 1 ? 0.9 : 0.5})`
      g.fill()
    })
    g.fillStyle = FLAG
    for (const k of tower.flags) g.fillRect(cx - 5 * dpr, at(tower.pegs[k]!.y) - dpr, 10 * dpr, 2 * dpr)
    this.outline = outline
  }

  draw(blipY: number, ghostY: number | null) {
    this.build()
    const { canvas, outline, at } = this
    if (!outline || !at) return
    const g = canvas.getContext('2d')
    if (!g) return
    g.clearRect(0, 0, canvas.width, canvas.height)
    g.drawImage(outline, 0, 0)
    const dpr = canvas.width / Math.max(1, canvas.clientWidth)
    const cx = canvas.width / 2
    const dot = (y: number, color: string, r: number) => {
      g.beginPath()
      g.arc(cx, at(y), r * dpr, 0, Math.PI * 2)
      g.fillStyle = color
      g.fill()
    }
    if (ghostY != null) dot(ghostY, BLUE, 3)
    dot(blipY, BLIP, 3.6)
  }
}
