// Lander's small game picture in its new look (src/components/GameArt.tsx), as the file it shows.
//
//   node scripts/lander-art.mjs
//
// The picture is the game's own of itself (src/games/lander/lampPicture.ts gameArtSvg: the pod by a lantern it
// has just lit, in cave #1, drawn from the shapes and colours the game is drawn from). It's kept as a file so
// that GameArt, which is on every page, needn't carry a cave and what grows in it to draw one small picture.
// Run it again whenever what it's drawn from changes (lampPicture.ts, the colours and the pod in lampParts.ts,
// where the lanterns hang in lanternPlan.ts), and commit what it writes.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'src/assets/art')

// A cache folder of its own: with the site's (node_modules/.vite), this would clear out the bundled
// dependencies a dev server running in the same folder is serving, and break its pages until it's restarted.
const server = await createServer({
  root,
  configFile: false,
  cacheDir: join(root, 'node_modules/.vite-scripts'),
  optimizeDeps: { noDiscovery: true, include: [] },
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null },
})
try {
  const { gameArtSvg } = await server.ssrLoadModule('/src/games/lander/lampPicture.ts')
  mkdirSync(out, { recursive: true })
  const svg = gameArtSvg()
  writeFileSync(join(out, 'lander-lamp.svg'), `${svg}\n`)
  console.log(`src/assets/art/lander-lamp.svg: ${(svg.length / 1024).toFixed(1)} KB`)
} finally {
  await server.close()
}
