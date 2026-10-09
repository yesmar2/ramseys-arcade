/**
 * A gauntlet's name, "Gummy Getaway": the prototype's two lists, one word from each. The plan keeps each day's
 * name (dailyPlan.ts), so changing these lists changes no planned day's.
 */
import type { Rng } from './types.ts'

export const ADJ = ['Jelly', 'Bouncy', 'Wobbly', 'Candy', 'Bubble', 'Fizzy', 'Gummy', 'Sprinkle', 'Marshmallow', 'Lollipop', 'Taffy', 'Sherbet', 'Noodle', 'Puffball'] as const
export const NOUN = ['Gauntlet', 'Dash', 'Canyon', 'Causeway', 'Rush', 'Run', 'Express', 'Speedway', 'Scramble', 'Shuffle', 'Getaway', 'Skedaddle'] as const

export function gauntletName(rng: Rng): string {
  return `${rng.pick(ADJ)} ${rng.pick(NOUN)}`
}
