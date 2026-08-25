import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'node:fs'

const svg = readFileSync('public/favicon.svg')

await sharp(svg).resize(192, 192).png().toFile('public/pwa-192.png')
await sharp(svg).resize(512, 512).png().toFile('public/pwa-512.png')
await sharp(svg).resize(180, 180).png().toFile('public/apple-touch-icon.png')

// Maskable: full-bleed teal with the mark inset in the safe zone.
const mark = readFileSync('public/favicon.svg', 'utf8')
  .replace(/<svg[^>]*>/, '')
  .replace('</svg>', '')
const maskable = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" fill="#2eb8a0"/>
  <g transform="translate(96 96) scale(10)">
    ${mark}
  </g>
</svg>`
writeFileSync('public/pwa-maskable.svg', maskable)
await sharp(Buffer.from(maskable)).resize(512, 512).png().toFile('public/pwa-maskable-512.png')

console.log('Wrote pwa-192, pwa-512, apple-touch-icon, pwa-maskable-512')
