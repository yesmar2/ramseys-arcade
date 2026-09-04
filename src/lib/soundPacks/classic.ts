import { pentNote, type PlaySfx } from './types'

/** Original sine/chime arcade SFX. */
export const playClassic: PlaySfx = (synth, name, pitch) => {
  const { tone, chime } = synth
  const note = pentNote(pitch)

  switch (name) {
    case 'place':
      chime(329.6, 0.28, 0.11)
      break
    case 'perfect':
      chime(392.0, 0.32, 0.11)
      chime(523.3, 0.42, 0.1, 0.09)
      break
    case 'chop':
      tone(246.9, 0.42, 0.1, -70)
      break
    case 'eat':
      chime(329.6, 0.22, 0.1)
      chime(392.0, 0.3, 0.08, 0.05)
      break
    case 'fire':
      tone(523.3, 0.16, 0.06, -80)
      break
    case 'hit':
      chime(note, 0.24, 0.09)
      break
    case 'boom':
      tone(130.8, 0.55, 0.12, -30)
      tone(196.0, 0.4, 0.06)
      break
    case 'hurt':
      tone(220.0, 0.4, 0.09, -50)
      break
    case 'die':
      tone(246.9, 0.35, 0.09)
      tone(196.0, 0.5, 0.08, 0, 0.12)
      tone(146.8, 0.7, 0.07, 0, 0.28)
      break
    case 'wave':
      chime(261.6, 0.28, 0.08)
      chime(329.6, 0.32, 0.09, 0.12)
      chime(392.0, 0.45, 0.1, 0.24)
      break
    case 'tap':
      tone(440.0, 0.18, 0.07)
      break
    case 'pad':
      chime(pentNote(pitch), 0.36, 0.12)
      break
    case 'good':
      chime(329.6, 0.28, 0.1)
      chime(493.9, 0.4, 0.09, 0.08)
      break
    case 'miss':
      tone(196.0, 0.38, 0.08, -28)
      break
    case 'hop': {
      const semis = Math.max(0, Math.min(16, Math.round(pitch)))
      const freq = 349.2 * Math.pow(2, semis / 12)
      tone(freq, 0.13, 0.075, freq * 0.16)
      break
    }
    case 'whoosh':
      tone(640.0, 0.16, 0.05, -420)
      break
  }
}
