import { WORDMARK } from '../api/_og/wordmark.js'

/**
 * The brand's drawings as SVG markup, for the scripts that turn them into
 * files: the icon (a blip in its rings on dark teal), the notification badge
 * and the wordmark for the share images. The site draws its own wordmark
 * (components/BrandMark.tsx) from the same data.
 */

const ICON_DEFS =
  '<radialGradient id="icon-ground" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="#18332e"/><stop offset="1" stop-color="#091211"/></radialGradient>' +
  '<radialGradient id="icon-glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#8dfbe0"/><stop offset="0.3" stop-color="#3ee0b0" stop-opacity="0.55"/><stop offset="1" stop-color="#3ee0b0" stop-opacity="0"/></radialGradient>'

/**
 * The icon on a 64-unit square, as `<defs>` content and a body to go after it.
 * The full cut is for 48px and up; `small` has one bolder ring, which still
 * reads in a browser tab. `bleed` runs the ground to the edges, for a system
 * that rounds the corners itself.
 * @param {{ small?: boolean, bleed?: boolean }} [options]
 */
export function icon({ small = false, bleed = false } = {}) {
  const ground = `<rect width="64" height="64"${bleed ? '' : ' rx="15"'} fill="url(#icon-ground)"/>`
  const blip = small
    ? '<circle cx="32" cy="32" r="18" fill="none" stroke="#3ee0b0" stroke-opacity="0.55" stroke-width="5"/>' +
      '<circle cx="32" cy="32" r="16" fill="url(#icon-glow)"/><circle cx="32" cy="32" r="10" fill="#d5fff3"/>'
    : '<circle cx="32" cy="32" r="23" fill="none" stroke="#3ee0b0" stroke-opacity="0.16" stroke-width="2.2"/>' +
      '<circle cx="32" cy="32" r="15.5" fill="none" stroke="#3ee0b0" stroke-opacity="0.42" stroke-width="2.6"/>' +
      '<circle cx="32" cy="32" r="15" fill="url(#icon-glow)"/><circle cx="32" cy="32" r="7.2" fill="#d5fff3"/>'
  return { defs: ICON_DEFS, body: ground + blip }
}

/**
 * The icon as a file of its own.
 * @param {{ small?: boolean, bleed?: boolean }} [options]
 */
export function iconSvg(options) {
  const { defs, body } = icon(options)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${defs}</defs>${body}</svg>\n`
}

/** The badge Android shows by a notification: only its shape counts, so the blip and one ring, solid. */
export const BADGE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="21" fill="none" stroke="#fff" stroke-width="6"/><circle cx="32" cy="32" r="10" fill="#fff"/></svg>\n'

const { letters, blip, box, shine } = WORDMARK

/** The wordmark glow's gradient, for the `<defs>` of an image that draws the wordmark. */
export const WORDMARK_DEFS = `<radialGradient id="wordmark-glow">${shine.dark.stops
  .map(([offset, opacity]) => `<stop offset="${offset}" stop-color="${shine.dark.glow}" stop-opacity="${opacity}"/>`)
  .join('')}</radialGradient>`

/**
 * The wordmark on a dark ground: its letters start at `x`, on a baseline at
 * `y`, `size` pixels to the em. Returns the markup and the x its letters end
 * at, for whatever follows on the line.
 * @param {number} x
 * @param {number} y
 * @param {number} size
 * @param {string} ink
 */
export function wordmark(x, y, size, ink) {
  const scale = size / 1000
  const markup =
    `<g transform="translate(${round(x - box.x * scale)} ${y}) scale(${scale})">` +
    `<path d="${letters}" fill="${ink}"/>` +
    `<circle cx="${blip.cx}" cy="${blip.cy}" r="${blip.r * shine.dark.reach}" fill="url(#wordmark-glow)"/>` +
    `<circle cx="${blip.cx}" cy="${blip.cy}" r="${blip.r}" fill="${shine.dark.core}"/>` +
    '</g>'
  return { markup, end: round(x + box.width * scale) }
}

/** @param {number} n */
function round(n) {
  return Math.round(n * 100) / 100
}
