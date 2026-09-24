import { ImageResponse } from '@vercel/og'
import { challengeCard, originOf, queryOf, readChallenge, readGames, SLUG } from './_og/challenge.js'
import { OUTFIT } from './_og/fonts.js'

/*
 * GET /api/challenge-card?game=<slug>&id=<id>: the picture a challenge link
 * unfurls into (1200×630), drawn from the challenge itself. A challenge never
 * changes, so its card is cached for good; the stand-in drawn while the API
 * can't be reached is cached for a minute.
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
  const hint = (query.get('game') ?? '').toLowerCase()
  const origin = originOf(req)
  try {
    const [challenge, games] = await Promise.all([
      readChallenge(query.get('id') ?? ''),
      readGames(origin).catch(() => /** @type {Record<string, never>} */ ({})),
    ])
    const game = challenge?.game ?? (SLUG.test(hint) ? hint : '')
    const card = new ImageResponse(challengeCard(challenge ?? null, games[game]), { width: 1200, height: 630, fonts })
    const png = Buffer.from(await card.arrayBuffer())
    res.statusCode = 200
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Content-Length', png.length)
    res.setHeader(
      'Cache-Control',
      challenge ? 'public, max-age=86400, s-maxage=31536000, immutable' : 'public, max-age=60, s-maxage=60',
    )
    res.end(png)
  } catch (err) {
    // Drawing failed: the game's own card, which the build made.
    console.error('challenge-card:', err)
    res.statusCode = 302
    res.setHeader('Location', SLUG.test(hint) ? `/og/challenge/${hint}.png` : '/og.png')
    res.setHeader('Cache-Control', 'no-store')
    res.end()
  }
}
