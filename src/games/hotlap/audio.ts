import { soundOut } from '../../lib/sound'
import type { Run } from './sim'

/** Where each gear runs out, m/s: the note climbs through a gear and drops at the change. */
const GEARS = [0, 13, 22, 31, 40, 70]
const LEVEL = 0.55
/** Seconds the tyres scream for the donuts egg, the last half of it dying away. */
const SCREECH = 1.1

type Voice = {
  audio: AudioContext
  level: GainNode
  lp: BiquadFilterNode
  engine: GainNode
  a: OscillatorNode
  b: OscillatorNode
  hiss: AudioBufferSourceNode
  band: BiquadFilterNode
  squeal: GainNode
}

/**
 * The car's engine and tyres. They play through the site's own mixer (lib/sound's soundOut), so the
 * mute switch and the limiter hold for them as for every other sound. It wakes on the press that
 * starts a lap, since a browser won't play before one.
 */
export class CarSound {
  private voice: Voice | null = null
  private failed = false
  /** The audio clock's time the scream ends, for the donuts egg. */
  private screechTill = 0

  wake() {
    if (this.voice || this.failed) return
    const out = soundOut()
    if (!out) return
    try {
      const { audio } = out
      const level = audio.createGain()
      level.gain.value = 0
      level.connect(out.out)
      // The engine: a saw and a square an octave down, through a filter that opens with the revs.
      const lp = audio.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 600
      const engine = audio.createGain()
      engine.gain.value = 0
      const a = audio.createOscillator()
      a.type = 'sawtooth'
      const b = audio.createOscillator()
      b.type = 'square'
      a.connect(lp)
      b.connect(lp)
      lp.connect(engine)
      engine.connect(level)
      // The tyres: noise through a band that sings near the grip's limit and squeals past it.
      const noise = audio.createBuffer(1, audio.sampleRate, audio.sampleRate)
      const data = noise.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      const hiss = audio.createBufferSource()
      hiss.buffer = noise
      hiss.loop = true
      const band = audio.createBiquadFilter()
      band.type = 'bandpass'
      band.frequency.value = 1500
      band.Q.value = 1.6
      const squeal = audio.createGain()
      squeal.gain.value = 0
      hiss.connect(band)
      band.connect(squeal)
      squeal.connect(level)
      a.start()
      b.start()
      hiss.start()
      level.gain.setTargetAtTime(LEVEL, audio.currentTime, 0.1)
      this.voice = { audio, level, lp, engine, a, b, hiss, band, squeal }
    } catch {
      this.failed = true
    }
  }

  /**
   * This frame's sound. `pushing` is how hard the gas is down (0 to 1), `revving` is the car held on
   * the line with the gas down, and nothing plays unless `on`.
   */
  update(run: Run, pushing: number, revving: boolean, on: boolean) {
    const voice = this.voice
    if (!voice) return
    const t = voice.audio.currentTime
    if (!on) {
      voice.engine.gain.setTargetAtTime(0, t, 0.08)
      voice.squeal.gain.setTargetAtTime(0, t, 0.05)
      return
    }
    const v = run.v
    let g = 1
    while (g < GEARS.length - 1 && v > GEARS[g]!) g++
    const rev = Math.min(1, (v - GEARS[g - 1]!) / (GEARS[g]! - GEARS[g - 1]!))
    const hz = 48 + rev * 105 + (revving ? pushing * 70 : 0)
    voice.a.frequency.setTargetAtTime(hz, t, 0.04)
    voice.b.frequency.setTargetAtTime(hz / 2, t, 0.04)
    voice.lp.frequency.setTargetAtTime(420 + rev * 900 + pushing * 900, t, 0.06)
    voice.engine.gain.setTargetAtTime(0.05 + pushing * 0.06, t, 0.08)
    // Tyres start to sing near their limit and squeal past it; ABS chatters; grass rumbles.
    let skid = run.onGrass
      ? v > 3
        ? 0.05
        : 0
      : Math.min(0.22, Math.max(0, run.work - 0.85) * 0.35) + (run.abs && v > 6 ? 0.06 : 0)
    let pitch = run.onGrass ? 380 : 1300 + Math.min(600, run.work * 300)
    // A donut: the back tyres sliding round the whole time, sung high.
    if (run.donut !== 0) {
      skid = Math.max(skid, 0.22)
      pitch = 2100
    }
    const screaming = this.screechTill - t
    if (screaming > 0) {
      // The donuts egg: higher and louder than any slide in a lap, then dying away.
      skid = Math.max(skid, 0.3 * Math.min(1, screaming / (SCREECH / 2)))
      pitch = 2400
    }
    voice.band.frequency.setTargetAtTime(pitch, t, 0.05)
    voice.squeal.gain.setTargetAtTime(skid, t, 0.05)
  }

  /** The tyres scream for a moment, for the donuts egg (donuts.ts), through the same mixer as the rest. */
  screech() {
    if (this.voice) this.screechTill = this.voice.audio.currentTime + SCREECH
  }

  dispose() {
    const voice = this.voice
    this.voice = null
    if (!voice) return
    const t = voice.audio.currentTime
    voice.level.gain.setTargetAtTime(0, t, 0.03)
    // Let the fade finish before the voices stop, so leaving doesn't click.
    window.setTimeout(() => {
      try {
        voice.a.stop()
        voice.b.stop()
        voice.hiss.stop()
      } catch {
        /* already stopped */
      }
      voice.level.disconnect()
    }, 200)
  }
}
