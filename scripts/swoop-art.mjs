// Swoop's small game picture (src/components/GameArt.tsx), as the two files it shows: by day and by night.
//
//   node scripts/swoop-art.mjs
//
// The picture is the game's own of itself (src/games/swoop/vistaPicture.ts gameArtSvg: the swallow close in
// over a green hill, drawn from the shapes and colours the game is drawn from). It's kept as files so that
// GameArt, which is on every page, needn't carry the game's skies and hills to draw one small picture. Run it
// again whenever what it's drawn from changes (vistaPicture.ts, the bird in birdDesigns.ts or its colours in
// swiftPaint.ts, the skies in vistaSky.ts, what grows on the hills in vistaProps.ts), and commit what it writes.
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
  const { gameArtSvg } = await server.ssrLoadModule('/src/games/swoop/vistaPicture.ts')
  mkdirSync(out, { recursive: true })
  for (const [name, dark] of [
    ['swoop-day', false],
    ['swoop-night', true],
  ]) {
    const svg = gameArtSvg(dark)
    writeFileSync(join(out, `${name}.svg`), `${svg}\n`)
    console.log(`src/assets/art/${name}.svg: ${(svg.length / 1024).toFixed(1)} KB`)
  }
} finally {
  await server.close()
}
