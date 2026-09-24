import sharp from 'sharp'
import { writeFileSync } from 'node:fs'
import { BADGE_SVG, iconSvg } from './brand-art.mjs'

/**
 * The icons: the favicon a browser tab shows, the ones a phone or a computer
 * puts on its home screen, and the notification badge. All drawn in
 * scripts/brand-art.mjs; `npm run icons:pwa` after changing it.
 */

/** @param {string} svg @param {number} size @param {string} file */
async function png(svg, size, file) {
  // Drawn at 600dpi (533px for the 64-unit icon), then brought down, so no size is scaled up.
  await sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png({ compressionLevel: 9 }).toFile(file)
}

writeFileSync('public/favicon.svg', iconSvg({ small: true }))
await png(iconSvg(), 192, 'public/pwa-192.png')
await png(iconSvg(), 512, 'public/pwa-512.png')
// A phone cuts its own corners, and anything left clear behind them would show as black.
await png(iconSvg({ bleed: true }), 180, 'public/apple-touch-icon.png')
// Maskable: the blip and its rings already sit inside the safe circle, 40% of the width from the centre.
await png(iconSvg({ bleed: true }), 512, 'public/pwa-maskable-512.png')
await png(BADGE_SVG, 96, 'public/badge-96.png')

console.log('Wrote favicon.svg, pwa-192, pwa-512, apple-touch-icon, pwa-maskable-512, badge-96')
