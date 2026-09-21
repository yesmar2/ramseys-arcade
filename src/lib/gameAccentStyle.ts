import type { CSSProperties } from 'react'
import { getGame } from '../data/games'
import { inkOn } from './color'
import { resolveGameAccent } from './theme'

/**
 * Inline variables that wash a card in a game's colour: the accent the
 * start, pause, score and celebration cards key their tokens on, and the
 * ink that reads on a solid fill of it.
 */
export function gameAccentStyle(slug: string): CSSProperties {
  const accent = resolveGameAccent(slug, getGame(slug)?.accent ?? '#2eb8a0')
  return { '--celeb-accent': accent, '--hero-ink': inkOn(accent) } as CSSProperties
}
