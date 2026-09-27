import type { Prize } from '../data/prizes'
import { avatarColor, type Avatar } from './avatars'

/* The prize counter's drawing sums: the ticket's outline, a twinkle, and the light behind a prize on its shelf. */

/** A four-point twinkle. */
export function sparkle(cx: number, cy: number, s: number) {
  return `M${cx} ${cy - s}Q${cx} ${cy} ${cx + s} ${cy}Q${cx} ${cy} ${cx} ${cy + s}Q${cx} ${cy} ${cx - s} ${cy}Q${cx} ${cy} ${cx} ${cy - s}Z`
}

/** A ticket's outline: a strip with rounded corners and a notch cut in each end. */
export function ticketPath(x: number, y: number, w: number, h: number, notch = h * 0.16, corner = h * 0.12): string {
  const n = notch
  const c = corner
  const my = y + h / 2
  const f = (v: number) => Number(v.toFixed(2))
  return (
    `M${f(x + c)} ${f(y)}H${f(x + w - c)}A${f(c)} ${f(c)} 0 0 1 ${f(x + w)} ${f(y + c)}V${f(my - n)}` +
    `A${f(n)} ${f(n)} 0 0 0 ${f(x + w)} ${f(my + n)}V${f(y + h - c)}A${f(c)} ${f(c)} 0 0 1 ${f(x + w - c)} ${f(y + h)}` +
    `H${f(x + c)}A${f(c)} ${f(c)} 0 0 1 ${f(x)} ${f(y + h - c)}V${f(my + n)}A${f(n)} ${f(n)} 0 0 0 ${f(x)} ${f(my - n)}` +
    `V${f(y + c)}A${f(c)} ${f(c)} 0 0 1 ${f(x + c)} ${f(y)}Z`
  )
}

/** The spotlight colour behind a prize on its shelf. */
export function prizeGlow(prize: Prize, avatar: Avatar): string {
  switch (prize.id) {
    case 'holo':
      return 'rgba(200,180,255,0.22)'
    case 'neon':
    case 'glitter':
      return `${avatarColor(avatar.body)}33`
    case 'starfield':
      return 'rgba(107,116,232,0.24)'
    case 'nm-neon':
    case 'cd-carpet':
      return 'rgba(255,79,168,0.18)'
    case 'nm-candy':
      return 'rgba(255,211,110,0.16)'
    case 'cd-aquarium':
    case 'cf-bubbles':
      return 'rgba(74,168,232,0.2)'
    case 'cf-tickets':
      return 'rgba(255,133,82,0.22)'
    case 'cf-stars':
      return 'rgba(245,185,66,0.18)'
    default:
      return 'rgba(231,238,243,0.08)'
  }
}
