import type { CSSProperties } from 'react'
import { getGame } from '../data/games'
import { inkOn, mixColor, readableFill, readableText } from './color'
import { resolveGameAccent } from './theme'

/**
 * Inline variables that wash a card in a game's colour: the accent the
 * start, pause, score and celebration cards key their tokens on, the ink
 * that reads on a solid fill of it, the shade of it its buttons are filled
 * with so that ink reads (Swoop's red held 4.0:1 under it), and its own words
 * on the light theme: the shade of it that reads on its deepest tint there, a
 * report's ribbon on its lit band, about 40% of the colour (panel.css,
 * report.css).
 */
export function gameAccentStyle(slug: string): CSSProperties {
  const accent = resolveGameAccent(slug, getGame(slug)?.accent ?? '#2eb8a0')
  return {
    '--celeb-accent': accent,
    '--hero-ink': inkOn(accent),
    '--hero-fill': readableFill(accent),
    '--celeb-text': readableText(accent, mixColor(accent, '#ffffff', 0.6)),
  } as CSSProperties
}
