import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

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
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        // A generated worker cannot receive `push`; bracket match clocks need it.
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        includeAssets: [
          'favicon.svg',
          'apple-touch-icon.png',
          'pwa-192.png',
          'pwa-512.png',
          'pwa-maskable-512.png',
        ],
        manifest: {
          name: 'Skermix',
          short_name: 'Skermix',
          description: 'Simple games, no ads, just play.',
          theme_color: '#2eb8a0',
          background_color: '#edf7f4',
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
          // Share images are for link unfurlers, not the offline shell.
          globIgnores: ['**/node_modules/**/*', 'og.png', 'og/**'],
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
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
