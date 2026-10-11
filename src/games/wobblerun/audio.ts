import { soundOut } from '../../lib/sound'
import { makeVoices, noiseBuffer, type Voices } from '../../lib/soundPacks/voices'
import { hazardBodies, newBody, newPose, solidPose } from './engine/sim.ts'
import type { Body, Course, Run, SimEvent, Volume } from './engine/types.ts'
import { keyNotes } from './scene/notes.ts'

/*
 * Wobble Run's sounds, made as they're needed (no samples): hops and boings, bonks and the crowd's "ooh", the
 * goo's splat and its "aww", the whoosh of a dive and a belly slide, a chime at each checkpoint a note higher
 * than the last (C, E, G, high C), and the crown's fanfare. The telegraphs have their sound too, the second
 * warning design-final §6 #4 asks for: a door's ding-ding before it shuts, a glove's rattle in its wind-up, a
 * cannon's thoomp, a chute's thunk, a fan's whine; each panned to where it is across the track (screen right is
 * −x) and quieter the further off it is.
 *
 * Gen 2's things sound too: a whack mallet creaks in its wind-up, swooshes and lands with a big rubbery WHACK; a
 * plunger ratchets back and sproings out; a geyser rumbles and bubbles, then whooshes; piano keys play their notes
 * (loud when Blip lands on one, soft as one sinks, so a run of sinking keys plays the tune); a flipper clacks; a
 * trampoline boings (higher for a perfect bounce); a steel ball rumbles as it rolls near, a lift hums as it moves
 * and dings before it turns, a geyser fizzes while it's up, and each sprinkle whistles down and lands with a plonk.
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

type Loop = { src: AudioBufferSourceNode; band: BiquadFilterNode; gain: GainNode; pan: StereoPannerNode | null }

/** What the continuous layer needs each frame. `on`: a run is live (not a card, a pause, or past the crown). */
export type RunSoundState = { speed: number; grounded: boolean; sliding: boolean; on: boolean; run?: Run | null }

/** What a course has that sounds on its own, found once a course. */
type Sounding = {
  course: Course
  notes: Map<number, number>
  sprinkles: number[]
  pinballs: number[]
  lifts: number[]
  tableBumpers: Set<number>
  geysers: { x: number; y: number; z: number; on: (t: number) => number }[]
  /** Sprinkle releases heard so far (`hazard·100000 + release`): where each was, whether it's whistled, landed, falling. */
  heard: Map<number, { y: number; whistled: boolean; landed: boolean; seen: number; falling: boolean }>
  frame: number
  /** Whether each lift was moving at the last frame (for the ding as it stops). */
  moving: Map<number, boolean>
}

const BODIES: Body[] = [newBody()]
const POSE = newPose()

export class RunSound {
  private audio: AudioContext | null = null
  private level: GainNode | null = null
  private v: Voices | null = null
  private slide: Loop | null = null
  private wind: Loop | null = null
  /** Gen 2's continuous layer: a steel ball rolling, a lift's motor, a geyser's fizz. */
  private roll: Loop | null = null
  private hum: Loop | null = null
  private fizz: Loop | null = null
  private sounding: Sounding | null = null
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
      this.roll = this.loop('lowpass', 240, 0.9, true)
      this.hum = this.loop('bandpass', 150, 5, true)
      this.fizz = this.loop('highpass', 3400, 0.7, true)
    } catch {
      this.failed = true
    }
  }

  /** A looped noise, filtered (and panned, if asked), its gain at nothing until update() lifts it. */
  private loop(type: BiquadFilterType, freq: number, Q: number, panned = false): Loop {
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
    let pan: StereoPannerNode | null = null
    if (panned) {
      pan = audio.createStereoPanner()
      gain.connect(pan)
      pan.connect(this.level!)
    } else gain.connect(this.level!)
    src.start()
    return { src, band, gain, pan }
  }

  /** What a course has that sounds on its own (found the first time it's asked). */
  private soundsOf(course: Course): Sounding {
    if (this.sounding?.course === course) return this.sounding
    const tables = course.solids.filter((s) => s.look === 'table')
    const onTable = (x: number, z: number) => tables.some((s) => Math.abs(x - s.x) <= s.hx + 0.5 && Math.abs(z - s.z) <= Math.max(s.hz, s.hx) + 0.5)
    const s: Sounding = {
      course,
      notes: keyNotes(course),
      sprinkles: [],
      pinballs: [],
      lifts: [],
      tableBumpers: new Set(),
      geysers: [],
      heard: new Map(),
      frame: 0,
      moving: new Map(),
    }
    course.hazards.forEach((h, i) => {
      if (h.look === 'sprinkle' && h.path) s.sprinkles.push(i)
      else if (h.look === 'pinball') s.pinballs.push(i)
      else if (h.look === 'bumper' && !h.move && onTable(h.x, h.z)) s.tableBumpers.add(i)
    })
    course.solids.forEach((so, i) => {
      if (so.look === 'lift') s.lifts.push(i)
      else if (so.look === 'geyser-vent' && so.bounce?.lit) {
        const lit = so.bounce.lit
        s.geysers.push({ x: so.x, y: so.y, z: so.z, on: (t) => (lit(t) ? 1 : 0) })
      }
    })
    for (const v of course.volumes) if (v.kind === 'wind' && v.look === 'geyser') s.geysers.push({ x: v.x, y: v.y, z: v.z, on: v.duty })
    this.sounding = s
    return s
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
        case 'land': {
          // A piano key plays its note; anything else thuds.
          const note = this.soundsOf(run.course).notes.get(e.i)
          if (note !== undefined) this.piano(t, note, 1, 0)
          else if (e.v > 3) {
            v.toneAt(t, 150, 0.09, Math.min(0.16, 0.04 + e.v * 0.008), { to: 80 })
            v.noiseAt(t, 0.05, 0.04, { type: 'lowpass', freq: 900 })
            if (e.v > 10) v.toneAt(t, 760, 0.07, 0.035, { type: 'triangle', to: 520 })
          }
          break
        }
        case 'slide':
          v.noiseAt(t, 0.42, 0.11, { type: 'bandpass', freq: 950, to: 380, Q: 0.8 })
          v.toneAt(t, 540, 0.2, 0.04, { type: 'triangle', to: 360 })
          break
        case 'bonk':
          // A rubber boing (a pinball bumper's with its bell).
          v.toneAt(t, 430, 0.42, 0.14, { to: 170, slideTime: 0.3, vib: { rate: 22, depth: 35 }, pan })
          if (this.soundsOf(run.course).tableBumpers.has(e.i)) {
            v.fmAt(t + 0.01, 1567.98, 0.34, 0.05, { ratio: 3.5, index: 1.3, indexTime: 0.07, pan })
            v.fmAt(t + 0.06, 2093, 0.3, 0.035, { ratio: 3.5, index: 1.2, indexTime: 0.06, pan })
          }
          break
        case 'knock': {
          v.toneAt(t, 175, 0.18, 0.17, { type: 'square', to: 70, filter: { freq: 1300 }, pan })
          v.noiseAt(t, 0.09, 0.12, { type: 'lowpass', freq: 1700, pan })
          // A whack mallet's squeak, like a toy hammer's; a plunger's sproing.
          const look = run.course.hazards[e.i]?.look ?? ''
          if (look === 'mallet') v.toneAt(t + 0.02, 1350, 0.2, 0.05, { type: 'triangle', to: 2500, slideTime: 0.07, vib: { rate: 30, depth: 60 }, pan })
          else if (look.startsWith('plunger')) v.toneAt(t + 0.01, 240, 0.4, 0.07, { type: 'triangle', to: 620, slideTime: 0.06, vib: { rate: 24, depth: 70 }, pan })
          this.crowd(t + 0.12, 'ooh')
          break
        }
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
        case 'perfectBounce': {
          const perfect = e.k === 'perfectBounce'
          const look = run.course.solids[e.i]?.look
          if (look === 'trampoline') this.trampoline(t, perfect)
          else if (look === 'flipper') this.flipperLaunch(t, perfect, pan)
          else if (look === 'geyser-vent') this.geyserLaunch(t, perfect)
          else if (!perfect) v.toneAt(t, 200, 0.34, 0.14, { to: 560, slideTime: 0.12, vib: { rate: 14, depth: 25, delay: 0.1 } })
          else v.toneAt(t, 260, 0.38, 0.14, { to: 760, slideTime: 0.12, vib: { rate: 14, depth: 30, delay: 0.1 } })
          if (perfect) {
            v.fmAt(t + 0.08, 1318.5, 0.35, 0.06, { ratio: 3.5, index: 1.4, indexTime: 0.15 })
            v.fmAt(t + 0.16, 1568, 0.4, 0.06, { ratio: 3.5, index: 1.4, indexTime: 0.15 })
          }
          break
        }
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
          this.cue(e, t, pan, far, run)
          break
        default:
          break
      }
    }
  }

  /** A telegraph changing phase near the bean: the sound that warns of it. */
  private cue(e: SimEvent, t: number, pan: number, far: number, run: Run) {
    const v = this.v!
    const look = String(e.look ?? '')
    const state = e.state
    const g = far
    if (look === 'mallet') {
      if (state === 'warn' && this.may('mallet-warn', 0.3)) {
        // The wind-up's wooden creak.
        v.noiseAt(t, 0.5, 0.045 * g, { type: 'bandpass', freq: 650, to: 1150, Q: 9, attack: 0.12, pan })
        v.toneAt(t + 0.05, 190, 0.45, 0.02 * g, { type: 'sawtooth', to: 240, filter: { freq: 800 }, vib: { rate: 11, depth: 14 }, attack: 0.1, pan })
      } else if (state === 'act' && this.may('mallet-act', 0.12)) v.noiseAt(t, 0.22, 0.07 * g, { type: 'bandpass', freq: 500, to: 2000, Q: 1.3, pan })
      else if (state === 'hold' && this.may('mallet-hold', 0.1)) {
        // The WHACK on the floor: a big rubbery thump, a smack, a wobble.
        v.toneAt(t, 150, 0.3, 0.2 * g, { to: 46, pan })
        v.noiseAt(t, 0.15, 0.15 * g, { type: 'lowpass', freq: 2000, to: 280, pan })
        v.toneAt(t + 0.012, 330, 0.42, 0.08 * g, { type: 'triangle', to: 135, slideTime: 0.32, vib: { rate: 17, depth: 38 }, pan })
      }
    } else if (look.startsWith('plunger')) {
      if (state === 'warn' && this.may('plunger-warn', 0.2)) {
        // The ratchet pulling it back.
        for (let k = 0; k < 6; k++) v.noiseAt(t + k * 0.085, 0.022, (0.03 + k * 0.004) * g, { type: 'bandpass', freq: 3400, Q: 4, pan })
      } else if (state === 'act' && this.may('plunger-act', 0.1)) {
        // Sproing, and a thunk at full reach.
        v.toneAt(t, 170, 0.5, 0.1 * g, { type: 'triangle', to: 560, slideTime: 0.07, vib: { rate: 24, depth: 85 }, pan })
        v.noiseAt(t, 0.05, 0.06 * g, { type: 'bandpass', freq: 2600, pan })
        v.toneAt(t + 0.1, 110, 0.12, 0.08 * g, { to: 60, pan })
      }
    } else if (look === 'geyser' || look === 'geyser-vent') {
      if (state === 'warn' && this.may('geyser-warn', 0.3)) {
        // A rumble under the vent and bubbles coming up.
        v.noiseAt(t, 0.7, 0.07 * g, { type: 'lowpass', freq: 150, to: 420, attack: 0.35, pan })
        for (let k = 0; k < 6; k++) {
          const f = 280 + Math.random() * 420
          v.toneAt(t + 0.1 + k * 0.09 + Math.random() * 0.04, f, 0.06, 0.028 * g, { to: f * 1.9, pan })
        }
      } else if (state === 'act' && this.may('geyser-act', 0.25)) {
        // Whoosh, and the fizz.
        v.noiseAt(t, 0.9, 0.11 * g, { type: 'bandpass', freq: 380, to: 2400, Q: 0.9, attack: 0.04, pan })
        v.noiseAt(t + 0.05, 1.1, 0.045 * g, { type: 'highpass', freq: 4600, attack: 0.1, pan })
      }
    } else if (look === 'flipper') {
      if (state === 'act' && this.may('flipper-act', 0.08)) {
        // The solenoid's clack.
        v.noiseAt(t, 0.03, 0.08 * g, { type: 'bandpass', freq: 1800, Q: 2, pan })
        v.toneAt(t, 95, 0.07, 0.09 * g, { type: 'square', to: 60, filter: { freq: 700 }, pan })
      } else if (state === 'warn' && this.may('flipper-warn', 0.3)) v.fmAt(t, 1760, 0.08, 0.03 * g, { ratio: 3, index: 1, indexTime: 0.03, pan })
    } else if (look === 'lift') {
      // A soft two-note chime before a lift near you turns.
      if (state === 'warn' && Math.hypot(e.x - run.bean.x, e.z - run.bean.z) < 10 && this.may('lift-warn', 0.4)) {
        v.fmAt(t, 1046.5, 0.5, 0.035 * g, { ratio: 3.5, index: 1, indexTime: 0.1, pan })
        v.fmAt(t + 0.16, 784, 0.6, 0.035 * g, { ratio: 3.5, index: 1, indexTime: 0.1, pan })
      }
    } else if (look === 'key-white' || look === 'key-black') {
      // A key sinking plays its note softly: a run of them plays the tune.
      // (A key laid as two boxes cues twice: once a note.)
      const note = e.what === 'solid' ? this.soundsOf(run.course).notes.get(e.i) : undefined
      if (state === 'act' && note !== undefined && this.may(`key-${note}`, 0.25)) this.piano(t, note, 0.3 * g, pan)
    } else if (look === 'kicker') {
      if (state === 'act' && this.may('kicker-act', 0.1)) {
        v.noiseAt(t, 0.04, 0.08 * g, { type: 'bandpass', freq: 2200, Q: 3, pan })
        v.toneAt(t, 300, 0.12, 0.06 * g, { type: 'square', to: 120, filter: { freq: 1200 }, pan })
      }
    } else if (look === 'sprinkle' || look === 'pinball' || look === 'trampoline' || look === 'table') {
      // Their sounds are their own (update's whistles and rumbles, the bounces).
    } else if (look === 'door') {
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

  /** A toy piano's note, `note` semitones up from middle C: the hammer's strike settling to its tone, a tine's ring, a tick. */
  private piano(t: number, note: number, gain: number, pan: number) {
    const v = this.v!
    const f = 261.63 * Math.pow(2, Math.max(-12, Math.min(36, note)) / 12)
    v.fmAt(t, f, 1.1, 0.12 * gain, { ratio: 1, index: 1.4, indexTime: 0.12, pan })
    v.fmAt(t, f * 2, 0.5, 0.032 * gain, { ratio: 3.5, index: 0.9, indexTime: 0.05, pan })
    v.toneAt(t, f * 4.07, 0.09, 0.012 * gain, { pan })
    v.noiseAt(t, 0.016, 0.02 * gain, { type: 'highpass', freq: 4200, pan })
  }

  /** A trampoline throwing Blip: the mat's thump, its springs, a big boing (higher for a perfect bounce). */
  private trampoline(t: number, perfect: boolean) {
    const v = this.v!
    v.toneAt(t, 82, 0.16, 0.1, { to: 55 })
    v.noiseAt(t, 0.12, 0.045, { type: 'bandpass', freq: 1300, to: 3200, Q: 6 })
    v.toneAt(t, perfect ? 190 : 150, 0.5, 0.15, { to: perfect ? 820 : 520, slideTime: 0.16, vib: { rate: 12, depth: perfect ? 40 : 28, delay: 0.12 } })
  }

  /** A flipper launching Blip: its clack and a rising "fwip". */
  private flipperLaunch(t: number, perfect: boolean, pan: number) {
    const v = this.v!
    v.noiseAt(t, 0.03, 0.09, { type: 'bandpass', freq: 1800, Q: 2, pan })
    v.toneAt(t, 95, 0.07, 0.1, { type: 'square', to: 60, filter: { freq: 700 }, pan })
    v.toneAt(t + 0.02, 260, 0.32, 0.08, { type: 'triangle', to: perfect ? 1300 : 900, slideTime: 0.22 })
  }

  /** A geyser carrying Blip up: a whoosh of soda, its fizz, a "whee" rising. */
  private geyserLaunch(t: number, perfect: boolean) {
    const v = this.v!
    v.noiseAt(t, 0.7, 0.12, { type: 'bandpass', freq: 500, to: 2600, Q: 0.8, attack: 0.03 })
    v.noiseAt(t, 0.9, 0.05, { type: 'highpass', freq: 4800, attack: 0.05 })
    v.toneAt(t, 220, 0.45, 0.07, { type: 'triangle', to: perfect ? 900 : 700, slideTime: 0.4, vib: { rate: 20, depth: 30 } })
  }

  /**
   * Gen 2's continuous sounds, each frame: every sprinkle near Blip whistles as it falls and plonks as it lands; the
   * nearest rolling steel ball rumbles, the nearest moving lift hums (and chimes as it stops), the nearest geyser
   * fizzes while it's up. All quiet when no run is live.
   */
  private gen2(t: number, live: boolean, run: Run | null) {
    const v = this.v!
    const quiet = (l: Loop | null) => l?.gain.gain.setTargetAtTime(0, t, 0.08)
    if (!live || !run) {
      quiet(this.roll)
      quiet(this.hum)
      quiet(this.fizz)
      return
    }
    const s = this.soundsOf(run.course)
    if (!s.sprinkles.length && !s.pinballs.length && !s.lifts.length && !s.geysers.length) return
    const course = run.course
    const b = run.bean
    const panOf = (x: number) => Math.max(-1, Math.min(1, (b.x - x) / 7))
    s.frame++
    for (const hi of s.sprinkles) {
      const h = course.hazards[hi]!
      if (h.z1 < b.z - 12 || h.z0 > b.z + 30) continue
      const n = hazardBodies(h, run.t, BODIES)
      for (let k = 0; k < n; k++) {
        const body = BODIES[k]!
        if (!body.on) continue
        const key = hi * 100000 + body.k
        let st = s.heard.get(key)
        const fresh = !st
        if (!st) s.heard.set(key, (st = { y: body.y, whistled: false, landed: false, seen: s.frame, falling: false }))
        st.seen = s.frame
        const d = Math.hypot(body.x - b.x, body.z - b.z)
        const near = Math.max(0, 1 - d / 22)
        const above = body.y - b.y
        // One just let go high up whistles down.
        if (!st.whistled && body.tau < 0.6 && above > 2.5 && near > 0 && this.may('sprinkle-whistle', 0.18)) {
          const fall = Math.max(0.4, Math.min(1.5, Math.sqrt((2 * Math.max(1, above)) / 20)))
          v.toneAt(t + 0.004, 1800, fall, 0.022 * near, { to: 620, slideTime: fall, attack: 0.12, vib: { rate: 7, depth: 12 }, pan: panOf(body.x) })
          st.whistled = true
        }
        // It lands: a falling one stops (one body all the way down), or one is born at the deck (a round that hands
        // each sprinkle on to a lying body as it lands).
        const landing = (st.falling && body.y >= st.y - 1e-4) || (fresh && body.tau < 0.15 && above < 1.2)
        st.falling = body.y < st.y - 0.005
        if (!st.landed && landing) {
          st.landed = true
          if (near > 0 && this.may('sprinkle-plonk', 0.06)) {
            const p = panOf(body.x)
            v.toneAt(t + 0.004, 520, 0.12, 0.1 * near, { type: 'triangle', to: 220, pan: p })
            v.noiseAt(t + 0.004, 0.04, 0.05 * near, { type: 'lowpass', freq: 1500, pan: p })
            v.fmAt(t + 0.01, 1318.5, 0.15, 0.03 * near, { ratio: 4.2, index: 1.5, indexTime: 0.03, pan: p })
          }
        }
        st.y = body.y
      }
    }
    for (const [key, st] of s.heard) if (s.frame - st.seen > 30) s.heard.delete(key)
    // The nearest steel ball rolling.
    let best = 14
    let bx = 0
    for (const hi of s.pinballs) {
      const h = course.hazards[hi]!
      if (h.z1 < b.z - 14 || h.z0 > b.z + 14) continue
      const n = hazardBodies(h, run.t, BODIES)
      for (let k = 0; k < n; k++) {
        const body = BODIES[k]!
        const d = Math.hypot(body.x - b.x, body.y - b.y, body.z - b.z)
        if (body.on && d < best) {
          best = d
          bx = body.x
        }
      }
    }
    if (this.roll) {
      this.roll.gain.gain.setTargetAtTime(best < 14 ? 0.12 * (1 - best / 14) : 0, t, 0.08)
      this.roll.pan?.pan.setTargetAtTime(panOf(bx), t, 0.08)
    }
    // The nearest moving lift's motor, and a chime as one near you stops.
    let hum = 0
    let hx = 0
    let speed = 0
    for (const si of s.lifts) {
      const so = course.solids[si]!
      if (Math.abs(so.z - b.z) > 12) continue
      solidPose(course, run.world, si, run.t, POSE)
      const y = POSE.y
      const px = POSE.x
      const pz = POSE.z
      solidPose(course, run.world, si, run.t - 0.05, POSE)
      const vy = (y - POSE.y) / 0.05
      const d = Math.hypot(px - b.x, pz - b.z)
      const moving = Math.abs(vy) > 0.08
      if (moving && d < 9 && 1 - d / 9 > hum) {
        hum = 1 - d / 9
        hx = px
        speed = Math.abs(vy)
      }
      if (!moving && s.moving.get(si) && d < 9 && !so.tele && this.may('lift-stop', 0.3)) v.fmAt(t + 0.004, 1046.5, 0.4, 0.03 * (1 - d / 9), { ratio: 3.5, index: 1, indexTime: 0.08, pan: panOf(px) })
      s.moving.set(si, moving)
    }
    if (this.hum) {
      this.hum.gain.gain.setTargetAtTime(0.07 * hum, t, 0.1)
      this.hum.band.frequency.setTargetAtTime(120 + speed * 35, t, 0.1)
      this.hum.pan?.pan.setTargetAtTime(panOf(hx), t, 0.1)
    }
    // The nearest geyser's fizz while it's up.
    let fz = 0
    let fx = 0
    for (const gz of s.geysers) {
      const d = Math.hypot(gz.x - b.x, gz.z - b.z)
      if (d > 12) continue
      const k = gz.on(run.t) * (1 - d / 12)
      if (k > fz) {
        fz = k
        fx = gz.x
      }
    }
    if (this.fizz) {
      this.fizz.gain.gain.setTargetAtTime(0.09 * fz, t, 0.06)
      this.fizz.pan?.pan.setTargetAtTime(panOf(fx), t, 0.06)
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
      // A geyser's column is its own sound (the fizz), not a fan's wind.
      if (live && b) for (const vol of run!.course.volumes) if (vol.kind === 'wind' && vol.look !== 'geyser' && inside(vol, b.x, b.y + 0.7, b.z)) duty = Math.max(duty, vol.duty(run!.t))
      this.wind.gain.gain.setTargetAtTime(duty * 0.14, t, 0.1)
    }
    this.gen2(t, live, run)
  }

  dispose() {
    const audio = this.audio
    const level = this.level
    const loops = [this.slide, this.wind, this.roll, this.hum, this.fizz]
    this.v = null
    this.audio = null
    this.level = null
    this.slide = this.wind = this.roll = this.hum = this.fizz = null
    this.sounding = null
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
