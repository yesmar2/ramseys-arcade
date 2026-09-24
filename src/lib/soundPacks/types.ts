import { makeVoices, type FmOptions, type Fx, type NoiseOptions, type ToneOptions } from './voices'

export type SoundName =
  | 'place'
  | 'perfect'
  | 'chop'
  | 'eat'
  | 'fire'
  | 'hit'
  | 'boom'
  | 'hurt'
  | 'die'
  | 'wave'
  | 'tap'
  | 'pad'
  | 'good'
  | 'miss'
  | 'hop'
  | 'whoosh'
  /*
   * Five sounds you can tell apart with your eyes shut, one to each of Bop's
   * controls: a spring, a ratchet, a zip, a switch and a wheel. Pitch 0 is
   * the full sound, for the toy calling a control; 1 a shorter one, for doing it.
   */
  | 'boing'
  | 'ratchet'
  | 'zip'
  | 'click'
  | 'whirr'
  /*
   * A round landing on something that doesn't break yet: short and quiet,
   * because it comes many times a second, and higher the nearer the thing is
   * to breaking — pitch 0 for a first hit, up to 8 for the last before it goes.
   */
  | 'plink'

export const PENT = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3] as const

export type Synth = {
  audio: AudioContext
  master: GainNode
  tone: (
    freq: number,
    dur: number,
    gain?: number,
    slide?: number,
    delay?: number,
    type?: OscillatorType,
  ) => void
  chime: (
    freq: number,
    dur: number,
    gain?: number,
    delay?: number,
    type?: OscillatorType,
  ) => void
  /*
   * The richer voices Neon and Toybox are made of, all timed from the moment
   * the sound was asked for (see voices.ts).
   */
  osc: (freq: number, dur: number, gain: number, o?: ToneOptions) => void
  fm: (freq: number, dur: number, gain: number, o?: FmOptions) => void
  noise: (dur: number, gain: number, o?: NoiseOptions) => void
  /** Nudged by up to ±amt, so a sound heard many times running isn't a machine gun. */
  vary: (x: number, amt?: number) => number
  /** A pan somewhere within ±width. */
  spread: (width: number) => number
}

export type PlaySfx = (synth: Synth, name: SoundName, pitch: number) => void

/**
 * One sound's voices, into `master`. `fx` is the shared room and echo, and
 * `trim` scales the richer voices so each set plays as loud as the others.
 */
export function createSynth(audio: AudioContext, master: GainNode, fx: Fx | null = null, trim = 1): Synth {
  const tone = (
    freq: number,
    dur: number,
    gain = 0.14,
    slide = 0,
    delay = 0,
    type: OscillatorType = 'sine',
  ) => {
    const t = audio.currentTime + delay
    const attack = Math.min(0.04, dur * 0.22)
    const osc = audio.createOscillator()
    const g = audio.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (slide) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(60, freq + slide), t + dur)
    }
    // Silent before its start, not at the default of 1, or a late voice clicks.
    g.gain.value = 0.0001
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g)
    g.connect(master)
    osc.start(t)
    osc.stop(t + dur + 0.04)
  }

  const chime = (
    freq: number,
    dur: number,
    gain = 0.12,
    delay = 0,
    type: OscillatorType = 'sine',
  ) => {
    tone(freq, dur, gain, 0, delay, type)
    tone(freq * 2, dur * 0.85, gain * 0.18, 0, delay, type)
  }

  const voices = makeVoices(audio, master, fx, trim)
  const base = audio.currentTime + 0.005

  return {
    audio,
    master,
    tone,
    chime,
    osc: (freq, dur, gain, o = {}) => voices.toneAt(base + (o.delay ?? 0), freq, dur, gain, o),
    fm: (freq, dur, gain, o = {}) => voices.fmAt(base + (o.delay ?? 0), freq, dur, gain, o),
    noise: (dur, gain, o = {}) => voices.noiseAt(base + (o.delay ?? 0), dur, gain, o),
    vary: (x, amt = 0.015) => x * (1 + (Math.random() * 2 - 1) * amt),
    spread: (width) => (Math.random() * 2 - 1) * width,
  }
}

export function pentNote(pitch: number) {
  return PENT[Math.max(0, Math.min(PENT.length - 1, Math.round(pitch)))]
}
