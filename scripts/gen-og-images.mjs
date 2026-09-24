import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { createServer } from 'vite'
import { icon, wordmark, WORDMARK_DEFS } from './brand-art.mjs'

/**
 * Share images (Open Graph, 1200×630): one for the site, one per game, and one
 * per game for a challenge link (`/c/<game>/<id>` unfurls into it).
 *
 * The in-app thumbs lean on `color-mix()` and theme variables, which nothing
 * outside a browser can rasterise, so these are drawn fresh: the game's
 * accent, its name and its blurb from the catalogue. Output is committed, so
 * the build does not need to run this — `npm run icons:og` after a game is
 * added or renamed.
 */

const W = 1200
const H = 630
const INK = '#0f1c1a'
const TEAL = '#2eb8a0'
const TEXT = '#f4faf8'
const MUTED = '#a9c4be'
const FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif"

function esc(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Greedy wrap by glyph count — SVG has no text wrapping of its own. */
function wrap(text, maxChars, maxLines) {
  const lines = []
  let line = ''
  for (const word of text.replace(/\s+/g, ' ').trim().split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (next.length > maxChars && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[\s,;:.!?…]+$/, '')}…`
  return kept
}

function lines(items, x, y, size, gap, fill, weight = 400) {
  return items
    .map(
      (item, i) =>
        `<text x="${x}" y="${y + i * gap}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(item)}</text>`,
    )
    .join('\n  ')
}

/** The wordmark along the foot of a card, and after it, smaller, what the card is about. */
function signoff(tail) {
  const mark = wordmark(456, 560, 40, TEXT)
  return `${mark.markup}
  <text x="${mark.end + 18}" y="560" font-family="${FONT}" font-size="30" fill="${MUTED}">${esc(tail)}</text>`
}

const ICON = icon()

function frame(inner, glow = TEAL) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glow" cx="0.15" cy="0.25" r="0.85">
      <stop offset="0" stop-color="${glow}" stop-opacity="0.32"/>
      <stop offset="1" stop-color="${glow}" stop-opacity="0"/>
    </radialGradient>
    ${ICON.defs}
    ${WORDMARK_DEFS}
  </defs>
  <rect width="${W}" height="${H}" fill="${INK}"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  ${inner}
</svg>`
}

function siteCard() {
  return frame(`
  <g transform="translate(96 160) scale(3)">${ICON.body}</g>
  ${wordmark(348, 290, 150, TEXT).markup}
  ${lines(['Simple games, no ads, just play.'], 346, 370, 46, 0, MUTED)}
  ${lines(
    wrap(
      'Free browser games with nothing to install. Leaderboards, record books, and events with friends.',
      54,
      3,
    ),
    346,
    440,
    30,
    42,
    MUTED,
  )}`)
}

function gameCard(game) {
  const blurb = wrap(game.description, 30, 2)
  const how = wrap(game.how, 46, 2)
  const howY = 330 + blurb.length * 50
  return frame(`
  <rect x="96" y="165" width="300" height="300" rx="56" fill="${game.accent}"/>
  <path d="M206 250 L206 380 L316 315 Z" fill="${TEXT}" stroke="${TEXT}" stroke-width="18" stroke-linejoin="round" opacity="0.96"/>
  ${lines([game.name], 452, 258, 88, 0, TEXT, 700)}
  ${lines(blurb, 454, 336, 40, 50, TEXT)}
  ${lines(how, 454, howY, 30, 40, MUTED)}
  ${signoff('· no ads, just play')}`)
}

/**
 * A challenge on one game: the same link for every challenge, so it says what
 * is being asked and where, and the message sent with it carries the score.
 */
function challengeCard(game) {
  return frame(
    `
  <rect x="96" y="165" width="300" height="300" rx="56" fill="${game.accent}"/>
  <path d="M196 390 V240 M196 240 H306 L286 280 L306 320 H196" fill="none" stroke="${TEXT}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" opacity="0.96"/>
  <text x="454" y="205" font-family="${FONT}" font-size="26" font-weight="700" letter-spacing="5" fill="${game.accent}">CHALLENGE</text>
  ${lines(['Can you', 'beat it?'], 452, 300, 96, 96, TEXT, 700)}
  ${lines([`A friend’s score to beat on ${game.name}`], 454, 470, 34, 0, MUTED)}
  ${signoff('· plays in your browser')}`,
    game.accent,
  )
}

async function render(svg, file) {
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(file)
  console.log('wrote', file)
}

// The catalogue is TypeScript; let Vite load it rather than parsing it by hand.
const server = await createServer({
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null },
})
// `npm run icons:og` draws them all; `node scripts/gen-og-images.mjs challenges` only the challenge cards.
const only = process.argv[2]
try {
  const { games } = await server.ssrLoadModule('/src/data/games.ts')
  mkdirSync('public/og/challenge', { recursive: true })
  if (only !== 'challenges') {
    await render(siteCard(), 'public/og.png')
    for (const game of games) {
      if (game.hidden) continue
      await render(gameCard(game), `public/og/${game.slug}.png`)
    }
  }
  for (const game of games) {
    if (game.hidden) continue
    await render(challengeCard(game), `public/og/challenge/${game.slug}.png`)
  }
} finally {
  await server.close()
}
