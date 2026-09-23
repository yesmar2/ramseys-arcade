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
    case 'boing': {
      const k = pitch >= 1 ? 0.7 : 1
      tone(174.6, 0.36 * k, 0.07 * k, 230)
      tone(349.2, 0.2 * k, 0.03 * k, 180, 0.03)
      break
    }
    case 'ratchet': {
      const teeth = pitch >= 1 ? 3 : 5
      for (let i = 0; i < teeth; i++) tone(700 + i * 75, 0.05, 0.045, 0, i * 0.055, 'triangle')
      break
    }
    case 'zip': {
      const k = pitch >= 1 ? 0.7 : 1
      tone(820.0, 0.27 * k, 0.05 * k, -560, 0, 'triangle')
      break
    }
    case 'click':
      tone(1300.0, 0.045, 0.06, 0, 0, 'triangle')
      tone(650.0, 0.08, 0.035, -260, 0.02)
      if (pitch < 1) tone(1100.0, 0.04, 0.035, 0, 0.11, 'triangle')
      break
    case 'plink': {
      const freq = 659.3 * Math.pow(2, (Math.max(0, Math.min(8, pitch)) * 2) / 12)
      tone(freq, 0.07, 0.028, -freq * 0.15)
      break
    }
    case 'whirr': {
      const notes = pitch >= 1 ? 5 : 7
      for (let i = 0; i < notes; i++) tone(392 + i * 33 + (i % 2) * 70, 0.07, 0.04, 0, i * 0.035)
      break
    }
  }
}
