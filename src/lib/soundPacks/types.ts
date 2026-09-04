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
}

export type PlaySfx = (synth: Synth, name: SoundName, pitch: number) => void

export function createSynth(audio: AudioContext, master: GainNode): Synth {
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

  return { audio, master, tone, chime }
}

export function pentNote(pitch: number) {
  return PENT[Math.max(0, Math.min(PENT.length - 1, Math.round(pitch)))]
}
