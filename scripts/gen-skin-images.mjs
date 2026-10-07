import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'
import { existsSync, mkdirSync } from 'node:fs'
import { createServer } from 'vite'

/**
 * Each skin's picture (a season's or the Hangar's) as a PNG (public/og/skins/<id>.png), for what can't draw the site's SVG: a
 * challenge link's card (api/_og/challenge.js) shows the skin its run was played in. Drawn from the pass's
 * own pictures (components/season/RewardArt.tsx), so they're the same; Hot Lap's cars' are their renders.
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
    // A render of the game's own drawing, as the pass shows it: Hot Lap's cars by their names, and the skins whose
    // picture is a render under their own id (Swoop's, Marble Run's and Pileup's).
    const named = { 'hotlap-rocket': 'rocket-car', 'hotlap-midnight': 'moon-buggy', 'hotlap-sunracer': 'shuttle-car', 'hotlap-green-flash': 'green-flash', 'hotlap-ice-rocket': 'bobsled', 'hotlap-borealis': 'aurora-glider', 'hotlap-whiteout': 'crystal-car' }[skin.id]
    const render = named ?? (existsSync(`src/assets/season/${skin.id}.webp`) ? skin.id : null)
    if (render) {
      await sharp(`src/assets/season/${render}.webp`).resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(file)
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
