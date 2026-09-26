import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createServer } from 'vite'

/**
 * Static pages for crawlers and link unfurlers.
 *
 * Runs after `vite build`. For every public route it copies the built shell
 * to `dist/<path>/index.html` with that page's title, description, canonical
 * URL and share tags stamped in, plus a plain block of content inside #root
 * for readers that do not run scripts (the app hides and replaces it). The
 * same route list becomes sitemap.xml, and robots.txt keeps crawlers off the
 * pages that are somebody's own.
 *
 * Vercel serves a folder's index.html for the bare path, and everything else
 * still falls back to the shell through the rewrite in vercel.json.
 */

const DIST = 'dist'

const shell = readFileSync(join(DIST, 'index.html'), 'utf8')

// The build baked the origin into the canonical link; read it back rather than
// working it out twice.
const origin = /<link\s+rel="canonical"\s+href="([^"]+)\/"/.exec(shell)?.[1]
if (!origin) throw new Error('prerender: no canonical link in dist/index.html')

function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Replace the value between the two captured halves; throws if the tag is missing. */
function stamp(html, pattern, value) {
  if (!pattern.test(html)) throw new Error(`prerender: index.html has no ${pattern}`)
  return html.replace(pattern, (_, before, after) => `${before}${value}${after}`)
}

function renderContent(content) {
  const paragraphs = content.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')
  const links = content.links
    .map((link) => `<li><a href="${esc(link.href)}">${esc(link.label)}</a></li>`)
    .join('')
  return `<main class="prerender"><h1>${esc(content.heading)}</h1>${paragraphs}${
    links ? `<ul>${links}</ul>` : ''
  }</main>`
}

function pageHtml(meta, content) {
  const url = `${origin}${meta.path}`
  let html = shell
  html = stamp(html, /(<title>)[^<]*(<\/title>)/, esc(meta.title))
  html = stamp(html, /(<meta\s+name="description"\s+content=")[^"]*(")/, esc(meta.description))
  html = stamp(html, /(<link\s+rel="canonical"\s+href=")[^"]*(")/, url)
  html = stamp(html, /(<meta\s+property="og:title"\s+content=")[^"]*(")/, esc(meta.title))
  html = stamp(html, /(<meta\s+property="og:description"\s+content=")[^"]*(")/, esc(meta.description))
  html = stamp(html, /(<meta\s+property="og:url"\s+content=")[^"]*(")/, url)
  html = stamp(html, /(<meta\s+property="og:image"\s+content=")[^"]*(")/, `${origin}${meta.image}`)
  html = stamp(html, /(<div id="root">)(<\/div>)/, renderContent(content))
  return html
}

function outFile(path) {
  return path === '/' ? join(DIST, 'index.html') : join(DIST, path, 'index.html')
}

function robotsTxt() {
  return [
    'User-agent: *',
    'Disallow: /rank',
    'Disallow: /groups',
    'Disallow: /stats',
    'Disallow: /admin',
    'Disallow: /auth/',
    'Disallow: /dev/',
    'Disallow: /tournaments/',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n')
}

function sitemapXml(paths) {
  const urls = paths.map((path) => `  <url><loc>${esc(`${origin}${path}`)}</loc></url>`)
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
}

// The route list and page copy are TypeScript; let Vite load them.
const server = await createServer({
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null },
})
try {
  const { pageContent, pageMeta, publicRoutes } = await server.ssrLoadModule('/src/lib/pageMeta.ts')
  const paths = []
  for (const route of publicRoutes()) {
    const meta = pageMeta(route)
    if (meta.noindex || paths.includes(meta.path)) continue
    paths.push(meta.path)
    const file = outFile(meta.path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, pageHtml(meta, pageContent(route)))
  }
  /*
   * A challenge link, /c/<game>/<id>, starts from its game's page here:
   * api/challenge-page.js rewrites its tags for the one challenge, and falls
   * back to it as it is when the API can't be reached. The app reads the id
   * from the address and opens the challenge itself. Every game gets one,
   * hidden ones too; a game without its challenge card unfurls into the
   * site's own. Kept out of search by a noindex tag, not robots.txt: chat
   * apps that honour robots.txt (X, LinkedIn) would then show no preview.
   * Not in the sitemap either: a link is somebody's, sent to somebody.
   */
  const { games } = await server.ssrLoadModule('/src/data/games.ts')
  const { APP_NAME } = await server.ssrLoadModule('/src/lib/brand.ts')
  const { scoreUnit } = await server.ssrLoadModule('/src/lib/gameBoard.ts')
  const { isTimeBoard } = await server.ssrLoadModule('/src/lib/leaderboardFormat.ts')
  const { FINDBUG_SCORE_BASE } = await server.ssrLoadModule('/src/games/findbug/score.ts')
  const { SPOTTER_SCORE_BASE } = await server.ssrLoadModule('/src/games/spotter/score.ts')
  // The boards that keep a time, as each one prints it (leaderboardFormat.ts).
  const CLOCKS = {
    findbug: { clock: 'tenths', base: FINDBUG_SCORE_BASE },
    spotter: { clock: 'seconds', base: SPOTTER_SCORE_BASE },
  }
  /** What the challenge functions need to word and colour a game's card. */
  const cardGames = {}
  let challengePages = 0
  for (const game of games) {
    const time = isTimeBoard(game.slug)
    if (time && !CLOCKS[game.slug]) console.warn(`prerender: no clock for ${game.slug}; its challenge cards count points`)
    cardGames[game.slug] = {
      name: game.name,
      accent: game.accent,
      unit: time ? null : [scoreUnit(game.slug, 1), scoreUnit(game.slug, 2)],
      clock: CLOCKS[game.slug]?.clock ?? null,
      base: CLOCKS[game.slug]?.base ?? 0,
    }
    const description = `A friend has a score for you to beat on ${game.name}. It plays right here in your browser, no account needed.`
    const card = `/og/challenge/${game.slug}.png`
    const meta = {
      path: `/c/${game.slug}`,
      title: `Can you beat it? A challenge on ${game.name} · ${APP_NAME}`,
      description,
      image: existsSync(join(DIST, card)) ? card : '/og.png',
    }
    const content = {
      heading: `A challenge on ${game.name}`,
      paragraphs: [description],
      links: [{ href: `/games/${game.slug}/play`, label: `Play ${game.name}` }],
    }
    const file = outFile(meta.path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, pageHtml(meta, content).replace('</head>', '  <meta name="robots" content="noindex" />\n  </head>'))
    challengePages++
  }
  mkdirSync(join(DIST, 'og/challenge'), { recursive: true })
  writeFileSync(join(DIST, 'og/challenge/games.json'), JSON.stringify(cardGames))
  writeFileSync(join(DIST, 'robots.txt'), robotsTxt())
  writeFileSync(join(DIST, 'sitemap.xml'), sitemapXml(paths))
  console.log(
    `prerendered ${paths.length} pages and ${challengePages} challenge pages at ${origin}, plus robots.txt and sitemap.xml`,
  )
} finally {
  await server.close()
}
