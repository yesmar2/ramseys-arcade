/**
 * Where the scene sits on screen, and how far in the player has zoomed.
 *
 * The scene is laid out in world units. The field is the box on the canvas it
 * fills at zoom 1 — under the strip the readout lives in, and the shape of
 * the scene, so a phone and a desktop see the whole picture. Zooming keeps a
 * world point in the middle of the field and magnifies around it; it can
 * never show past the scene's edges.
 */

export type Camera = { zoom: number; cx: number; cy: number }

export type Field = {
  /** Box on the canvas, in CSS px. */
  x: number
  y: number
  w: number
  h: number
  /** CSS px per world unit at zoom 1. */
  scale: number
}

export type WorldRect = { x0: number; y0: number; x1: number; y1: number }

export const MAX_ZOOM = 4

/** The readout's strip across the top of the canvas, in CSS px. */
export function headerHeight(canvasH: number): number {
  return Math.round(Math.max(44, Math.min(58, canvasH * 0.075)))
}

/** The field: as much of the canvas under the header as the scene's shape allows. */
export function fitField(canvasW: number, canvasH: number, sceneW: number, sceneH: number): Field {
  const top = headerHeight(canvasH)
  const pad = canvasW > 700 ? 12 : 0
  const bottom = canvasW > 700 ? 12 : 0
  const availW = Math.max(1, canvasW - pad * 2)
  const availH = Math.max(1, canvasH - top - bottom)
  const scale = Math.min(availW / sceneW, availH / sceneH)
  const w = sceneW * scale
  const h = sceneH * scale
  return { x: (canvasW - w) / 2, y: top + (availH - h) / 2, w, h, scale }
}

/** The shape a scene should be built in to fill this canvas. */
export function fieldAspect(canvasW: number, canvasH: number): number {
  const top = headerHeight(canvasH)
  const pad = canvasW > 700 ? 12 : 0
  return Math.max(1, canvasH - top - pad) / Math.max(1, canvasW - pad * 2)
}

export function homeCamera(sceneW: number, sceneH: number): Camera {
  return { zoom: 1, cx: sceneW / 2, cy: sceneH / 2 }
}

/** Keep the view inside the scene: no zooming out past the whole picture, no panning off it. */
export function clampCamera(cam: Camera, sceneW: number, sceneH: number): Camera {
  const zoom = Math.max(1, Math.min(MAX_ZOOM, cam.zoom))
  const halfW = sceneW / (2 * zoom)
  const halfH = sceneH / (2 * zoom)
  return {
    zoom,
    cx: Math.max(halfW, Math.min(sceneW - halfW, cam.cx)),
    cy: Math.max(halfH, Math.min(sceneH - halfH, cam.cy)),
  }
}

/** CSS px per world unit at this zoom. */
export function pxPerUnit(cam: Camera, field: Field): number {
  return field.scale * cam.zoom
}

export function worldToScreen(wx: number, wy: number, cam: Camera, field: Field): { x: number; y: number } {
  const k = pxPerUnit(cam, field)
  return {
    x: field.x + field.w / 2 + (wx - cam.cx) * k,
    y: field.y + field.h / 2 + (wy - cam.cy) * k,
  }
}

export function screenToWorld(sx: number, sy: number, cam: Camera, field: Field): { x: number; y: number } {
  const k = pxPerUnit(cam, field)
  return {
    x: cam.cx + (sx - field.x - field.w / 2) / k,
    y: cam.cy + (sy - field.y - field.h / 2) / k,
  }
}

export function viewRect(cam: Camera, field: Field): WorldRect {
  const k = pxPerUnit(cam, field)
  const halfW = field.w / (2 * k)
  const halfH = field.h / (2 * k)
  return { x0: cam.cx - halfW, y0: cam.cy - halfH, x1: cam.cx + halfW, y1: cam.cy + halfH }
}

/** Zoom by a factor about a screen point, keeping the world under it fixed. */
export function zoomAbout(cam: Camera, field: Field, factor: number, sx: number, sy: number, sceneW: number, sceneH: number): Camera {
  const before = screenToWorld(sx, sy, cam, field)
  const zoom = Math.max(1, Math.min(MAX_ZOOM, cam.zoom * factor))
  const k = field.scale * zoom
  const next = {
    zoom,
    cx: before.x - (sx - field.x - field.w / 2) / k,
    cy: before.y - (sy - field.y - field.h / 2) / k,
  }
  return clampCamera(next, sceneW, sceneH)
}

export function sameCamera(a: Camera | null, b: Camera | null, eps = 0.01): boolean {
  if (!a || !b) return false
  return Math.abs(a.zoom - b.zoom) < 0.001 && Math.abs(a.cx - b.cx) < eps && Math.abs(a.cy - b.cy) < eps
}
