/*
 * Each game's first move, shown once on its first run (components/FirstMoveHint.tsx): a finger doing it over
 * the play area on a touch screen, with a few words under it, and the words alone on a computer. Only the
 * one move a player needs to get going, made from the first control in data/howToPlay.ts and what the game
 * really does; the rest is in How to play, and they learn it by playing.
 *
 * A game left out shows nothing. Find the Bug opens its run on the wanted card, so a hint would sit over the
 * card and go at the tap that puts it away. Fidget's first call could be any of its five controls. Centroid's
 * first plate already says "Tap where the plate would balance", on a phone and a computer, and a finger
 * tapping anywhere on the table would point at a place for the pin.
 */

/** What the finger does: slides across and back, presses, presses and stays, flicks, or draws back and lets go. */
export type FirstGesture = 'drag' | 'tap' | 'hold' | 'swipe' | 'pull'

export type FirstMove = {
  /** Under the finger on a touch screen: Drag anywhere to fly. */
  touch: string
  /** On a computer, where there's no finger to show: the keys, or the mouse where that's the way. */
  keys: string
  /** The finger's move. Left out, there's no finger: the controls are buttons off the play area. */
  gesture?: FirstGesture
  /** A drag goes across the screen and back, or up and down it. Across, unless it says. */
  way?: 'across' | 'up'
  /** The finger's middle, across and down the play area, as CSS lengths. In the middle, a little low, unless it says. */
  at?: { x: string; y: string }
  /** The words' middle, down the play area, where under the finger isn't the place for them. */
  wordsAt?: string
  /**
   * The game says the move itself, in a line of its own on the play area (a racing daily's coach at the foot of
   * the screen, Snake's card while it waits to set off, Half Full's "Drag up to pour"), so the hint draws the
   * finger alone, by that line, and the words don't show twice: on a touch screen only ('touch'), or on a
   * computer too ('both'), which then shows nothing.
   */
  saysItself?: 'touch' | 'both'
}

export const FIRST_MOVES: Record<string, FirstMove> = {
  // The turn, thrust and hyperspace buttons sit under the play area (beside it, held sideways): out of the finger's reach.
  asteroids: { touch: 'Turn and thrust with the buttons', keys: '← → to turn, ↑ to thrust', at: { x: '50%', y: '90%' } },
  // Under the wave's banner, over the cities.
  patriot: { touch: 'Tap the sky to fire', keys: 'Click the sky to fire', gesture: 'tap', at: { x: '50%', y: '52%' } },
  // Just over the card the snake draws at the foot of the board while it waits.
  snake: { touch: 'Swipe to turn', keys: 'Arrow keys to turn', gesture: 'swipe', at: { x: '50%', y: '64%' }, saysItself: 'both' },
  // On Blip, with the words over the rows behind him.
  crosswalk: { touch: 'Tap or swipe to hop', keys: 'Arrow keys to hop', gesture: 'tap', at: { x: '50%', y: '81%' } },
  // Down on the tower, clear of the top where the block has to line up.
  stacker: { touch: 'Tap to drop the block', keys: 'Space or click to drop the block', gesture: 'tap', at: { x: '50%', y: '82%' } },
  pop: { touch: 'Tap the bubbles to pop them', keys: 'Click the bubbles to pop them', gesture: 'tap' },
  pellets: { touch: 'Swipe to steer', keys: 'Arrow keys to steer', gesture: 'swipe' },
  // At the ship, near the foot of the field.
  barrage: { touch: 'Drag anywhere to fly', keys: 'Arrow keys or drag to fly', gesture: 'drag', at: { x: '50%', y: '74%' } },
  crumbtrail: { touch: 'Swipe to steer', keys: 'Arrow keys to steer', gesture: 'swipe' },
  frenzy: { touch: 'Hold anywhere and push to swim', keys: 'Mouse or arrow keys to swim', gesture: 'drag' },
  // A run opens on a tune the fireflies sing, so the words say to wait for it; up in the sky, off the pond they sing on.
  fireflies: {
    touch: 'Watch, then tap them back in order',
    keys: 'Watch, then click them back in order',
    gesture: 'tap',
    at: { x: '50%', y: '32%' },
  },
  // On the Gas pedal, bottom right (hotlap.css .hotlap__btn--gas: 74 by 100, 16px in and 20px up), and the words
  // under the start lights, where the eyes are during the countdown and clear of the speed at the foot.
  hotlap: {
    touch: 'Hold Gas to drive',
    keys: 'Arrow keys to drive',
    gesture: 'hold',
    at: { x: 'calc(100% - 53px)', y: 'calc(100% - 70px)' },
    wordsAt: '40%',
  },
  halffull: { touch: 'Drag up to pour', keys: '↑ to pour', gesture: 'drag', way: 'up', at: { x: '50%', y: '70%' }, saysItself: 'both' },
  // The racing dailies' coach sits at the foot of the screen: the finger goes just over it.
  marblerun: {
    touch: 'Drag anywhere to tilt',
    keys: 'Arrow keys to tilt',
    gesture: 'drag',
    at: { x: '50%', y: 'calc(100% - 7.5rem)' },
    saysItself: 'touch',
  },
  lander: {
    touch: 'Drag to fly',
    keys: 'Arrow keys to fly',
    gesture: 'drag',
    at: { x: '50%', y: 'calc(100% - 10rem)' },
    saysItself: 'touch',
  },
  pileup: { touch: 'Drag to move, tap to turn', keys: '← → to move, ↑ to turn', gesture: 'drag' },
  swoop: {
    touch: 'Hold anywhere to dive',
    keys: 'Hold Space to dive',
    gesture: 'hold',
    at: { x: '50%', y: 'calc(100% - 8.5rem)' },
    saysItself: 'both',
  },
  // Off to Blip's side, as it can be anywhere, so it doesn't cover him on his first peg; drawn back, the finger
  // comes down 52px from here and stays clear of the coach.
  sling: {
    touch: 'Drag back, let go to fling',
    keys: 'Drag back with the mouse, let go',
    gesture: 'pull',
    at: { x: '72%', y: 'calc(100% - 11.5rem)' },
    saysItself: 'both',
  },
}

export function firstMoveFor(slug: string): FirstMove | null {
  return FIRST_MOVES[slug] ?? null
}
