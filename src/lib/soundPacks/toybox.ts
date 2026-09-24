import { pentNote, type PlaySfx } from './types'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Wooden mallets, glass bells, felt thumps and a breath of air. */
export const playToybox: PlaySfx = (synth, name, pitch) => {
  const { osc, fm, noise, vary, spread } = synth
  const note = pentNote(pitch)

  switch (name) {
    case 'tap':
      fm(vary(1318.5, 0.01), 0.08, 0.12, { ratio: 4, index: 0.7, indexTime: 0.02 })
      noise(0.012, 0.035, { type: 'highpass', freq: 4200 })
      break
    case 'hit':
      fm(note * 2, 0.3, 0.2, { ratio: 4, index: 2.4, indexTime: 0.05, pan: spread(0.2) })
      noise(0.016, 0.05, { type: 'bandpass', freq: 3200, Q: 0.9 })
      break
    case 'boom':
      osc(vary(96, 0.05), 0.46, 0.45, { to: 36, slideTime: 0.38, attack: 0.004 })
      noise(0.75, 0.2, { type: 'lowpass', freq: 1500, to: 110, Q: 0.8, attack: 0.003, verb: 0.3 })
      noise(0.16, 0.06, { type: 'bandpass', freq: vary(2400, 0.1), Q: 1.4 })
      break
    case 'fire':
      osc(vary(1500, 0.025), 0.085, 0.088, { type: 'triangle', to: 640, attack: 0.002 })
      noise(0.025, 0.025, { type: 'highpass', freq: 5200 })
      break
    case 'eat':
      fm(659.3, 0.34, 0.14, { ratio: 5.4, index: 1.1, indexTime: 0.06 })
      fm(987.8, 0.42, 0.12, { ratio: 5.4, index: 1.1, indexTime: 0.06, delay: 0.065, verb: 0.15 })
      break
    case 'good':
      fm(784.0, 0.5, 0.12, { ratio: 3.5, index: 1.6, indexTime: 0.2, verb: 0.2 })
      fm(1174.7, 0.65, 0.1, { ratio: 3.5, index: 1.6, indexTime: 0.22, delay: 0.085, verb: 0.25 })
      break
    case 'perfect':
      ;[1046.5, 1318.5, 1568.0].forEach((f, k) =>
        fm(f, 0.6 + k * 0.1, 0.1, { ratio: 3.5, index: 1.4, indexTime: 0.2, delay: k * 0.06, verb: 0.3, pan: (k - 1) * 0.25 }),
      )
      noise(0.3, 0.018, { type: 'highpass', freq: 7000, delay: 0.1, verb: 0.5 })
      break
    case 'place':
      fm(vary(523.3, 0.012), 0.13, 0.15, { ratio: 1.41, index: 1.4, indexTime: 0.03 })
      osc(160, 0.13, 0.18, { to: 90, attack: 0.002 })
      noise(0.02, 0.05, { type: 'bandpass', freq: 1800, Q: 1 })
      break
    case 'miss':
      osc(392.0, 0.22, 0.1, { type: 'triangle', to: 262, slideTime: 0.2 })
      osc(196.0, 0.26, 0.09, { to: 131, slideTime: 0.24 })
      break
    case 'hurt':
      noise(0.14, 0.2, { type: 'lowpass', freq: 700, to: 200, attack: 0.002 })
      fm(233.1, 0.26, 0.12, { ratio: 4, index: 1.6, indexTime: 0.05 })
      fm(329.6, 0.24, 0.1, { ratio: 4, index: 1.6, indexTime: 0.05, delay: 0.012 })
      break
    case 'die':
      noise(0.18, 0.16, { type: 'lowpass', freq: 600, to: 150 })
      ;[392.0, 329.6, 261.6].forEach((f, k) =>
        fm(f, 0.55, 0.13, { ratio: 4, index: 1.6, indexTime: 0.05, delay: 0.08 + k * 0.17, verb: 0.2 }),
      )
      osc(130.8, 1.2, 0.12, { attack: 0.2, delay: 0.55, verb: 0.3 })
      break
    case 'wave':
      ;[523.3, 659.3, 784.0, 1046.5].forEach((f, k) =>
        fm(f, 0.5 + k * 0.12, 0.11, { ratio: 3.5, index: 1.3, indexTime: 0.18, delay: k * 0.075, verb: 0.28, pan: (k - 1.5) * 0.2 }),
      )
      break
    case 'whoosh':
      noise(0.3, 0.18, { type: 'bandpass', freq: 420, to: 2600, sweep: 0.2, Q: 1.3, attack: 0.1 })
      break
    case 'hop': {
      const f = 392.0 * Math.pow(2, clamp(Math.round(pitch), 0, 16) / 12)
      osc(f * 0.7, 0.07, 0.088, { to: f * 1.05, slideTime: 0.05, attack: 0.003 })
      fm(f, 0.12, 0.1, { ratio: 2, index: 1, indexTime: 0.04, delay: 0.015 })
      break
    }
    case 'pad': {
      const f = pentNote(pitch) * 2
      fm(f, 0.95, 0.15, { ratio: 1, index: 0.9, indexTime: 0.35, attack: 0.006, verb: 0.28 })
      osc(f * 4, 0.35, 0.014, { delay: 0.005 })
      break
    }
    case 'chop':
      noise(0.09, 0.2, { type: 'bandpass', freq: vary(950, 0.05), Q: 1.4 })
      fm(246.9, 0.2, 0.14, { ratio: 1.41, index: 2, indexTime: 0.04 })
      break
    case 'plink': {
      const f = 1760 * Math.pow(2, (clamp(pitch, 0, 8) * 2) / 12)
      osc(f, 0.045, 0.04, { type: 'triangle', to: f * 0.9 })
      noise(0.008, 0.02, { type: 'highpass', freq: 6500 })
      break
    }
    case 'boing': {
      // A spring let go: a note bending up with a wobble, and a twang over it.
      const k = pitch >= 1 ? 0.7 : 1
      osc(200, 0.34 * k, 0.15 * k, { to: 540, slideTime: 0.24 * k, vib: { rate: 17, depth: 22 } })
      osc(400, 0.16 * k, 0.035 * k, { type: 'triangle', to: 1080, delay: 0.02 })
      break
    }
    case 'ratchet': {
      // Teeth going past a pawl, climbing.
      const teeth = pitch >= 1 ? 3 : 5
      for (let k = 0; k < teeth; k++) {
        noise(0.02, 0.16, { type: 'bandpass', freq: 2200 + k * 260, Q: 5, delay: k * 0.045 })
        osc(1200 + k * 140, 0.025, 0.08, { type: 'triangle', delay: k * 0.045 })
      }
      break
    }
    case 'zip': {
      // A lever hauled down: air sliding from high to low.
      const k = pitch >= 1 ? 0.7 : 1
      noise(0.22 * k, 0.22 * k, { type: 'bandpass', freq: 3200, to: 600, Q: 3 })
      osc(1100, 0.2 * k, 0.09 * k, { type: 'triangle', to: 300 })
      break
    }
    case 'click': {
      // A switch snapping over: a tick and the knock under it.
      const k = pitch >= 1 ? 0.8 : 1
      noise(0.012, 0.14 * k, { type: 'highpass', freq: 2600 })
      osc(700, 0.06, 0.11 * k, { to: 380, delay: 0.01 })
      if (pitch < 1) noise(0.01, 0.1, { type: 'highpass', freq: 3000, delay: 0.1 })
      break
    }
    case 'whirr': {
      // A wheel spun: a fast trill of little mallets winding up.
      const notes = pitch >= 1 ? 5 : 8
      for (let k = 0; k < notes; k++) {
        fm(560 + k * 55 + (k % 2) * 120, 0.05, 0.07, { ratio: 2, index: 0.8, indexTime: 0.03, delay: k * 0.026 })
      }
      break
    }
  }
}
