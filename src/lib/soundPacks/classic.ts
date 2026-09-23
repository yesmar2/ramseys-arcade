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
    case 'boing': {
      // A spring let go: a low note bending up, with a twang over it.
      const k = pitch >= 1 ? 0.7 : 1
      tone(196.0, 0.28 * k, 0.13 * k, 330)
      tone(392.0, 0.16 * k, 0.05 * k, 260, 0.03, 'triangle')
      break
    }
    case 'ratchet': {
      // Teeth going past a pawl, climbing.
      const teeth = pitch >= 1 ? 3 : 5
      for (let i = 0; i < teeth; i++) tone(880 + i * 120, 0.035, 0.075, 0, i * 0.045, 'triangle')
      break
    }
    case 'zip': {
      // A lever hauled down: a quick slide from high to low.
      const k = pitch >= 1 ? 0.7 : 1
      tone(1050.0, 0.21 * k, 0.09 * k, -780, 0, 'triangle')
      tone(525.0, 0.18 * k, 0.03 * k, -380, 0.01)
      break
    }
    case 'click': {
      // A switch snapping over: a tick and the knock under it.
      const k = pitch >= 1 ? 0.8 : 1
      tone(1850.0, 0.03, 0.1 * k, 0, 0, 'square')
      tone(880.0, 0.07, 0.07 * k, -420, 0.018)
      if (pitch < 1) tone(1500.0, 0.025, 0.05, 0, 0.1, 'square')
      break
    }
    case 'plink': {
      // A bright tick with a quick fall, climbing a whole tone a step.
      const freq = 880 * Math.pow(2, (Math.max(0, Math.min(8, pitch)) * 2) / 12)
      tone(freq, 0.05, 0.04, -freq * 0.25, 0, 'triangle')
      break
    }
    case 'whirr': {
      // A wheel spun: a fast trill winding up.
      const notes = pitch >= 1 ? 5 : 8
      for (let i = 0; i < notes; i++) tone(440 + i * 45 + (i % 2) * 110, 0.05, 0.06, 0, i * 0.028)
      break
    }
  }
}
