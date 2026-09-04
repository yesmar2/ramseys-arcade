import { playArcade } from './arcade'
import { playClassic } from './classic'
import { playSoft } from './soft'
import type { PlaySfx } from './types'

export type SoundPackId = 'classic' | 'arcade' | 'soft'

export const SOUND_PACK_IDS: readonly SoundPackId[] = ['classic', 'arcade', 'soft']

export const SOUND_PACK_LABELS: Record<SoundPackId, string> = {
  classic: 'Classic',
  arcade: 'Arcade',
  soft: 'Soft',
}

export const SOUND_PACKS: Record<SoundPackId, PlaySfx> = {
  classic: playClassic,
  arcade: playArcade,
  soft: playSoft,
}

export function isSoundPackId(value: string): value is SoundPackId {
  return (SOUND_PACK_IDS as readonly string[]).includes(value)
}

export type { PlaySfx, SoundName, Synth } from './types'
export { createSynth, pentNote, PENT } from './types'
