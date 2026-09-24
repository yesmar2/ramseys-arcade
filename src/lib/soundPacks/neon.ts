import { pentNote, type PlaySfx } from './types'
import type { FilterOptions } from './voices'

const lowpass = (freq: number, to?: number): FilterOptions => ({ type: 'lowpass', freq, to })
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Punchy arcade synths: square and saw through filters, noise for hits, a little echo. */
export const playNeon: PlaySfx = (synth, name, pitch) => {
  const { osc, noise, vary, spread } = synth
  const note = pentNote(pitch)

  switch (name) {
    case 'tap':
      osc(vary(1318.5, 0.01), 0.045, 0.07, { type: 'square', attack: 0.001, filter: lowpass(3800) })
      break
    case 'hit': {
      const f = note * 2
      osc(f * 1.5, 0.1, 0.12, { type: 'square', to: f, slideTime: 0.025, attack: 0.001, filter: lowpass(3200, 1200), echo: 0.2, pan: spread(0.25) })
      noise(0.03, 0.06, { type: 'highpass', freq: 2600 })
      break
    }
    case 'boom':
      noise(0.62, 0.095, { type: 'lowpass', freq: 3800, to: 140, Q: 1.1, attack: 0.002, echo: 0.1 })
      osc(vary(120, 0.05), 0.42, 0.22, { to: 38, slideTime: 0.34, attack: 0.003 })
      osc(62, 0.28, 0.035, { type: 'square', filter: lowpass(320) })
      break
    case 'fire':
      osc(vary(1800, 0.03), 0.13, 0.053, { type: 'sawtooth', unison: 12, to: 380, attack: 0.002, filter: lowpass(6000, 1400), echo: 0.12 })
      break
    case 'eat':
      osc(987.8, 0.07, 0.04, { type: 'square', attack: 0.001, filter: lowpass(5000) })
      osc(1318.5, 0.3, 0.04, { type: 'square', attack: 0.001, hold: 0.06, delay: 0.065, filter: lowpass(5000), echo: 0.18 })
      break
    case 'good':
      osc(784.0, 0.09, 0.07, { type: 'square', attack: 0.001, filter: lowpass(4500) })
      osc(1174.7, 0.24, 0.07, { type: 'square', attack: 0.001, delay: 0.075, filter: lowpass(4500), echo: 0.22 })
      break
    case 'perfect':
      ;[1046.5, 1318.5, 1568.0, 2093.0].forEach((f, k) =>
        osc(f, k === 3 ? 0.3 : 0.1, 0.082, { type: 'square', attack: 0.001, delay: k * 0.048, filter: lowpass(5200), echo: 0.25, pan: (k - 1.5) * 0.2 }),
      )
      break
    case 'place':
      osc(vary(392.0, 0.015), 0.09, 0.11, { type: 'square', to: 196, slideTime: 0.07, attack: 0.001, filter: lowpass(1800) })
      noise(0.03, 0.07, { type: 'bandpass', freq: 1500, Q: 1 })
      break
    case 'miss':
      osc(311.1, 0.24, 0.08, { type: 'square', to: 156, attack: 0.002, filter: lowpass(1400), vib: { rate: 28, depth: 10 } })
      break
    case 'hurt':
      noise(0.13, 0.2, { type: 'bandpass', freq: 900, Q: 1 })
      osc(180, 0.22, 0.14, { type: 'sawtooth', to: 110, filter: lowpass(900), vib: { rate: 40, depth: 22 } })
      break
    case 'die':
      ;[392.0, 311.1, 261.6, 196.0].forEach((f, k) =>
        osc(f, k === 3 ? 0.55 : 0.12, 0.05, { type: 'square', attack: 0.002, hold: k === 3 ? 0.15 : 0.04, delay: k * 0.11, filter: lowpass(2200), echo: 0.2 }),
      )
      noise(0.5, 0.05, { type: 'lowpass', freq: 1200, to: 180, delay: 0.33 })
      break
    case 'wave':
      ;[523.3, 659.3, 784.0, 1046.5, 1318.5].forEach((f, k) =>
        osc(f, k === 4 ? 0.36 : 0.11, 0.065, { type: 'square', attack: 0.001, delay: k * 0.055, filter: lowpass(5000), echo: 0.3 }),
      )
      osc(523.3, 0.5, 0.04, { type: 'sawtooth', unison: 10, attack: 0.03, delay: 0.22, filter: lowpass(2000) })
      osc(784.0, 0.5, 0.035, { type: 'sawtooth', unison: 10, attack: 0.03, delay: 0.22, filter: lowpass(2000) })
      break
    case 'whoosh':
      noise(0.2, 0.11, { type: 'bandpass', freq: 3600, to: 480, Q: 2.2, attack: 0.02 })
      break
    case 'hop': {
      const f = 392.0 * Math.pow(2, clamp(Math.round(pitch), 0, 16) / 12)
      osc(f, 0.085, 0.07, { type: 'square', to: f * 1.4, slideTime: 0.07, attack: 0.001, filter: lowpass(4200) })
      break
    }
    case 'pad': {
      const f = pentNote(pitch) * 2
      osc(f, 0.46, 0.08, { wave: 'pulse25', unison: 6, attack: 0.004, hold: 0.12, filter: lowpass(2800, 1200), echo: 0.28 })
      break
    }
    case 'chop':
      noise(0.07, 0.13, { type: 'bandpass', freq: 1200, Q: 2 })
      osc(200, 0.14, 0.1, { type: 'square', to: 90, filter: lowpass(800) })
      break
    case 'plink': {
      const f = 2093 * Math.pow(2, (clamp(pitch, 0, 8) * 2) / 12)
      osc(f, 0.03, 0.032, { type: 'square', attack: 0.001, filter: lowpass(7000) })
      break
    }
    case 'boing': {
      const k = pitch >= 1 ? 0.7 : 1
      osc(160, 0.28 * k, 0.09 * k, { type: 'square', to: 480, slideTime: 0.22 * k, filter: lowpass(1500), vib: { rate: 22, depth: 16 } })
      break
    }
    case 'ratchet': {
      const teeth = pitch >= 1 ? 3 : 5
      for (let k = 0; k < teeth; k++) {
        osc(700 + k * 95, 0.026, 0.055, { type: 'square', attack: 0.001, delay: k * 0.04 })
        noise(0.012, 0.05, { type: 'highpass', freq: 3500, delay: k * 0.04 })
      }
      break
    }
    case 'zip': {
      const k = pitch >= 1 ? 0.7 : 1
      osc(1400, 0.18 * k, 0.078 * k, { type: 'sawtooth', to: 250, attack: 0.002, filter: lowpass(5000, 800) })
      break
    }
    case 'click':
      osc(2400, 0.022, 0.075, { type: 'square', attack: 0.001 })
      osc(620, 0.045, 0.055, { type: 'triangle', delay: 0.012 })
      if (pitch < 1) osc(1900, 0.02, 0.05, { type: 'square', attack: 0.001, delay: 0.09 })
      break
    case 'whirr': {
      const notes = pitch >= 1 ? 5 : 8
      for (let k = 0; k < notes; k++) {
        osc(500 + k * 50 + (k % 2) * 100, 0.036, 0.05, { type: 'square', attack: 0.001, delay: k * 0.025, filter: lowpass(4000) })
      }
      break
    }
  }
}
