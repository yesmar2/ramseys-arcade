import { pentNote, type PlaySfx } from './types'

/** Quieter, rounder envelopes — mellow. */
export const playSoft: PlaySfx = (synth, name, pitch) => {
  const { tone, chime } = synth
  const note = pentNote(pitch)

  switch (name) {
    case 'place':
      chime(294.0, 0.42, 0.07)
      break
    case 'perfect':
      chime(349.2, 0.48, 0.07)
      chime(440.0, 0.55, 0.055, 0.12)
      break
    case 'chop':
      tone(220.0, 0.55, 0.06, -35)
      break
    case 'eat':
      chime(311.1, 0.32, 0.065)
      chime(370.0, 0.4, 0.05, 0.08)
      break
    case 'fire':
      tone(466.2, 0.28, 0.04, -45)
      break
    case 'hit':
      chime(note * 0.9, 0.36, 0.06)
      break
    case 'boom':
      tone(98.0, 0.75, 0.08, -18)
      tone(146.8, 0.55, 0.04, 0, 0.04)
      break
    case 'hurt':
      tone(185.0, 0.55, 0.055, -28)
      break
    case 'die':
      tone(220.0, 0.5, 0.055)
      tone(174.6, 0.65, 0.05, 0, 0.16)
      tone(130.8, 0.9, 0.045, 0, 0.36)
      break
    case 'wave':
      chime(246.9, 0.4, 0.05)
      chime(311.1, 0.45, 0.055, 0.14)
      chime(370.0, 0.55, 0.06, 0.28)
      break
    case 'tap':
      tone(392.0, 0.28, 0.045)
      break
    case 'pad':
      chime(pentNote(pitch), 0.5, 0.07)
      break
    case 'good':
      chime(311.1, 0.4, 0.06)
      chime(415.3, 0.55, 0.055, 0.12)
      break
    case 'miss':
      tone(174.6, 0.5, 0.05, -16)
      break
    case 'hop': {
      const semis = Math.max(0, Math.min(16, Math.round(pitch)))
      const freq = 311.1 * Math.pow(2, semis / 12)
      tone(freq, 0.22, 0.05, freq * 0.1)
      break
    }
    case 'whoosh':
      tone(520.0, 0.28, 0.03, -220)
      break
  }
}
