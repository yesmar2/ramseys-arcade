import { ImageResponse } from '@vercel/og'
import { originOf, queryOf, readGames } from './_og/challenge.js'
import { eventCard, eventWords, readEvent } from './_og/event.js'
import { OUTFIT } from './_og/fonts.js'

/*
 * GET /api/event-card?id=<event>&name=<tag>: the picture a shared event result
 * unfurls into (1200×630): where that player stands, read from the standings
 * as it's drawn. A live event's card is redrawn every few minutes, since the
 * standings move; a finished one's never changes. The stand-in drawn while the
 * API can't be reached is kept for a minute.
 */

const fonts = OUTFIT.map(({ weight, base64 }) => ({
  name: 'Outfit',
  data: Buffer.from(base64, 'base64'),
  weight,
  style: /** @type {const} */ ('normal'),
}))

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
export default async function handler(req, res) {
  const query = queryOf(req)
  const name = query.get('name') ?? ''
  const origin = originOf(req)
  try {
    const [event, games] = await Promise.all([
      readEvent(query.get('id') ?? '', name),
      readGames(origin).catch(() => /** @type {Record<string, never>} */ ({})),
    ])
    const words = event ? eventWords(event, name, games) : null
    const game = event?.games.length === 1 ? event.games[0] : undefined
    const card = new ImageResponse(eventCard(words, game ? games[game] : undefined, event?.title ?? null), {
      width: 1200,
      height: 630,
      fonts,
    })
    const png = Buffer.from(await card.arrayBuffer())
    res.statusCode = 200
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Content-Length', png.length)
    res.setHeader(
      'Cache-Control',
      !words
        ? 'public, max-age=60, s-maxage=60'
        : words.over
          ? 'public, max-age=86400, s-maxage=31536000, immutable'
          : 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600',
    )
    res.end(png)
  } catch (err) {
    // Drawing failed: the site's own card.
    console.error('event-card:', err)
    res.statusCode = 302
    res.setHeader('Location', '/og.png')
    res.setHeader('Cache-Control', 'no-store')
    res.end()
  }
}
