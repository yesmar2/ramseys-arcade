import { pentNote, type PlaySfx } from './types'

/** Brighter square/triangle beeps — 8-bit-ish. */
export const playArcade: PlaySfx = (synth, name, pitch) => {
  const { tone, chime } = synth
  const note = pentNote(pitch)
  const sq: OscillatorType = 'square'
  const tri: OscillatorType = 'triangle'

  switch (name) {
    case 'place':
      tone(392.0, 0.1, 0.07, 0, 0, sq)
      tone(523.3, 0.12, 0.05, 0, 0.04, sq)
      break
    case 'perfect':
      tone(523.3, 0.09, 0.08, 0, 0, sq)
      tone(659.3, 0.11, 0.07, 0, 0.06, sq)
      tone(784.0, 0.14, 0.06, 0, 0.12, sq)
      break
    case 'chop':
      tone(180.0, 0.18, 0.1, -90, 0, sq)
      break
    case 'eat':
      tone(440.0, 0.08, 0.07, 60, 0, sq)
      tone(554.4, 0.1, 0.05, 0, 0.05, sq)
      break
    case 'fire':
      tone(880.0, 0.07, 0.055, -280, 0, sq)
      break
    case 'hit':
      tone(note * 1.5, 0.08, 0.08, 0, 0, sq)
      tone(note, 0.1, 0.05, 0, 0.03, tri)
      break
    case 'boom':
      tone(90.0, 0.28, 0.14, -40, 0, sq)
      tone(140.0, 0.18, 0.07, 0, 0.02, tri)
      break
    case 'hurt':
      tone(200.0, 0.16, 0.1, -80, 0, sq)
      tone(160.0, 0.2, 0.06, 0, 0.06, sq)
      break
    case 'die':
      tone(330.0, 0.12, 0.09, 0, 0, sq)
      tone(220.0, 0.16, 0.08, 0, 0.08, sq)
      tone(140.0, 0.28, 0.07, -30, 0.18, sq)
      break
    case 'wave':
      tone(262.0, 0.1, 0.07, 0, 0, sq)
      tone(330.0, 0.1, 0.07, 0, 0.08, sq)
      tone(392.0, 0.12, 0.08, 0, 0.16, sq)
      break
    case 'tap':
      tone(660.0, 0.06, 0.06, 0, 0, sq)
      break
    case 'pad':
      chime(pentNote(pitch), 0.22, 0.1, 0, sq)
      break
    case 'good':
      tone(392.0, 0.09, 0.08, 0, 0, sq)
      tone(523.3, 0.12, 0.07, 0, 0.07, sq)
      break
    case 'miss':
      tone(165.0, 0.2, 0.08, -50, 0, sq)
      break
    case 'hop': {
      const semis = Math.max(0, Math.min(16, Math.round(pitch)))
      const freq = 392.0 * Math.pow(2, semis / 12)
      tone(freq, 0.08, 0.07, freq * 0.22, 0, sq)
      break
    }
    case 'whoosh':
      tone(920.0, 0.1, 0.045, -520, 0, tri)
      break
    case 'boing': {
      const k = pitch >= 1 ? 0.7 : 1
      tone(150.0, 0.22 * k, 0.08 * k, 330, 0, sq)
      tone(300.0, 0.13 * k, 0.04 * k, 300, 0.03, tri)
      break
    }
    case 'ratchet': {
      const teeth = pitch >= 1 ? 3 : 5
      for (let i = 0; i < teeth; i++) tone(700 + i * 95, 0.025, 0.06, 0, i * 0.04, sq)
      break
    }
    case 'zip': {
      const k = pitch >= 1 ? 0.7 : 1
      tone(1200.0, 0.17 * k, 0.05 * k, -900, 0, 'sawtooth')
      break
    }
    case 'click':
      tone(2200.0, 0.022, 0.08, 0, 0, sq)
      tone(620.0, 0.045, 0.05, 0, 0.012, tri)
      if (pitch < 1) tone(1800.0, 0.02, 0.05, 0, 0.09, sq)
      break
    case 'whirr': {
      const notes = pitch >= 1 ? 5 : 8
      for (let i = 0; i < notes; i++) tone(500 + i * 50 + (i % 2) * 100, 0.04, 0.05, 0, i * 0.025, sq)
      break
    }
  }
}
