/**
 * The voices the newer sound sets and the music are made of: tones with an
 * optional filter, glide, vibrato and unison; FM mallets and bells; filtered
 * noise for air, hits and explosions. Each starts at an absolute time, into a
 * destination, with optional sends to a shared room and echo.
 */

export type Fx = {
  /** A small dark room: a convolver. */
  verb: AudioNode
  /** A dampened echo a little over a quarter second long. */
  echo: AudioNode
}

export type FilterOptions = {
  type?: BiquadFilterType
  freq: number
  /** Swept to this frequency over `time` (the voice's length by default). */
  to?: number
  time?: number
  Q?: number
}

type Sends = {
  pan?: number
  verb?: number
  echo?: number
  /** Seconds after the sound was asked for; used by the sound sets. */
  delay?: number
}

export type ToneOptions = Sends & {
  type?: OscillatorType
  /** A pulse wave, 25% or 12.5%, in place of `type`. */
  wave?: 'pulse25' | 'pulse12'
  /** Glides to this frequency over `slideTime`. */
  to?: number
  slideTime?: number
  attack?: number
  /** Seconds held at full level before the fade. */
  hold?: number
  /** Two voices this many cents either side. */
  unison?: number
  vib?: { rate: number; depth: number; delay?: number }
  filter?: FilterOptions
}

export type FmOptions = Sends & {
  /** Modulator to carrier: 4 is a marimba, 3.5 a bell, 5.4 a kalimba. */
  ratio?: number
  index?: number
  /** How long the brightness takes to die away. */
  indexTime?: number
  attack?: number
  hold?: number
}

export type NoiseOptions = Sends & {
  type?: BiquadFilterType
  freq?: number
  to?: number
  sweep?: number
  Q?: number
  attack?: number
  hold?: number
}

export type Voices = {
  toneAt: (t: number, freq: number, dur: number, gain: number, o?: ToneOptions) => void
  fmAt: (t: number, freq: number, dur: number, gain: number, o?: FmOptions) => void
  noiseAt: (t: number, dur: number, gain: number, o?: NoiseOptions) => void
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>()

/** Two seconds of white noise, made once per context. */
export function noiseBuffer(audio: BaseAudioContext): AudioBuffer {
  let buf = noiseBuffers.get(audio)
  if (!buf) {
    buf = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    noiseBuffers.set(audio, buf)
  }
  return buf
}

const pulseWaves = new WeakMap<BaseAudioContext, Map<number, PeriodicWave>>()

function pulseWave(audio: BaseAudioContext, duty: number): PeriodicWave {
  let byDuty = pulseWaves.get(audio)
  if (!byDuty) pulseWaves.set(audio, (byDuty = new Map()))
  let wave = byDuty.get(duty)
  if (!wave) {
    const n = 48
    const re = new Float32Array(n)
    const im = new Float32Array(n)
    for (let k = 1; k < n; k++) {
      re[k] = Math.sin(2 * Math.PI * k * duty) / (k * Math.PI)
      im[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (k * Math.PI)
    }
    wave = audio.createPeriodicWave(re, im)
    byDuty.set(duty, wave)
  }
  return wave
}

/** A small dark room, made from decaying noise. */
export function roomImpulse(audio: BaseAudioContext, seconds = 2, decay = 3.2): AudioBuffer {
  const len = Math.floor(audio.sampleRate * seconds)
  const buf = audio.createBuffer(2, len, audio.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    let lp = 0
    for (let i = 0; i < len; i++) {
      lp = lp * 0.55 + (Math.random() * 2 - 1) * 0.45
      data[i] = lp * Math.pow(1 - i / len, decay)
    }
  }
  return buf
}

/** Voices into `dest`, every level scaled by `trim`. */
export function makeVoices(audio: BaseAudioContext, dest: AudioNode, fx: Fx | null, trim = 1): Voices {
  function out(node: AudioNode, o: Sends, t: number) {
    let last = node
    if (o.pan) {
      const p = audio.createStereoPanner()
      p.pan.setValueAtTime(clamp(o.pan, -1, 1), t)
      node.connect(p)
      last = p
    }
    last.connect(dest)
    if (fx && o.verb) {
      const send = audio.createGain()
      send.gain.value = o.verb
      last.connect(send)
      send.connect(fx.verb)
    }
    if (fx && o.echo) {
      const send = audio.createGain()
      send.gain.value = o.echo
      last.connect(send)
      send.connect(fx.echo)
    }
  }

  function envelope(param: AudioParam, t: number, peak: number, attack: number, dur: number, hold = 0) {
    const a = clamp(attack, 0.001, dur * 0.5)
    const h = clamp(hold, 0, Math.max(0, dur - a - 0.03))
    const top = Math.max(0.00011, peak)
    // Silent at rest too: a gain waits at 1 until its first event, and a voice
    // that starts between two samples would click through at full level.
    param.value = 0.0001
    param.setValueAtTime(0.0001, t)
    param.exponentialRampToValueAtTime(top, t + a)
    if (h > 0) param.setValueAtTime(top, t + a + h)
    param.exponentialRampToValueAtTime(0.0001, t + dur)
  }

  function toneAt(t: number, freq: number, dur: number, gain: number, o: ToneOptions = {}) {
    const voices = o.unison ? [-o.unison, o.unison] : [0]
    const g = audio.createGain()
    envelope(g.gain, t, (gain * trim) / Math.sqrt(voices.length), o.attack ?? Math.min(0.01, dur * 0.2), dur, o.hold ?? 0)
    let head: AudioNode = g
    if (o.filter) {
      const f = audio.createBiquadFilter()
      f.type = o.filter.type ?? 'lowpass'
      f.Q.value = o.filter.Q ?? 0.7
      f.frequency.setValueAtTime(o.filter.freq, t)
      if (o.filter.to) f.frequency.exponentialRampToValueAtTime(o.filter.to, t + (o.filter.time ?? dur))
      f.connect(g)
      head = f
    }
    for (const cents of voices) {
      const osc = audio.createOscillator()
      if (o.wave) osc.setPeriodicWave(pulseWave(audio, o.wave === 'pulse12' ? 0.125 : 0.25))
      else osc.type = o.type ?? 'sine'
      osc.frequency.setValueAtTime(freq, t)
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.slideTime ?? dur))
      if (cents) osc.detune.setValueAtTime(cents, t)
      if (o.vib) {
        const lfo = audio.createOscillator()
        lfo.frequency.setValueAtTime(o.vib.rate, t)
        const depth = audio.createGain()
        depth.gain.setValueAtTime(0, t)
        depth.gain.linearRampToValueAtTime(o.vib.depth, t + (o.vib.delay ?? 0) + 0.06)
        lfo.connect(depth)
        depth.connect(osc.frequency)
        lfo.start(t)
        lfo.stop(t + dur + 0.05)
      }
      osc.connect(head)
      osc.start(t)
      osc.stop(t + dur + 0.05)
    }
    out(g, o, t)
  }

  function fmAt(t: number, freq: number, dur: number, gain: number, o: FmOptions = {}) {
    const ratio = o.ratio ?? 4
    const depth = freq * ratio * (o.index ?? 2)
    const carrier = audio.createOscillator()
    carrier.frequency.setValueAtTime(freq, t)
    const mod = audio.createOscillator()
    mod.frequency.setValueAtTime(freq * ratio, t)
    const modDepth = audio.createGain()
    modDepth.gain.setValueAtTime(depth, t)
    modDepth.gain.exponentialRampToValueAtTime(Math.max(0.5, depth * 0.002), t + (o.indexTime ?? dur * 0.4))
    mod.connect(modDepth)
    modDepth.connect(carrier.frequency)
    const g = audio.createGain()
    envelope(g.gain, t, gain * trim, o.attack ?? 0.003, dur, o.hold ?? 0)
    carrier.connect(g)
    carrier.start(t)
    mod.start(t)
    carrier.stop(t + dur + 0.05)
    mod.stop(t + dur + 0.05)
    out(g, o, t)
  }

  function noiseAt(t: number, dur: number, gain: number, o: NoiseOptions = {}) {
    const src = audio.createBufferSource()
    src.buffer = noiseBuffer(audio)
    src.loop = true
    const f = audio.createBiquadFilter()
    f.type = o.type ?? 'bandpass'
    f.Q.value = o.Q ?? 1
    f.frequency.setValueAtTime(o.freq ?? 1000, t)
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + (o.sweep ?? dur))
    const g = audio.createGain()
    envelope(g.gain, t, gain * trim, o.attack ?? 0.002, dur, o.hold ?? 0)
    src.connect(f)
    f.connect(g)
    src.start(t, Math.random() * 1.8)
    src.stop(t + dur + 0.05)
    out(g, o, t)
  }

  return { toneAt, fmAt, noiseAt }
}
