/*
 * The arcade's music is played on a Game Boy, more or less: two square waves (pulse 1 and 2), a 4-bit wave
 * channel for the bass, and a noise channel for the drums. Each plays one note at a time, so a chord is a
 * fast arpeggio, and every volume and pitch moves in steps of a sixtieth of a second, the way the console
 * counted. Ramsey picked the Game Boy sound and these songs in the Chip Lab (2026-10-05); the songs are in
 * musicTracks.ts.
 */

const FRAME = 1 / 60

export type Duty = 0.125 | 0.25 | 0.5

export type NoteOpts = {
  /** 0..15, the chip's own volume steps. */
  vol?: number
  /** Frames per step down in volume; 0 holds it. */
  decay?: number
  /** The volume a decay stops at. */
  floor?: number
  /** Up and back down over the note, for wind and water. */
  swell?: boolean
  /** Frames on and off, for a trill like a cricket's. */
  gate?: number
  duty?: Duty
  /** Semitones above the note, cycled a frame each: a chord on one channel. */
  arp?: number[]
  vib?: { delay: number; depth: number; rate: number }
}

export type NoiseOpts = NoteOpts & {
  /** How fast the noise is clocked: low is a thump, high a hiss. */
  rate?: number
  /** The short loop, which rings like metal. */
  short?: boolean
}

type ChannelId = 'p1' | 'p2' | 'wave' | 'noise'
type Sounding = { src: AudioScheduledSourceNode; g: GainNode; end: number }

type Parts = {
  pulse: Record<Duty, PeriodicWave>
  wave: PeriodicWave
  longNoise: AudioBuffer
  shortNoise: AudioBuffer
}

const partsFor = new WeakMap<BaseAudioContext, Parts>()

/** A waveform from one period of it, as the harmonics a PeriodicWave wants. */
function fourier(audio: BaseAudioContext, fn: (x: number) => number, harmonics = 64): PeriodicWave {
  const N = 2048
  const real = new Float32Array(harmonics + 1)
  const imag = new Float32Array(harmonics + 1)
  for (let n = 1; n <= harmonics; n++) {
    let a = 0
    let b = 0
    for (let k = 0; k < N; k++) {
      const x = k / N
      const s = fn(x)
      a += s * Math.cos(2 * Math.PI * n * x)
      b += s * Math.sin(2 * Math.PI * n * x)
    }
    real[n] = (2 * a) / N
    imag[n] = (2 * b) / N
  }
  return audio.createPeriodicWave(real, imag)
}

/** The noise channel's shift register: 15 bits, or 7 for the short, metallic loop. */
function lfsr(short: boolean, length: number): Float32Array<ArrayBuffer> {
  let reg = 1
  const out = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const bit = (reg ^ (reg >> (short ? 6 : 1))) & 1
    reg = (reg >> 1) | (bit << 14)
    out[i] = reg & 1 ? 1 : -1
  }
  return out
}

function parts(audio: BaseAudioContext): Parts {
  let p = partsFor.get(audio)
  if (p) return p
  const square = (d: number) => fourier(audio, (x) => (x < d ? 1 : -1))
  // The wave channel: 32 samples of 4 bits, a rounded square that Game Boy bass lines lived on.
  const samples = '02468ACEFFFFFFFFFFFFFFECA8642000'.split('').map((c) => parseInt(c, 16))
  const buffer = (data: Float32Array<ArrayBuffer>) => {
    const b = audio.createBuffer(1, data.length, audio.sampleRate)
    b.copyToChannel(data, 0)
    return b
  }
  p = {
    pulse: { 0.125: square(0.125), 0.25: square(0.25), 0.5: square(0.5) },
    wave: fourier(audio, (x) => samples[Math.floor(x * 32)]! / 7.5 - 1),
    longNoise: buffer(lfsr(false, 32767)),
    shortNoise: buffer(lfsr(true, 93 * 64)),
  }
  partsFor.set(audio, p)
  return p
}

/** The volume a frame plays at, 0..15. */
function volAt(o: NoteOpts, k: number, frames: number) {
  const vol = o.vol ?? 12
  let v = vol
  if (o.swell) {
    const half = frames / 2
    v = Math.round(vol * (k < half ? k / half : (frames - k) / half))
  } else if (o.decay) {
    v = Math.max(o.floor ?? 0, vol - Math.floor(k / o.decay))
  }
  if (o.gate && Math.floor(k / o.gate) % 2 === 1) v = 0
  return Math.max(0, Math.min(15, v))
}

function envelope(g: GainNode, t: number, o: NoteOpts, frames: number) {
  // Set before scheduling: a gain rests at 1 until its first event, and would click.
  g.gain.value = 0.0001
  g.gain.setValueAtTime(0, Math.max(0, t - 0.001))
  let last = -1
  for (let k = 0; k < frames; k++) {
    const v = volAt(o, k, frames)
    if (v !== last) {
      g.gain.setValueAtTime(v / 15, t + k * FRAME)
      last = v
    }
  }
  g.gain.setValueAtTime(0, t + frames * FRAME)
}

export type Chip = ReturnType<typeof makeChip>

/** A Game Boy's four channels, into `dest`. */
export function makeChip(audio: BaseAudioContext, dest: AudioNode) {
  const P = parts(audio)
  // The little speaker: no deep bass, the very top rounded off.
  const hp = audio.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 140
  const lp = audio.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 7000
  lp.Q.value = 0.5
  hp.connect(lp)
  lp.connect(dest)
  const level: Record<ChannelId, number> = { p1: 0.105, p2: 0.105, wave: 0.14, noise: 0.07 }
  const channels = {} as Record<ChannelId, { bus: GainNode; cur: Sounding | null }>
  for (const id of ['p1', 'p2', 'wave', 'noise'] as const) {
    const bus = audio.createGain()
    bus.gain.value = level[id]
    bus.connect(hp)
    channels[id] = { bus, cur: null }
  }

  /** One note at a time: a new one cuts the last. */
  const cut = (id: ChannelId, t: number) => {
    const cur = channels[id].cur
    if (!cur || cur.end <= t) return
    cur.g.gain.cancelScheduledValues(t)
    cur.g.gain.setValueAtTime(0, t)
    try {
      cur.src.stop(t + 0.005)
    } catch {
      /* already stopping */
    }
  }

  const play = (id: 'p1' | 'p2' | 'wave', t: number, f: number, dur: number, o: NoteOpts = {}) => {
    if (!f) return
    cut(id, t)
    const osc = audio.createOscillator()
    osc.setPeriodicWave(id === 'wave' ? P.wave : P.pulse[o.duty ?? 0.5])
    const g = audio.createGain()
    const frames = Math.max(1, Math.round(dur / FRAME))
    // The wave channel has four volumes, not sixteen: full, half, a quarter and off.
    const vol = o.vol ?? 15
    envelope(g, t, id === 'wave' ? { ...o, vol: vol >= 11 ? 15 : vol >= 6 ? 8 : 4, decay: 0 } : o, frames)
    let lastF = -1
    for (let k = 0; k < frames; k++) {
      let fk = f
      if (o.arp) fk *= Math.pow(2, o.arp[k % o.arp.length]! / 12)
      if (o.vib && k >= o.vib.delay) {
        fk *= Math.pow(2, (o.vib.depth * Math.sin(2 * Math.PI * o.vib.rate * (k - o.vib.delay) * FRAME)) / 12)
      }
      if (Math.abs(fk - lastF) > 0.01) {
        osc.frequency.setValueAtTime(fk, t + k * FRAME)
        lastF = fk
      }
    }
    osc.connect(g)
    g.connect(channels[id].bus)
    const end = t + frames * FRAME
    osc.start(t)
    osc.stop(end + 0.02)
    channels[id].cur = { src: osc, g, end }
  }

  const noise = (t: number, dur: number, o: NoiseOpts = {}) => {
    cut('noise', t)
    const src = audio.createBufferSource()
    src.buffer = o.short ? P.shortNoise : P.longNoise
    src.loop = true
    src.playbackRate.value = o.rate ?? 0.5
    const g = audio.createGain()
    const frames = Math.max(1, Math.round(dur / FRAME))
    envelope(g, t, o, frames)
    src.connect(g)
    g.connect(channels.noise.bus)
    const end = t + frames * FRAME
    src.start(t, Math.random() * 0.1)
    src.stop(end + 0.02)
    channels.noise.cur = { src, g, end }
  }

  return {
    play,
    noise,
    kick: (t: number, v = 15) => noise(t, 0.11, { rate: 0.07, vol: v, decay: 1 }),
    snare: (t: number, v = 12) => noise(t, 0.13, { rate: 0.55, vol: v, decay: 1 }),
    hat: (t: number, v = 5, open = false) => noise(t, open ? 0.16 : 0.04, { rate: 1, vol: v, decay: open ? 2 : 1 }),
    /** Silence every channel from `t`. */
    hush(t: number) {
      for (const id of ['p1', 'p2', 'wave', 'noise'] as const) cut(id, t)
    },
  }
}
