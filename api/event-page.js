import { originOf, queryOf, readGames } from './_og/challenge.js'
import { EVENT_ID, eventWords, readEvent } from './_og/event.js'

/*
 * GET /e/<event>/<tag> (vercel.json rewrites it here): a player's place in an
 * event, shared. Whatever unfurls the link reads the tags, rewritten for that
 * player ("SAM2 is 3rd on Daily · Frenzy" over a card with the score); a
 * person is sent straight on to the event, where they can play it too. When
 * the API can't say in time, the tags stay the site's and the link still
 * works.
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

/** Marks this function's own read of the shell, so one that ever came back here ends at once instead of looping. */
const OWN_READ = 'x-event-page-read'

/** @param {string} origin */
async function readShell(origin) {
  try {
    const res = await fetch(`${origin}/index.html`, { headers: { [OWN_READ]: '1' } })
    if (res.ok) return await res.text()
  } catch {
    /* no shell: people go straight on */
  }
  return null
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
export default async function handler(req, res) {
  if (req.headers[OWN_READ]) {
    res.statusCode = 508
    res.end()
    return
  }
  const query = queryOf(req)
  const id = query.get('id') ?? ''
  const name = query.get('name') ?? ''
  const origin = originOf(req)
  const [shell, event, games] = await Promise.all([
    readShell(origin),
    readEvent(id, name),
    readGames(origin).catch(() => /** @type {Record<string, never>} */ ({})),
  ])
  // No such public event: the events page instead. The API not answering in time isn't that, so the event it is.
  const eventPath = EVENT_ID.test(id) && event !== null ? `/tournaments/${encodeURIComponent(id)}` : '/tournaments'

  if (!shell) {
    res.statusCode = 302
    res.setHeader('Location', eventPath)
    res.setHeader('Cache-Control', 'no-store')
    res.end()
    return
  }

  let html = shell
  const words = event ? eventWords(event, name, games) : null
  if (words) {
    const brand = /<meta\s+property="og:site_name"\s+content="([^"]*)"/.exec(shell)?.[1] || 'Blipka'
    const url = `${origin}/e/${encodeURIComponent(id)}/${encodeURIComponent(name)}`
    const image = `${origin}/api/event-card?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`
    html = stamp(html, /(<title>)[^<]*(<\/title>)/, esc(`${words.heading} · ${brand}`))
    html = stamp(html, /(<meta\s+name="description"\s+content=")[^"]*(")/, esc(words.description))
    html = stamp(html, /(<link\s+rel="canonical"\s+href=")[^"]*(")/, esc(url))
    html = stamp(html, /(<meta\s+property="og:title"\s+content=")[^"]*(")/, esc(words.heading))
    html = stamp(html, /(<meta\s+property="og:description"\s+content=")[^"]*(")/, esc(words.description))
    html = stamp(html, /(<meta\s+property="og:url"\s+content=")[^"]*(")/, esc(url))
    html = stamp(html, /(<meta\s+property="og:image"\s+content=")[^"]*(")/, esc(image))
  }
  // Somebody's place, sent to somebody: never a search result.
  if (!/<meta\s+name="robots"/.test(html)) {
    html = html.replace('</head>', '  <meta name="robots" content="noindex" />\n  </head>')
  }
  // A person goes on to the event before the app starts; the tags above are for whatever unfurls the link.
  html = html.replace('<head>', `<head>\n    <script>location.replace(${JSON.stringify(eventPath)})</script>`)

  res.statusCode = 200
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader(
    'Cache-Control',
    !words
      ? 'public, max-age=0, s-maxage=60'
      : words.over
        ? 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800'
        : 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600',
  )
  res.end(html)
}
