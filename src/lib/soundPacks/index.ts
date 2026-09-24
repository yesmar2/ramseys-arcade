import { playClassic } from './classic'
import { playNeon } from './neon'
import { playToybox } from './toybox'
import type { PlaySfx } from './types'

export type SoundPackId = 'neon' | 'toybox' | 'classic'

/** In the order the pickers offer them; the first is everyone's default. */
export const SOUND_PACK_IDS: readonly SoundPackId[] = ['neon', 'toybox', 'classic']

export const DEFAULT_SOUND_PACK: SoundPackId = 'neon'

export const SOUND_PACK_LABELS: Record<SoundPackId, string> = {
  neon: 'Neon',
  toybox: 'Toybox',
  classic: 'Classic',
}

export const SOUND_PACKS: Record<SoundPackId, PlaySfx> = {
  neon: playNeon,
  toybox: playToybox,
  classic: playClassic,
}

/**
 * How loud each set's voices are scaled, measured so every set's middle sound
 * lands at the same level and switching sets never needs the volume touched.
 * Classic's lift is on its own path in sound.ts, behind the filter it always had.
 */
export const PACK_TRIM: Record<SoundPackId, number> = {
  neon: 2.85,
  toybox: 1.88,
  classic: 1,
}

export function isSoundPackId(value: string): value is SoundPackId {
  return (SOUND_PACK_IDS as readonly string[]).includes(value)
}

export type { PlaySfx, SoundName, Synth } from './types'
export { createSynth, pentNote, PENT } from './types'
