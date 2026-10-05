import { COLS, ROWS } from './game'

/*
 * Where everything goes for a screen this size: the well as big as it can be,
 * the held piece and the pieces to come beside it on a wide screen, or in a
 * strip across the top of a phone, with the Shake between them.
 */

export type Box = { x: number; y: number; w: number; h: number }

export type Layout = {
  /** Pixels a cell. */
  cell: number
  /** The well's visible rows. */
  well: Box
  hold: Box
  /** The pieces to come, the next one first. */
  next: Box[]
  /** Where the Shake's button sits. */
  shake: Box
  /** The panels stand beside the well (a wide screen) rather than over it (a phone). */
  side: boolean
}

const PAD = 10
const GAP = 8
/** A phone's strip, in cells tall. */
const STRIP = 2.3
/** A side column, in cells wide. */
const SIDE = 4.4

/**
 * `top` is where the page's own score and buttons end, and `bottom` what to
 * keep clear under the well, both measured on the play area.
 */
export function pileLayout(w: number, h: number, top = 56, bottom = 12): Layout {
  const availW = Math.max(1, w - PAD * 2)
  const availH = Math.max(1, h - top - bottom)

  const stripCell = Math.min(availW / COLS, (availH - GAP) / (ROWS + STRIP))
  const sideCell = Math.min(availH / ROWS, (availW - GAP * 4) / (COLS + SIDE * 2))
  return sideCell >= stripCell * 0.92
    ? sideLayout(Math.floor(sideCell), w, h, top, availH)
    : stripLayout(Math.floor(stripCell), w, top, availW, availH)
}

function sideLayout(cell: number, w: number, _h: number, top: number, availH: number): Layout {
  const wellW = cell * COLS
  const wellH = cell * ROWS
  const well = { x: Math.round((w - wellW) / 2), y: Math.round(top + (availH - wellH) / 2), w: wellW, h: wellH }
  const colW = Math.round(cell * SIDE)
  const leftX = well.x - GAP * 2 - colW
  const rightX = well.x + wellW + GAP * 2
  const hold = { x: leftX, y: well.y, w: colW, h: Math.round(cell * 3.3) }
  const shake = { x: leftX, y: hold.y + hold.h + GAP * 2, w: colW, h: Math.round(cell * 2.4) }
  const next: Box[] = [{ x: rightX, y: well.y, w: colW, h: Math.round(cell * 3.3) }]
  let y = next[0]!.y + next[0]!.h + GAP
  for (let i = 0; i < 4; i++) {
    const box = { x: rightX + Math.round(colW * 0.12), y, w: Math.round(colW * 0.76), h: Math.round(cell * 2.3) }
    next.push(box)
    y += box.h + GAP
  }
  return { cell, well, hold, next, shake, side: true }
}

function stripLayout(cell: number, w: number, top: number, availW: number, availH: number): Layout {
  const wellW = cell * COLS
  const wellH = cell * ROWS
  const stripH = Math.max(46, Math.round(cell * STRIP))
  const groupH = stripH + GAP + wellH
  // Spare height goes mostly under the well, where a thumb is, rather than over the strip.
  const y0 = Math.round(top + Math.max(0, (availH - groupH) * 0.3))
  const well = { x: Math.round((w - wellW) / 2), y: y0 + stripH + GAP, w: wellW, h: wellH }

  // The strip runs the well's width, or a little wider on a phone narrow enough to need it.
  const stripW = Math.min(availW, Math.max(wellW, Math.min(availW, 360)))
  const x0 = Math.round((w - stripW) / 2)
  /*
   * Hold, then the Shake, then three pieces to come, the first a size up. In
   * strip heights: 1 + 1.25 + 1 + 0.75 + 0.75, with a gap between each; if
   * that's wider than the strip, everything shrinks across together.
   */
  const units = [1, 1.25, 1, 0.75, 0.75]
  const gaps = GAP * (units.length - 1) + GAP
  const per = Math.min(stripH, (stripW - gaps) / units.reduce((a, b) => a + b, 0))
  const widths = units.map((u) => Math.round(u * per))
  let x = x0
  const boxAt = (i: number, hFrac = 1): Box => {
    const bw = widths[i]!
    const bh = Math.round(stripH * hFrac)
    const box = { x, y: y0 + Math.round((stripH - bh) / 2), w: bw, h: bh }
    x += bw + GAP
    return box
  }
  const hold = boxAt(0)
  const shake = boxAt(1)
  // The pieces to come keep to the right-hand end, whatever's left over.
  x = x0 + stripW - (widths[2]! + widths[3]! + widths[4]! + GAP * 2)
  const next = [boxAt(2), boxAt(3, 0.82), boxAt(4, 0.82)]
  return { cell, well, hold, next, shake, side: false }
}

/** Whether a point on the play area is inside a box, with a little slack for a thumb. */
export function inBox(box: Box, x: number, y: number, slack = 6): boolean {
  return x >= box.x - slack && x <= box.x + box.w + slack && y >= box.y - slack && y <= box.y + box.h + slack
}
