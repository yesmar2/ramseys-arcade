/*
 * The band behind the newer songs: drums, basses, pads, plucks, leads, an electric piano, bells, a nylon
 * guitar and a piano, all made from oscillators and noise as each note plays. Every song gets its own
 * mixer (makeKitBus): the music through a pump that ducks on the kick, a reverb and an echo on sends, and
 * a limiter. Ramsey heard these in the Music Lab (2026-10-08 and 10-15) and chose a song picker with
 * stations (the "Song picker" canvas, A); the songs are in kitSongs.ts, the Game Boy ones in chip.ts.
 *
 * Notes are MIDI numbers: 60 is middle C.
 */

export type Note = number
/** A note in a bar: the step it starts on, the note, and how many steps it lasts. */
export type BarNote = readonly [step: number, note: Note, steps: number]

const NOTE_OF: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** 'A4', 'C#5', 'Bb3' as a MIDI number. */
export function midi(name: string): Note {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name)
  if (!m) throw new Error(`Not a note: ${name}`)
  return 12 * (Number(m[3]) + 1) + NOTE_OF[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
}

/** 'C4 E4 G4' as notes. */
export const notes = (s: string): Note[] => s.split(' ').map(midi)

/** A bar of tune from 'step:note:steps' words, '' for a bar of rest. */
export function bar(s: string): BarNote[] {
  if (!s) return []
  return s.split(' ').map((w) => {
    const [st, n, l] = w.split(':')
    return [Number(st), midi(n!), Number(l)] as const
  })
}

export const hz = (n: Note) => 440 * Math.pow(2, (n - 69) / 12)

/** The notes of a bar that start on this step. */
export const startingAt = (list: readonly BarNote[], s: number) => list.filter((x) => x[0] === s)

/* ---------- the parts every instrument is made of ---------- */

const noiseBufs = new WeakMap<BaseAudioContext, AudioBuffer>()
function noiseBuffer(c: BaseAudioContext) {
  let buf = noiseBufs.get(c)
  if (!buf) {
    const len = c.sampleRate * 2
    buf = c.createBuffer(1, len, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    noiseBufs.set(c, buf)
  }
  return buf
}

function noise(c: BaseAudioContext, t: number, dur: number) {
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c)
  src.start(t, Math.random() * 1.2, dur + 0.05)
  return src
}

function biquad(c: BaseAudioContext, type: BiquadFilterType, freq: number, q = 0.7) {
  const f = c.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  return f
}

/** A gain that rises to `peak`, holds, then falls away. */
function vca(c: BaseAudioContext, t: number, peak: number, attack: number, hold: number, release: number) {
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack)
  if (hold > 0) g.gain.setValueAtTime(Math.max(0.0002, peak), t + attack + hold)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release)
  return g
}

function send(c: BaseAudioContext, from: AudioNode, to: AudioNode, amount: number) {
  if (!amount) return
  const s = c.createGain()
  s.gain.value = amount
  from.connect(s)
  s.connect(to)
}

function impulse(c: BaseAudioContext, seconds: number, decay: number) {
  const len = Math.floor(c.sampleRate * seconds)
  const buf = c.createBuffer(2, len, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}

/** The room every song shares, made once per context. */
const rooms = new WeakMap<BaseAudioContext, AudioBuffer>()
function room(c: BaseAudioContext) {
  let buf = rooms.get(c)
  if (!buf) {
    buf = impulse(c, 2.6, 3)
    rooms.set(c, buf)
  }
  return buf
}

/** A plucked string (Karplus-Strong), worked out once per note and kept. */
const ksCaches = new WeakMap<BaseAudioContext, Map<Note, AudioBuffer>>()
function ksBuffer(c: BaseAudioContext, note: Note) {
  let cache = ksCaches.get(c)
  if (!cache) ksCaches.set(c, (cache = new Map()))
  const kept = cache.get(note)
  if (kept) return kept
  const sr = c.sampleRate
  const f = hz(note)
  const n = Math.max(2, Math.round(sr / f))
  const len = Math.floor(sr * 1.8)
  const buf = c.createBuffer(1, len, sr)
  const d = buf.getChannelData(0)
  let prev = 0
  for (let i = 0; i < n; i++) {
    prev = prev * 0.55 + (Math.random() * 2 - 1) * 0.45
    d[i] = prev
  }
  const damp = 0.9965 - Math.min(0.006, f / 90000)
  for (let i = n; i < len; i++) d[i] = damp * 0.5 * (d[i - n]! + d[i - n + 1 < i ? i - n + 1 : i - n]!)
  cache.set(note, buf)
  return buf
}

/** A piano string's tone: the overtones a struck string has, falling away up the series. */
const pianoWaves = new WeakMap<BaseAudioContext, PeriodicWave>()
function pianoWave(c: BaseAudioContext) {
  let w = pianoWaves.get(c)
  if (!w) {
    const amps = [0, 1, 0.45, 0.3, 0.2, 0.13, 0.1, 0.07, 0.05, 0.035, 0.025, 0.018, 0.012, 0.008]
    w = c.createPeriodicWave(new Float32Array(amps.length), new Float32Array(amps))
    pianoWaves.set(c, w)
  }
  return w
}

/* ---------- one song's mixer ---------- */

export type KitBus = {
  c: BaseAudioContext
  /** The song's own level: kitSongs sets it for each part's energy. */
  level: GainNode
  /** Everything but the drums comes through here, so it ducks on the kick. */
  pump: GainNode
  drums: GainNode
  verbSend: GainNode
  delaySend: GainNode
}

/**
 * The mixer for one song, into `dest`: drums straight to the song's level, the music through the pump, a
 * reverb and an echo on sends, then a limiter so a loud bar can't jump out of the mix.
 */
export function makeKitBus(c: BaseAudioContext, dest: AudioNode, echo: number): KitBus {
  const level = c.createGain()
  const pump = c.createGain()
  const drums = c.createGain()
  const verbSend = c.createGain()
  const delaySend = c.createGain()
  pump.connect(level)
  drums.connect(level)

  const conv = c.createConvolver()
  conv.buffer = room(c)
  const verbRet = c.createGain()
  verbRet.gain.value = 0.5
  verbSend.connect(conv)
  conv.connect(verbRet)
  verbRet.connect(level)

  const delay = c.createDelay(2)
  delay.delayTime.value = echo
  const fb = c.createGain()
  fb.gain.value = 0.33
  const tone = biquad(c, 'lowpass', 2600)
  const delayRet = c.createGain()
  delayRet.gain.value = 0.45
  delaySend.connect(delay)
  delay.connect(tone)
  tone.connect(fb)
  fb.connect(delay)
  tone.connect(delayRet)
  delayRet.connect(level)

  const lim = c.createDynamicsCompressor()
  lim.threshold.value = -6
  lim.knee.value = 3
  lim.ratio.value = 16
  lim.attack.value = 0.002
  lim.release.value = 0.12
  level.connect(lim)
  lim.connect(dest)
  return { c, level, pump, drums, verbSend, delaySend }
}

type BassOpts = { type?: OscillatorType; cutoff?: number; q?: number; env?: number; envTime?: number; gain?: number; attack?: number; release?: number; sub?: number }
type SubOpts = { gain?: number; attack?: number; release?: number; glideFrom?: Note }
type PadOpts = {
  type?: OscillatorType
  attack?: number
  release?: number
  detune?: number[]
  cutoff?: number
  q?: number
  /** The filter opens this many times over at the strike, then settles. */
  fenv?: number
  gain?: number
  /** A volume wobble every this many seconds. */
  wub?: number
  verb?: number
  delay?: number
}
type PluckOpts = { type?: OscillatorType; decay?: number; cutoff?: number; q?: number; floor?: number; gain?: number; len?: number; delay?: number; verb?: number }
type LeadOpts = {
  type?: OscillatorType
  detune?: number[]
  vibRate?: number
  vib?: number
  release?: number
  slideFrom?: Note
  cutoff?: number
  gain?: number
  attack?: number
  delay?: number
  verb?: number
}
type KeysOpts = { gain?: number; cutoff?: number; verb?: number; ratio?: number; index?: number; bite?: number }
type BellOpts = { ratio?: number; index?: number; bite?: number; decay?: number; gain?: number; trem?: number; verb?: number; delay?: number }
type GuitarOpts = { cutoff?: number; gain?: number; mute?: number; verb?: number; spread?: number }
type PianoOpts = { gain?: number; verb?: number }

/** The instruments, each playing one note (or chord) at a time `t` into the song's mixer. */
export function makeKit(b: KitBus) {
  const c = b.c
  const k = {
    /** The sidechain: the music ducks on the kick and swells back. */
    duck(t: number, depth = 0.4, rel = 0.16) {
      b.pump.gain.setValueAtTime(depth, t)
      b.pump.gain.setTargetAtTime(1, t + 0.012, rel / 3)
    },
    kick(t: number, v = 1, low = 46, len = 0.32) {
      const o = c.createOscillator()
      o.type = 'sine'
      o.frequency.setValueAtTime(165, t)
      o.frequency.exponentialRampToValueAtTime(low, t + 0.09)
      const g = vca(c, t, v, 0.003, 0.04, len)
      o.connect(g)
      g.connect(b.drums)
      o.start(t)
      o.stop(t + len + 0.1)
      const n = noise(c, t, 0.02)
      const f = biquad(c, 'highpass', 1600)
      const ng = vca(c, t, v * 0.22, 0.001, 0, 0.016)
      n.connect(f)
      f.connect(ng)
      ng.connect(b.drums)
    },
    snare(t: number, v = 0.5, verb = 0.12, tone = 1) {
      const n = noise(c, t, 0.26)
      const f = biquad(c, 'bandpass', 1900 * tone, 0.8)
      const g = vca(c, t, v, 0.001, 0.008, 0.17)
      n.connect(f)
      f.connect(g)
      g.connect(b.drums)
      send(c, g, b.verbSend, verb)
      const o = c.createOscillator()
      o.type = 'triangle'
      o.frequency.setValueAtTime(230 * tone, t)
      o.frequency.exponentialRampToValueAtTime(165 * tone, t + 0.08)
      const og = vca(c, t, v * 0.55, 0.001, 0, 0.09)
      o.connect(og)
      og.connect(b.drums)
      o.start(t)
      o.stop(t + 0.15)
    },
    clap(t: number, v = 0.5, verb = 0.25) {
      const f = biquad(c, 'bandpass', 1150, 1.1)
      const g = c.createGain()
      g.gain.setValueAtTime(v, t)
      g.gain.exponentialRampToValueAtTime(v * 0.15, t + 0.009)
      g.gain.setValueAtTime(v * 0.85, t + 0.011)
      g.gain.exponentialRampToValueAtTime(v * 0.15, t + 0.02)
      g.gain.setValueAtTime(v * 0.9, t + 0.022)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.21)
      const n = noise(c, t, 0.24)
      n.connect(f)
      f.connect(g)
      g.connect(b.drums)
      send(c, g, b.verbSend, verb)
    },
    hat(t: number, open = false, v = 0.3) {
      const n = noise(c, t, open ? 0.3 : 0.06)
      const f = biquad(c, 'highpass', 7200)
      const g = vca(c, t, v, 0.001, 0, open ? 0.22 : 0.032)
      n.connect(f)
      f.connect(g)
      g.connect(b.drums)
    },
    shaker(t: number, v = 0.15) {
      const n = noise(c, t, 0.09)
      const f = biquad(c, 'bandpass', 6400, 1.4)
      const g = vca(c, t, v, 0.014, 0, 0.05)
      n.connect(f)
      f.connect(g)
      g.connect(b.drums)
    },
    rim(t: number, v = 0.3) {
      const o = c.createOscillator()
      o.type = 'triangle'
      o.frequency.value = 1750
      const g = vca(c, t, v, 0.001, 0, 0.028)
      o.connect(g)
      g.connect(b.drums)
      o.start(t)
      o.stop(t + 0.06)
      const n = noise(c, t, 0.02)
      const f = biquad(c, 'bandpass', 3300, 2)
      const ng = vca(c, t, v * 0.6, 0.001, 0, 0.02)
      n.connect(f)
      f.connect(ng)
      ng.connect(b.drums)
    },
    crash(t: number, v = 0.22) {
      const n = noise(c, t, 1.9)
      const f = biquad(c, 'highpass', 4300)
      const g = vca(c, t, v, 0.002, 0, 1.7)
      n.connect(f)
      f.connect(g)
      g.connect(b.drums)
      send(c, g, b.verbSend, 0.35)
    },
    riser(t: number, dur: number, v = 0.18) {
      const n = noise(c, t, dur)
      const f = biquad(c, 'bandpass', 300, 2)
      f.frequency.setValueAtTime(300, t)
      f.frequency.exponentialRampToValueAtTime(6500, t + dur)
      const g = c.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(v, t + dur * 0.95)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      n.connect(f)
      f.connect(g)
      g.connect(b.drums)
      send(c, g, b.verbSend, 0.4)
    },
    /** Old-record crackle: a dusty hiss and a few pops across the bar. */
    vinyl(t: number, dur: number, v = 0.018) {
      const n = noise(c, t, dur)
      const f = biquad(c, 'bandpass', 2600, 0.5)
      const g = c.createGain()
      g.gain.value = v
      n.connect(f)
      f.connect(g)
      g.connect(b.drums)
      for (let i = 0; i < 7; i++) {
        const tt = t + Math.random() * dur
        const p = noise(c, tt, 0.004)
        const pf = biquad(c, 'highpass', 1400)
        const pg = vca(c, tt, 0.04 + Math.random() * 0.1, 0.0005, 0, 0.004)
        p.connect(pf)
        pf.connect(pg)
        pg.connect(b.drums)
      }
    },
    bass(t: number, note: Note, dur: number, o: BassOpts = {}) {
      const f0 = hz(note)
      const cut = o.cutoff || 600
      const osc = c.createOscillator()
      osc.type = o.type || 'sawtooth'
      osc.frequency.value = f0
      const lp = biquad(c, 'lowpass', cut, o.q || 2)
      if (o.env) {
        lp.frequency.setValueAtTime(cut + o.env, t)
        lp.frequency.exponentialRampToValueAtTime(cut, t + (o.envTime || 0.18))
      }
      const peak = o.gain || 0.35
      const g = vca(c, t, peak, o.attack || 0.004, Math.max(0, dur - 0.06), o.release || 0.08)
      osc.connect(lp)
      lp.connect(g)
      g.connect(b.pump)
      osc.start(t)
      osc.stop(t + dur + 0.3)
      if (o.sub) {
        const s = c.createOscillator()
        s.type = 'sine'
        s.frequency.value = f0
        const sg = vca(c, t, peak * o.sub, 0.006, Math.max(0, dur - 0.06), 0.09)
        s.connect(sg)
        sg.connect(b.pump)
        s.start(t)
        s.stop(t + dur + 0.3)
      }
    },
    sub(t: number, note: Note, dur: number, o: SubOpts = {}) {
      const s = c.createOscillator()
      s.type = 'sine'
      s.frequency.value = hz(note)
      if (o.glideFrom) {
        s.frequency.setValueAtTime(hz(o.glideFrom), t)
        s.frequency.exponentialRampToValueAtTime(hz(note), t + 0.06)
      }
      const g = vca(c, t, o.gain || 0.45, o.attack || 0.012, Math.max(0, dur - 0.08), o.release || 0.12)
      s.connect(g)
      g.connect(b.pump)
      s.start(t)
      s.stop(t + dur + 0.3)
    },
    /** Detuned saws through a lowpass: chords held (a pad) or short (a stab), with an optional wub. */
    pad(t: number, chord: readonly Note[], dur: number, o: PadOpts = {}) {
      const attack = o.attack ?? 0.25
      const release = o.release ?? 0.6
      const detunes = o.detune || [-9, 9]
      const sum = c.createGain()
      sum.gain.value = 1 / Math.sqrt(chord.length * detunes.length)
      const cut = o.cutoff || 1200
      const lp = biquad(c, 'lowpass', cut, o.q || 0.6)
      if (o.fenv) {
        lp.frequency.setValueAtTime(cut * 0.4, t)
        lp.frequency.exponentialRampToValueAtTime(cut * o.fenv, t + Math.max(0.03, attack))
        lp.frequency.exponentialRampToValueAtTime(cut, t + Math.max(0.03, attack) + 0.25)
      }
      const g = vca(c, t, o.gain || 0.12, attack, Math.max(0, dur - attack), release)
      sum.connect(lp)
      let last: AudioNode = lp
      if (o.wub) {
        const w = c.createGain()
        for (let tt = t; tt < t + dur - 0.01; tt += o.wub) {
          w.gain.setValueAtTime(0.16, tt)
          w.gain.linearRampToValueAtTime(1, tt + o.wub * 0.85)
        }
        lp.connect(w)
        last = w
      }
      last.connect(g)
      g.connect(b.pump)
      send(c, g, b.verbSend, o.verb ?? 0.3)
      send(c, g, b.delaySend, o.delay ?? 0)
      for (const n of chord) {
        for (const d of detunes) {
          const osc = c.createOscillator()
          osc.type = o.type || 'sawtooth'
          osc.frequency.value = hz(n)
          osc.detune.value = d + (Math.random() * 4 - 2)
          osc.connect(sum)
          osc.start(t)
          osc.stop(t + dur + release + 0.1)
        }
      }
    },
    pluck(t: number, note: Note, dur: number, o: PluckOpts = {}) {
      const osc = c.createOscillator()
      osc.type = o.type || 'sawtooth'
      osc.frequency.value = hz(note)
      const decay = o.decay || 0.16
      const lp = biquad(c, 'lowpass', o.cutoff || 2400, o.q || 1)
      lp.frequency.setValueAtTime(o.cutoff || 2400, t)
      lp.frequency.exponentialRampToValueAtTime(o.floor || 320, t + decay)
      const ring = Math.max(decay * 1.4, Math.min(dur, o.len || 0.3))
      const g = vca(c, t, o.gain || 0.1, 0.002, 0, ring)
      osc.connect(lp)
      lp.connect(g)
      g.connect(b.pump)
      send(c, g, b.delaySend, o.delay ?? 0)
      send(c, g, b.verbSend, o.verb ?? 0.15)
      osc.start(t)
      osc.stop(t + ring + 0.1)
    },
    lead(t: number, note: Note, dur: number, o: LeadOpts = {}) {
      const f = hz(note)
      const detunes = o.detune || [-7, 7]
      const sum = c.createGain()
      sum.gain.value = 1 / Math.sqrt(detunes.length)
      const lfo = c.createOscillator()
      lfo.frequency.value = o.vibRate || 5.4
      const lg = c.createGain()
      lg.gain.setValueAtTime(0, t)
      lg.gain.linearRampToValueAtTime(o.vib ?? 9, t + 0.32)
      lfo.connect(lg)
      const end = t + dur + (o.release || 0.12) + 0.1
      for (const d of detunes) {
        const osc = c.createOscillator()
        osc.type = o.type || 'sawtooth'
        osc.frequency.value = f
        if (o.slideFrom) {
          osc.frequency.setValueAtTime(hz(o.slideFrom), t)
          osc.frequency.exponentialRampToValueAtTime(f, t + 0.05)
        }
        osc.detune.value = d
        lg.connect(osc.detune)
        osc.connect(sum)
        osc.start(t)
        osc.stop(end)
      }
      lfo.start(t)
      lfo.stop(end)
      const lp = biquad(c, 'lowpass', o.cutoff || 2600, 0.8)
      const g = vca(c, t, o.gain || 0.09, o.attack || 0.012, Math.max(0, dur - 0.05), o.release || 0.12)
      sum.connect(lp)
      lp.connect(g)
      g.connect(b.pump)
      send(c, g, b.delaySend, o.delay ?? 0.22)
      send(c, g, b.verbSend, o.verb ?? 0.2)
    },
    /** An electric piano, by FM: a sine bent by a sine at the same pitch, bright at the strike. */
    keys(t: number, chord: readonly Note[], dur: number, o: KeysOpts = {}) {
      const out = c.createGain()
      out.gain.value = (o.gain || 0.12) / Math.sqrt(chord.length)
      const lp = biquad(c, 'lowpass', o.cutoff || 3000)
      out.connect(lp)
      lp.connect(b.pump)
      send(c, lp, b.verbSend, o.verb ?? 0.22)
      const hold = Math.min(dur, 2.2)
      for (const n of chord) {
        const f = hz(n)
        const car = c.createOscillator()
        car.type = 'sine'
        car.frequency.value = f
        const mod = c.createOscillator()
        mod.type = 'sine'
        mod.frequency.value = f * (o.ratio || 1)
        const mg = c.createGain()
        mg.gain.setValueAtTime(f * (o.index || 1.8), t)
        mg.gain.exponentialRampToValueAtTime(f * 0.12 + 1, t + (o.bite || 0.45))
        mod.connect(mg)
        mg.connect(car.frequency)
        const g = c.createGain()
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(1, t + 0.005)
        g.gain.exponentialRampToValueAtTime(0.3, t + hold)
        g.gain.exponentialRampToValueAtTime(0.0001, t + hold + 0.3)
        car.connect(g)
        g.connect(out)
        car.start(t)
        mod.start(t)
        car.stop(t + hold + 0.4)
        mod.stop(t + hold + 0.4)
      }
    },
    /** A bell or a vibraphone, by FM. */
    bell(t: number, note: Note, _dur: number, o: BellOpts = {}) {
      const f = hz(note)
      const car = c.createOscillator()
      car.type = 'sine'
      car.frequency.value = f
      const mod = c.createOscillator()
      mod.type = 'sine'
      mod.frequency.value = f * (o.ratio || 3.5)
      const mg = c.createGain()
      mg.gain.setValueAtTime(f * (o.index || 2.5), t)
      mg.gain.exponentialRampToValueAtTime(f * 0.05 + 1, t + (o.bite || 0.25))
      mod.connect(mg)
      mg.connect(car.frequency)
      const decay = o.decay || 1.5
      const g = vca(c, t, o.gain || 0.1, 0.002, 0, decay)
      let last: AudioNode = g
      car.connect(g)
      if (o.trem) {
        const tg = c.createGain()
        const lfo = c.createOscillator()
        lfo.frequency.value = o.trem
        const depth = c.createGain()
        depth.gain.value = 0.3
        lfo.connect(depth)
        depth.connect(tg.gain)
        tg.gain.value = 0.7
        g.connect(tg)
        last = tg
        lfo.start(t)
        lfo.stop(t + decay + 0.1)
      }
      last.connect(b.pump)
      send(c, last, b.verbSend, o.verb ?? 0.35)
      send(c, last, b.delaySend, o.delay ?? 0.18)
      car.start(t)
      mod.start(t)
      car.stop(t + decay + 0.1)
      mod.stop(t + decay + 0.1)
    },
    /** A nylon string: a Karplus-Strong pluck, cut short for a muted strum. */
    guitar(t: number, note: Note, o: GuitarOpts = {}) {
      const src = c.createBufferSource()
      src.buffer = ksBuffer(c, note)
      const lp = biquad(c, 'lowpass', o.cutoff || 3000)
      const g = c.createGain()
      g.gain.setValueAtTime(o.gain || 0.3, t)
      if (o.mute) g.gain.setTargetAtTime(0.0001, t + o.mute, 0.03)
      src.connect(lp)
      lp.connect(g)
      g.connect(b.pump)
      send(c, g, b.verbSend, o.verb ?? 0.16)
      src.start(t)
      src.stop(t + (o.mute ? o.mute + 0.25 : 1.8))
    },
    strum(t: number, chord: readonly Note[], o: GuitarOpts = {}) {
      chord.forEach((n, i) => k.guitar(t + i * (o.spread ?? 0.014), n, { ...o, gain: (o.gain || 0.3) / Math.sqrt(chord.length) }))
    },
    /**
     * A piano note: two strings a hair apart, struck bright and mellowing as they ring, a quick first fall and
     * then a long one (longer the lower the note), a soft knock of the hammer, and the damper when it lets go.
     */
    piano(t: number, note: Note, dur: number, vel = 0.5, o: PianoOpts = {}) {
      const f = hz(note)
      const amp = (o.gain || 0.2) * vel * 0.5
      const ring = Math.max(0.7, Math.min(7, 7 - (note - 30) * 0.08))
      const top = Math.min(14000, f * (3 + 12 * vel))
      const lp = biquad(c, 'lowpass', top, 0.4)
      lp.frequency.setValueAtTime(top, t)
      lp.frequency.setTargetAtTime(Math.max(f * 1.6, 380), t + 0.01, 0.3 + ring * 0.08)
      const g = c.createGain()
      const off = t + Math.max(dur, 0.16)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp), t + 0.004)
      g.gain.setTargetAtTime(amp * 0.4, t + 0.004, 0.06)
      g.gain.setTargetAtTime(0.0001, t + 0.15, ring / 5)
      g.gain.setTargetAtTime(0.0001, off, 0.09)
      lp.connect(g)
      g.connect(b.pump)
      send(c, g, b.verbSend, o.verb ?? 0.28)
      const end = off + 0.7
      for (const d of [0, 1.4]) {
        const osc = c.createOscillator()
        osc.setPeriodicWave(pianoWave(c))
        osc.frequency.value = f
        osc.detune.value = d
        osc.connect(lp)
        osc.start(t)
        osc.stop(end)
      }
      const n = noise(c, t, 0.02)
      const nf = biquad(c, 'bandpass', Math.min(5000, f * 3), 1.2)
      const ng = vca(c, t, amp * 0.12, 0.001, 0, 0.018)
      n.connect(nf)
      nf.connect(ng)
      ng.connect(b.pump)
    },
  }
  return k
}

export type Kit = ReturnType<typeof makeKit>
