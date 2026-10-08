import { soundOut } from '../../lib/sound'
import { makeVoices, noiseBuffer, type Voices } from '../../lib/soundPacks/voices'
import type { Run, SimEvent, Volume } from './engine/types.ts'

/*
 * Wobble Run's sounds, made as they're needed (no samples): hops and boings, bonks and the crowd's "ooh", the
 * goo's splat and its "aww", the whoosh of a dive and a belly slide, a chime at each checkpoint a note higher
 * than the last (C, E, G, high C), and the crown's fanfare. The telegraphs have their sound too, the second
 * warning design-final §6 #4 asks for: a door's ding-ding before it shuts, a glove's rattle in its wind-up, a
 * cannon's thoomp, a chute's thunk, a fan's whine; each panned to where it is across the track (screen right is
 * −x) and quieter the further off it is.
 *
 * Everything plays through the site's own mixer (lib/sound's soundOut), so the mute switch and the limiter
 * hold for it as for every other sound, and nothing plays in a preview. It wakes on the press that starts a run,
 * since a browser won't play before one.
 *
 *   const sound = new RunSound()
 *   sound.wake()                    // on the press that starts a run
 *   sound.count(3) … sound.count(1) // the countdown's ticks, if wanted (GO's whistle comes with the 'go' event)
 *   step(run, input); sound.events(run.ev, run)   // after each fixed step: every event's and telegraph's sound
 *   sound.update({ speed, grounded, sliding, on, run })   // each frame: footsteps, the slide's hiss, a fan's wind
 *   sound.dispose()
 *
 * `events` is the whole event set. A shell that plays the site's sfx() for the events itself should call only
 * `update` (the continuous layer), or the two would both sound.
 */

const LEVEL = 0.9
/** Every voice's level: about where the site's sound sets sit. */
const TRIM = 2.2
/** Checkpoint chimes, a note higher each time: C, E, G, high C, then on up. */
const CHIMES = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568.0]

type Loop = { src: AudioBufferSourceNode; band: BiquadFilterNode; gain: GainNode }

/** What the continuous layer needs each frame. `on`: a run is live (not a card, a pause, or past the crown). */
export type RunSoundState = { speed: number; grounded: boolean; sliding: boolean; on: boolean; run?: Run | null }

export class RunSound {
  private audio: AudioContext | null = null
  private level: GainNode | null = null
  private v: Voices | null = null
  private slide: Loop | null = null
  private wind: Loop | null = null
  private failed = false
  private stepAt = 0
  private stepSide = 0
  private lastUpdate = -1
  /** When each kind of cue last sounded (audio time), so nine doors don't ding at once. */
  private readonly last = new Map<string, number>()

  wake() {
    if (this.v || this.failed) return
    const out = soundOut()
    if (!out) return
    try {
      const { audio } = out
      const level = audio.createGain()
      level.gain.value = 0.0001
      level.connect(out.out)
      level.gain.setTargetAtTime(LEVEL, audio.currentTime, 0.05)
      this.audio = audio
      this.level = level
      this.v = makeVoices(audio, level, null, TRIM)
      this.slide = this.loop('bandpass', 700, 0.8)
      this.wind = this.loop('bandpass', 480, 0.6)
    } catch {
      this.failed = true
    }
  }

  /** A looped noise, filtered, its gain at nothing until update() lifts it. */
  private loop(type: BiquadFilterType, freq: number, Q: number): Loop {
    const audio = this.audio!
    const src = audio.createBufferSource()
    src.buffer = noiseBuffer(audio)
    src.loop = true
    const band = audio.createBiquadFilter()
    band.type = type
    band.frequency.value = freq
    band.Q.value = Q
    const gain = audio.createGain()
    gain.gain.value = 0
    src.connect(band)
    band.connect(gain)
    gain.connect(this.level!)
    src.start()
    return { src, band, gain }
  }

  private now() {
    return this.audio!.currentTime + 0.004
  }

  /** Whether a kind of sound may play again yet (at most every `gap` s). */
  private may(key: string, gap: number): boolean {
    const t = this.audio!.currentTime
    const was = this.last.get(key) ?? -Infinity
    if (t - was < gap) return false
    this.last.set(key, t)
    return true
  }

  /** The countdown's tick for 3, 2, 1. */
  count(n: number) {
    if (!this.v || n <= 0) return
    this.v.fmAt(this.now(), 659.25, 0.16, 0.1, { ratio: 3.5, index: 1.2, indexTime: 0.06 })
  }

  /** One step's events (run.ev, after step()). */
  events(ev: readonly SimEvent[], run: Run) {
    const v = this.v
    if (!v || !ev.length) return
    const b = run.bean
    for (const e of ev) {
      const t = this.now()
      // Panned by where it is across the track from the bean; quieter far off, and behind it.
      const pan = Math.max(-1, Math.min(1, (b.x - e.x) / 7))
      const d = Math.hypot(e.x - b.x, e.z - b.z)
      const far = Math.max(0.15, Math.min(1, 1 - (d - 6) / 30)) * (e.z < b.z - 4 ? 0.6 : 1)
      switch (e.k) {
        case 'go':
          // The referee's whistle, and the barrier sinking with a slurp.
          v.toneAt(t, 1250, 0.32, 0.07, { vib: { rate: 32, depth: 50 }, attack: 0.01 })
          v.noiseAt(t + 0.05, 0.3, 0.06, { type: 'lowpass', freq: 900, to: 160, Q: 2 })
          break
        case 'jump':
          v.toneAt(t, 330, 0.15, 0.1, { type: 'triangle', to: 640, slideTime: 0.1 })
          v.noiseAt(t, 0.04, 0.025, { type: 'highpass', freq: 3500 })
          break
        case 'bellyHop':
          v.toneAt(t, 430, 0.13, 0.09, { type: 'triangle', to: 780, slideTime: 0.09 })
          break
        case 'dive':
          v.noiseAt(t, 0.26, 0.13, { type: 'bandpass', freq: 1900, to: 480, Q: 1.2, attack: 0.02 })
          break
        case 'land':
          if (e.v > 3) {
            v.toneAt(t, 150, 0.09, Math.min(0.16, 0.04 + e.v * 0.008), { to: 80 })
            v.noiseAt(t, 0.05, 0.04, { type: 'lowpass', freq: 900 })
            if (e.v > 10) v.toneAt(t, 760, 0.07, 0.035, { type: 'triangle', to: 520 })
          }
          break
        case 'slide':
          v.noiseAt(t, 0.42, 0.11, { type: 'bandpass', freq: 950, to: 380, Q: 0.8 })
          v.toneAt(t, 540, 0.2, 0.04, { type: 'triangle', to: 360 })
          break
        case 'bonk':
          // A rubber boing.
          v.toneAt(t, 430, 0.42, 0.14, { to: 170, slideTime: 0.3, vib: { rate: 22, depth: 35 }, pan })
          break
        case 'knock':
          v.toneAt(t, 175, 0.18, 0.17, { type: 'square', to: 70, filter: { freq: 1300 }, pan })
          v.noiseAt(t, 0.09, 0.12, { type: 'lowpass', freq: 1700, pan })
          this.crowd(t + 0.12, 'ooh')
          break
        case 'yeet':
          v.toneAt(t, 95, 0.26, 0.2, { to: 40 })
          v.noiseAt(t, 0.18, 0.12, { type: 'lowpass', freq: 1100, to: 300 })
          v.toneAt(t + 0.05, 900, 0.7, 0.06, { to: 1900, slideTime: 0.62 })
          this.crowd(t + 0.2, 'ooh')
          break
        case 'closeCall':
          v.noiseAt(t, 0.2, 0.11, { type: 'bandpass', freq: 2500, to: 700, Q: 1.5, pan })
          v.fmAt(t + 0.05, 1568, 0.26, 0.045, { ratio: 3.5, index: 1.2, indexTime: 0.1 })
          if (this.may('close-ooh', 3)) this.crowd(t + 0.1, 'ooh', 0.5)
          break
        case 'ledge':
          // "Phew."
          v.toneAt(t, 520, 0.12, 0.07, { type: 'triangle', to: 600 })
          v.toneAt(t + 0.1, 780, 0.2, 0.07, { type: 'triangle' })
          break
        case 'bounce':
          v.toneAt(t, 200, 0.34, 0.14, { to: 560, slideTime: 0.12, vib: { rate: 14, depth: 25, delay: 0.1 } })
          break
        case 'perfectBounce':
          v.toneAt(t, 260, 0.38, 0.14, { to: 760, slideTime: 0.12, vib: { rate: 14, depth: 30, delay: 0.1 } })
          v.fmAt(t + 0.08, 1318.5, 0.35, 0.06, { ratio: 3.5, index: 1.4, indexTime: 0.15 })
          v.fmAt(t + 0.16, 1568, 0.4, 0.06, { ratio: 3.5, index: 1.4, indexTime: 0.15 })
          break
        case 'hoop':
          v.toneAt(t, 420, 0.24, 0.08, { type: 'sawtooth', to: 1700, filter: { freq: 2600 } })
          v.fmAt(t + 0.06, 2093, 0.3, 0.04, { ratio: 3.5, index: 1, indexTime: 0.1 })
          break
        case 'tileCrack':
          v.fmAt(t, 1700 + Math.random() * 300, 0.08, 0.05 * far, { ratio: 4.2, index: 2, indexTime: 0.02, pan })
          v.noiseAt(t, 0.02, 0.03 * far, { type: 'highpass', freq: 4000, pan })
          break
        case 'tileDrop':
          v.toneAt(t, 240, 0.26, 0.07 * far, { type: 'triangle', to: 110, pan })
          v.noiseAt(t, 0.12, 0.05 * far, { type: 'lowpass', freq: 700, pan })
          break
        case 'fall':
          // "Wheee", down.
          v.toneAt(t, 900, 0.7, 0.07, { to: 220, slideTime: 0.65 })
          break
        case 'splat':
          v.noiseAt(t, 0.34, 0.2, { type: 'lowpass', freq: 1400, to: 180, Q: 3 })
          v.toneAt(t, 110, 0.22, 0.14, { to: 45 })
          this.crowd(t + 0.22, 'aww')
          break
        case 'respawn':
          // The drop-in bubble's pop.
          v.toneAt(t, 600, 0.07, 0.09, { to: 1300 })
          v.noiseAt(t, 0.03, 0.03, { type: 'highpass', freq: 5000 })
          break
        case 'checkpoint': {
          const note = CHIMES[Math.min(CHIMES.length - 1, Math.max(0, run.splits.length - 1))]!
          v.fmAt(t, note, 0.8, 0.15, { ratio: 3.5, index: 1.5, indexTime: 0.25 })
          v.fmAt(t + 0.07, note * 2, 0.55, 0.05, { ratio: 3.5, index: 1.2, indexTime: 0.2 })
          this.crowd(t + 0.05, 'cheer', 0.7)
          break
        }
        case 'flag':
          v.fmAt(t, 880, 0.36, 0.08, { ratio: 3.5, index: 1.3, indexTime: 0.15 })
          break
        case 'crown': {
          // The fanfare: up the chord, then held, under the crowd's cheer.
          const notes = [523.25, 659.25, 783.99, 1046.5]
          notes.forEach((f, k) => v.toneAt(t + k * 0.11, f, 0.16, 0.06, { type: 'square', filter: { freq: 2800 } }))
          for (const [f, p] of [
            [1046.5, -0.3],
            [1318.5, 0],
            [1568, 0.3],
          ] as const)
            v.toneAt(t + 0.46, f, 1.1, 0.05, { type: 'triangle', hold: 0.6, pan: p, vib: { rate: 5.5, depth: 6, delay: 0.3 } })
          v.fmAt(t + 0.46, 2093, 0.9, 0.04, { ratio: 3.5, index: 1.2, indexTime: 0.3 })
          this.crowd(t + 0.3, 'cheer', 1.3)
          break
        }
        case 'cue':
          this.cue(e, t, pan, far)
          break
        default:
          break
      }
    }
  }

  /** A telegraph changing phase near the bean: the sound that warns of it. */
  private cue(e: SimEvent, t: number, pan: number, far: number) {
    const v = this.v!
    const look = String(e.look ?? '')
    const state = e.state
    const g = far
    if (look === 'door') {
      if (state === 'warn' && this.may('door-warn', 0.12)) {
        v.fmAt(t, 1318.5, 0.18, 0.06 * g, { ratio: 3.5, index: 1.2, indexTime: 0.06, pan })
        v.fmAt(t + 0.13, 1318.5, 0.22, 0.06 * g, { ratio: 3.5, index: 1.2, indexTime: 0.06, pan })
      } else if (state === 'act' && this.may('door-act', 0.12)) {
        v.noiseAt(t, 0.32, 0.05 * g, { type: 'lowpass', freq: 900, to: 200, pan })
        v.toneAt(t + 0.42, 120, 0.12, 0.07 * g, { to: 60, pan })
      }
    } else if (look.startsWith('glove')) {
      if (state === 'warn' && this.may('glove-warn', 0.15)) {
        for (let k = 0; k < 12; k++) v.noiseAt(t + k * 0.045, 0.025, (0.03 + k * 0.003) * g, { type: 'bandpass', freq: 2600, Q: 3, pan })
      } else if (state === 'act' && this.may('glove-act', 0.1)) {
        v.noiseAt(t, 0.12, 0.08 * g, { type: 'bandpass', freq: 900, to: 2400, Q: 1, pan })
        v.toneAt(t + 0.08, 200, 0.09, 0.08 * g, { to: 90, pan })
      }
    } else if (look === 'cannon' || look === 'fruit-melon' || look === 'fruit-orange' || look === 'banana') {
      // A cannon's telegraph rides the lead fruit it fires (fruitChute.ts cannonTele).
      if (state === 'warn' && this.may('cannon-warn', 0.2)) v.toneAt(t, 60, 0.8, 0.05 * g, { to: 110, attack: 0.6, pan })
      else if (state === 'act' && this.may('cannon-act', 0.15)) {
        v.toneAt(t, 120, 0.26, 0.18 * g, { to: 45, pan })
        v.noiseAt(t, 0.2, 0.1 * g, { type: 'lowpass', freq: 800, pan })
      }
    } else if (look === 'chute' || look === 'boulder' || look === 'gumball') {
      if (state === 'warn' && this.may('chute-warn', 0.2)) {
        v.toneAt(t, 180, 0.11, 0.1 * g, { type: 'triangle', to: 110, pan })
        v.noiseAt(t, 0.05, 0.05 * g, { type: 'lowpass', freq: 1200, pan })
      } else if (state === 'act' && this.may('chute-act', 0.2)) v.noiseAt(t, 0.5, 0.06 * g, { type: 'lowpass', freq: 320, pan })
    } else if (look === 'fan' || look === 'wind') {
      if (state === 'warn' && this.may('fan-warn', 0.3)) v.toneAt(t, 200, 0.72, 0.035 * g, { type: 'sawtooth', to: 900, slideTime: 0.7, filter: { freq: 1800 }, pan })
    } else if (look === 'wall-jelly') {
      // Block Party's arch: a low, soft whomp as each wall leaves it (blockParty.ts releaseTele's act).
      if (state === 'act' && this.may('arch-act', 0.3)) {
        v.toneAt(t, 90, 0.32, 0.12 * g, { to: 50, pan })
        v.noiseAt(t, 0.22, 0.06 * g, { type: 'lowpass', freq: 420, to: 160, pan })
      }
    } else if (look === 'pendulum') {
      if (state === 'warn' && this.may('pendulum-warn', 0.3)) v.noiseAt(t, 0.45, 0.06 * g, { type: 'bandpass', freq: 300, to: 650, Q: 2, pan })
    } else if (state === 'warn' && this.may(`warn-${look}`, 0.2)) {
      v.fmAt(t, 1000, 0.08, 0.04 * g, { ratio: 3, index: 1, indexTime: 0.03, pan })
    }
  }

  /** The crowd: an "ooh" rising, an "aww" falling, a cheer; a handful of voices and their breath. */
  private crowd(t: number, kind: 'ooh' | 'aww' | 'cheer', size = 1) {
    const v = this.v!
    const n = 5
    for (let k = 0; k < n; k++) {
      const f = 170 + Math.random() * 160
      const pan = (k / (n - 1) - 0.5) * 1.2
      if (kind === 'ooh') v.toneAt(t + k * 0.02, f, 0.75, 0.018 * size, { type: 'triangle', to: f * 1.18, slideTime: 0.5, attack: 0.15, filter: { freq: 900 }, vib: { rate: 5 + k, depth: 4 }, pan })
      else if (kind === 'aww') v.toneAt(t + k * 0.02, f * 1.2, 1.0, 0.018 * size, { type: 'triangle', to: f * 0.8, slideTime: 0.85, attack: 0.12, filter: { freq: 800 }, vib: { rate: 4 + k, depth: 5 }, pan })
      else v.toneAt(t + k * 0.05, f * 1.6, 0.7, 0.014 * size, { type: 'triangle', to: f * 2.3, slideTime: 0.4, attack: 0.08, filter: { freq: 1600 }, pan })
    }
    const breath = kind === 'cheer' ? { freq: 1500, to: 1100, Q: 0.7, dur: 1.2 } : { freq: kind === 'ooh' ? 500 : 650, to: kind === 'ooh' ? 750 : 420, Q: 2.5, dur: 0.8 }
    v.noiseAt(t, breath.dur * size, 0.05 * size, { type: 'bandpass', freq: breath.freq, to: breath.to, Q: breath.Q, attack: 0.15 })
  }

  /**
   * Each frame: footsteps patter as it runs, a hiss while it belly slides, the wind while a fan blows on it (with
   * the run given). `on` false (a start card, a pause, after the crown) lets them all go quiet.
   */
  update(s: RunSoundState) {
    const v = this.v
    if (!v || !this.audio) return
    const t = this.audio.currentTime
    const dt = this.lastUpdate < 0 ? 0 : Math.min(0.1, Math.max(0, t - this.lastUpdate))
    this.lastUpdate = t
    const run = s.run ?? null
    const b = run?.bean
    const live = s.on
    const speed = s.speed
    const grounded = s.grounded
    const prone = s.sliding
    // Footsteps: a soft squeak a stride, left and right a touch apart.
    if (live && grounded && !prone && speed > 1.5 && dt > 0) {
      this.stepAt += dt * speed * 0.62
      if (this.stepAt >= 1) {
        this.stepAt -= 1
        this.stepSide ^= 1
        v.toneAt(t + 0.004, 880 + this.stepSide * 140, 0.04, 0.022, { type: 'triangle', to: 700, pan: this.stepSide ? 0.08 : -0.08 })
        v.noiseAt(t + 0.004, 0.02, 0.012, { type: 'highpass', freq: 3000 })
      }
    } else this.stepAt = 0.6
    if (this.slide) {
      const want = live && prone && grounded ? Math.min(0.16, 0.03 + speed * 0.012) : 0
      this.slide.gain.gain.setTargetAtTime(want, t, 0.05)
      this.slide.band.frequency.setTargetAtTime(500 + speed * 70, t, 0.08)
    }
    if (this.wind) {
      let duty = 0
      if (live && b) for (const vol of run!.course.volumes) if (vol.kind === 'wind' && inside(vol, b.x, b.y + 0.7, b.z)) duty = Math.max(duty, vol.duty(run!.t))
      this.wind.gain.gain.setTargetAtTime(duty * 0.14, t, 0.1)
    }
  }

  dispose() {
    const audio = this.audio
    const level = this.level
    const loops = [this.slide, this.wind]
    this.v = null
    this.audio = null
    this.level = null
    this.slide = this.wind = null
    if (!audio || !level) return
    level.gain.setTargetAtTime(0, audio.currentTime, 0.03)
    // Let the fade finish before the loops stop, so leaving doesn't click.
    window.setTimeout(() => {
      for (const l of loops) {
        try {
          l?.src.stop()
        } catch {
          /* already stopped */
        }
      }
      level.disconnect()
    }, 200)
  }
}

function inside(v: Volume & { kind: 'wind' }, x: number, y: number, z: number) {
  return Math.abs(x - v.x) <= v.hx && Math.abs(y - v.y) <= v.hy && Math.abs(z - v.z) <= v.hz
}
