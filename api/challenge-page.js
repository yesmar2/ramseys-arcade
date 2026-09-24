import { challengeWords, originOf, queryOf, readChallenge, readGames, SLUG } from './_og/challenge.js'

/*
 * GET /c/<game>/<id> (vercel.json rewrites it here): the game's prerendered
 * challenge page, with its tags rewritten for this one challenge, so the link
 * unfurls as "VERA challenges you on Crosswalk" over a card with the score.
 * The page is the same app either way; it reads the challenge from the
 * address and opens it. When the API can't say in time, the tags stay the
 * game's own and the link still unfurls, just without the name and score.
 */

/** @param {string} text */
function esc(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Put a value between the two captured halves of a tag; a tag the page
 * doesn't have is left alone.
 * @param {string} html
 * @param {RegExp} pattern
 * @param {string} value
 */
function stamp(html, pattern, value) {
  return html.replace(pattern, (_, before, after) => `${before}${value}${after}`)
}

/**
 * The page to start from: the game's challenge page, or the site's shell for
 * a game the build doesn't know.
 * @param {string} origin
 * @param {string} game
 */
async function readTemplate(origin, game) {
  const paths = SLUG.test(game) ? [`/c/${game}/index.html`, '/index.html'] : ['/index.html']
  for (const path of paths) {
    try {
      const res = await fetch(`${origin}${path}`)
      if (res.ok) return await res.text()
    } catch {
      /* try the next */
    }
  }
  return null
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
export default async function handler(req, res) {
  const query = queryOf(req)
  const game = (query.get('game') ?? '').toLowerCase()
  const origin = originOf(req)
  const [template, challenge, games] = await Promise.all([
    readTemplate(origin, game),
    readChallenge(query.get('id') ?? ''),
    readGames(origin).catch(() => /** @type {Record<string, never>} */ ({})),
  ])

  if (!template) {
    res.statusCode = 503
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end('The arcade is busy. Try the link again in a moment.')
    return
  }

  let html = template
  if (challenge) {
    const words = challengeWords(challenge, games[challenge.game])
    const brand = /<meta\s+property="og:site_name"\s+content="([^"]*)"/.exec(template)?.[1] || 'Skermix'
    const url = `${origin}/c/${challenge.game}/${challenge.id}`
    const image = `${origin}/api/challenge-card?game=${encodeURIComponent(challenge.game)}&id=${challenge.id}`
    html = stamp(html, /(<title>)[^<]*(<\/title>)/, esc(`${words.title} · ${brand}`))
    html = stamp(html, /(<meta\s+name="description"\s+content=")[^"]*(")/, esc(words.description))
    html = stamp(html, /(<link\s+rel="canonical"\s+href=")[^"]*(")/, esc(url))
    html = stamp(html, /(<meta\s+property="og:title"\s+content=")[^"]*(")/, esc(words.title))
    html = stamp(html, /(<meta\s+property="og:description"\s+content=")[^"]*(")/, esc(words.description))
    html = stamp(html, /(<meta\s+property="og:url"\s+content=")[^"]*(")/, esc(url))
    html = stamp(html, /(<meta\s+property="og:image"\s+content=")[^"]*(")/, esc(image))
  }
  // Somebody's link to somebody, never a search result, even on the site's own shell.
  if (!/<meta\s+name="robots"/.test(html)) {
    html = html.replace('</head>', '  <meta name="robots" content="noindex" />\n  </head>')
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  // A challenge never changes; each deployment starts its cache afresh, so the page's scripts stay current.
  res.setHeader(
    'Cache-Control',
    challenge ? 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800' : 'public, max-age=0, s-maxage=60',
  )
  res.end(html)
}
