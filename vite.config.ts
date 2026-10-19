import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA, type VitePWAOptions } from 'vite-plugin-pwa'

/**
 * What index.html loads to start: its script, the modules it preloads and its styles. Read when the bundle is
 * written, which comes before vite-plugin-pwa builds the worker (its closeBundle).
 */
let shellAssets: Set<string> | null = null

function shellAssetsPlugin(): Plugin {
  return {
    name: 'blipka:shell-assets',
    apply: 'build',
    writeBundle(_options, bundle) {
      const html = bundle['index.html']
      if (!html || html.type !== 'asset') return
      const source = typeof html.source === 'string' ? html.source : new TextDecoder().decode(html.source)
      shellAssets = new Set([...source.matchAll(/\/(assets\/[^"'\s>]+)/g)].map((match) => match[1]!))
    },
  }
}

type ManifestTransform = NonNullable<NonNullable<VitePWAOptions['injectManifest']>['manifestTransforms']>[number]

/**
 * The worker's list. Of the built files in /assets, the ones index.html loads to start are installed with the
 * worker. The rest are marked 'later' (src/sw.ts LATER), so the worker knows a release's files without fetching
 * them. Beside index.html, only what the app itself needs is listed: no icons or pictures.
 */
const shellOnly: ManifestTransform = (entries) => {
  // The dev server's worker, which has no bundle.
  if (!shellAssets) return { manifest: entries, warnings: [] }
  if (shellAssets.size === 0) throw new Error('index.html loads nothing from /assets/, so the app shell is unknown')
  const shell = shellAssets
  const manifest = entries
    .filter((entry) => entry.url.startsWith('assets/') || /\.(html|js|svg|ico|webmanifest)$/.test(entry.url))
    .map((entry) => (entry.url.startsWith('assets/') && !shell.has(entry.url) ? { ...entry, revision: 'later' } : entry))
  return { manifest, warnings: [] }
}

/**
 * The origin pages are published at, for the canonical link and share image
 * URLs in index.html (`%VITE_SITE_ORIGIN%`) and `import.meta.env`. Set
 * VITE_SITE_ORIGIN to pin it; otherwise Vercel's production domain, and on a
 * laptop the dev server.
 */
function resolveSiteOrigin(env: Record<string, string>): string {
  const explicit = env.VITE_SITE_ORIGIN?.trim().replace(/\/$/, '')
  if (explicit) return explicit
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (vercel) return `https://${vercel}`
  return 'http://localhost:5173'
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  process.env.VITE_SITE_ORIGIN = resolveSiteOrigin(loadEnv(mode, process.cwd(), 'VITE_'))

  return {
    // Keep a single React instance after dep installs / optimizeDeps rebundles
    // (avoids "Invalid hook call" / useState on null in dev).
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react/jsx-runtime'],
    },
    plugins: [
      react(),
      shellAssetsPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        // A generated worker cannot receive `push`; bracket match clocks need it.
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        // The PNG icons are for installing and for notifications, which the browser fetches itself; offline play
        // doesn't need them, and the worker downloaded them all again on every install.
        includeAssets: ['favicon.svg'],
        includeManifestIcons: false,
        manifest: {
          name: 'Blipka',
          short_name: 'Blipka',
          // The line the arcade goes by (lib/brand.ts's SITE_LINE), without the name the app already has.
          description: 'The arcade with no ads, and a new Daily every day.',
          theme_color: '#2eb8a0',
          // The dark page the arcade opens on, so the launch screen doesn't flash light first.
          background_color: '#0c1218',
          display: 'standalone',
          orientation: 'any',
          start_url: '/',
          scope: '/',
          lang: 'en',
          categories: ['games', 'entertainment'],
          icons: [
            {
              src: 'pwa-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'pwa-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        // Routing, cleanup and claim now live in src/sw.ts.
        injectManifest: {
          /*
           * A worker installs the app's shell alone: index.html, what it loads to start, and the small files
           * beside it. Every page, game, picture and sound is kept the first time it's used instead (src/sw.ts),
           * and so is the font, so a first visit downloads what it opens rather than every game (about 1.7 MB of
           * them). Share images are for link unfurlers, and the coming-soon page is for the people the gate stops
           * (middleware.js): neither is ever the app's offline copy.
           */
          globIgnores: ['**/node_modules/**/*', 'og.png', 'og/**', 'soon.html', 'soon/**'],
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,wav,webmanifest}'],
          manifestTransforms: [shellOnly],
        },
        /*
         * The worker runs in dev too, otherwise push is untestable without a
         * production build: with no worker registered there is nothing to
         * receive a `push` event, and the opt-in has nothing to subscribe.
         */
        devOptions: {
          enabled: true,
          type: 'module',
          navigateFallback: 'index.html',
          suppressWarnings: true,
        },
      }),
    ],
  }
})
