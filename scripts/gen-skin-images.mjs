import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { createServer } from 'vite'

/**
 * Each season skin's picture as a PNG (public/og/skins/<id>.png), for what can't draw the site's SVG: a
 * challenge link's card (api/_og/challenge.js) shows the skin its run was played in. Drawn from the pass's
 * own pictures (components/season/RewardArt.tsx), so they're the same; the Rocket car's is its render.
 * Output is committed: `npm run icons:skins` after a skin is added or redrawn.
 */

const SIZE = 256

const server = await createServer({
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  esbuild: { jsx: 'automatic' },
  server: { middlewareMode: true, hmr: false, watch: null },
})
try {
  const { SKINS } = await server.ssrLoadModule('/src/lib/skins.ts')
  const { RewardArt } = await server.ssrLoadModule('/src/components/season/RewardArt.tsx')
  mkdirSync('public/og/skins', { recursive: true })
  for (const skin of SKINS) {
    const file = `public/og/skins/${skin.id}.png`
    if (skin.id === 'hotlap-rocket') {
      // A render of Hot Lap's own 3D car, as the pass shows it.
      await sharp('src/assets/season/rocket-car.webp').resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(file)
    } else {
      const svg = renderToStaticMarkup(createElement(RewardArt, { reward: { kind: 'skin', id: skin.id, name: skin.name }, size: SIZE }))
      const withNs = svg.includes('xmlns=') ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
      await sharp(Buffer.from(withNs)).png().toFile(file)
    }
    console.log('wrote', file)
  }
} finally {
  await server.close()
}
