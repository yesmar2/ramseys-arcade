import { makeVoices, noiseBuffer, type Fx } from './soundPacks/voices'

/*
 * The four pieces of music, one for each kind of game, played under it by
 * music.ts. Each is a sixteen-step loop over a few bars, written out for a
 * small kit of synthesized instruments, the same voices the Neon and Toybox
 * sound sets are made of.
 */

/** 'A4', 'C#5', 'Bb3' in Hz. */
export function noteHz(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name)
  if (!m) return 0
  const semi = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1] as 'C'] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
  return 440 * Math.pow(2, ((Number(m[3]) + 1) * 12 + semi - 69) / 12)
}

const hz = (names: string[]) => names.map(noteHz)

export type MusicKit = ReturnType<typeof makeKit>

export function makeKit(audio: BaseAudioContext, dest: AudioNode, fx: Fx) {
  const P = makeVoices(audio, dest, fx)
  return {
    voices: P,
    kick(t: number, v = 1) {
      P.toneAt(t, 155, 0.32, 0.65 * v, { to: 44, slideTime: 0.22, attack: 0.002 })
      P.noiseAt(t, 0.01, 0.08 * v, { type: 'highpass', freq: 2500 })
    },
    kickSoft(t: number, v = 1) {
      P.toneAt(t, 120, 0.26, 0.6 * v, { to: 48, slideTime: 0.18, attack: 0.004 })
    },
    chipKick(t: number, v = 1) {
      P.toneAt(t, 180, 0.11, 0.7 * v, { type: 'triangle', to: 55, slideTime: 0.09, attack: 0.001 })
    },
    snare(t: number, v = 1, verb = 0.2) {
      P.noiseAt(t, 0.2, 0.22 * v, { type: 'bandpass', freq: 1800, Q: 0.55, verb })
      P.toneAt(t, 200, 0.09, 0.16 * v, { type: 'triangle', to: 160 })
    },
    snareSoft(t: number, v = 1) {
      P.noiseAt(t, 0.14, 0.12 * v, { type: 'bandpass', freq: 1500, Q: 0.7, verb: 0.15 })
      P.noiseAt(t, 0.05, 0.05 * v, { type: 'lowpass', freq: 3000 })
    },
    chipSnare(t: number, v = 1) {
      P.noiseAt(t, 0.09, 0.23 * v, { type: 'bandpass', freq: 2600, Q: 0.8 })
    },
    hat(t: number, v = 1, open = false) {
      P.noiseAt(t, open ? 0.22 : 0.04, 0.09 * v, { type: 'highpass', freq: 7800, Q: 0.7 })
    },
    bassSaw(t: number, f: number, dur: number, v = 1) {
      P.toneAt(t, f, dur, 0.36 * v, {
        type: 'sawtooth',
        unison: 6,
        attack: 0.004,
        filter: { type: 'lowpass', freq: 1100, to: 260, time: dur * 0.9, Q: 3 },
      })
    },
    bassTri(t: number, f: number, dur: number, v = 1) {
      P.toneAt(t, f, dur, 0.1 * v, { type: 'triangle', attack: 0.003, hold: dur * 0.5 })
    },
    bassSoft(t: number, f: number, dur: number, v = 1) {
      P.toneAt(t, f, dur, 0.16 * v, { attack: 0.01, hold: dur * 0.4 })
      P.toneAt(t, f * 2, dur * 0.8, 0.032 * v, { type: 'triangle', attack: 0.01 })
    },
    pad(t: number, fs: number[], dur: number, v = 1) {
      for (const f of fs) {
        P.toneAt(t, f, dur, 0.05 * v, {
          type: 'sawtooth',
          unison: 9,
          attack: 0.4,
          hold: dur - 1.0,
          filter: { type: 'lowpass', freq: 1300, Q: 0.3 },
          verb: 0.35,
        })
      }
    },
    arp(t: number, f: number, dur: number, v = 1) {
      P.toneAt(t, f, dur, 0.16 * v, {
        type: 'sawtooth',
        attack: 0.003,
        filter: { type: 'lowpass', freq: 3400, to: 1200, time: dur },
        echo: 0.4,
      })
    },
    lead(t: number, f: number, dur: number, v = 1) {
      P.toneAt(t, f, dur, 0.12 * v, {
        type: 'sawtooth',
        unison: 10,
        attack: 0.03,
        hold: dur * 0.6,
        vib: { rate: 5.2, depth: f * 0.006, delay: 0.25 },
        filter: { type: 'lowpass', freq: 2600, Q: 0.6 },
        echo: 0.35,
        verb: 0.2,
      })
    },
    chipLead(t: number, f: number, dur: number, v = 1, echo = 0) {
      P.toneAt(t, f, dur, 0.12 * v, {
        wave: 'pulse25',
        attack: 0.004,
        hold: dur * 0.55,
        filter: { type: 'lowpass', freq: 6000, Q: 0.5 },
        echo,
      })
    },
    chipStab(t: number, fs: number[], dur: number, v = 1) {
      for (const f of fs) P.toneAt(t, f, dur, 0.17 * v, { wave: 'pulse12', attack: 0.002, filter: { type: 'lowpass', freq: 4000 } })
    },
    keys(t: number, fs: number[], dur: number, v = 1) {
      // Rolled a touch, low note first, the way a hand plays a chord.
      fs.forEach((f, k) =>
        P.fmAt(t + k * 0.014, f, dur, 0.17 * v, { ratio: 1, index: 1.1, indexTime: 0.9, attack: 0.008, verb: 0.22 }),
      )
    },
    bell(t: number, f: number, dur: number, v = 1) {
      P.fmAt(t, f, dur, 0.1 * v, { ratio: 3.5, index: 1.3, indexTime: dur * 0.4, attack: 0.003, verb: 0.4 })
    },
  }
}

export type TrackId = 'night' | 'pocket' | 'paper' | 'pond'

export type Track = {
  id: TrackId
  name: string
  bpm: number
  bars: number
  /** How late the odd sixteenths land, as a share of a sixteenth. */
  swing: number
  /** Its level under the games, measured so the four sit alike, well under the sounds. */
  level: number
  /** Whatever runs the whole time (a drone, water, record hiss), and how to stop it. */
  setup?: (audio: BaseAudioContext, dest: AudioNode, t: number) => () => void
  step: (kit: MusicKit, bar: number, i: number, t: number, sixteenth: number) => void
}

/* ---------- Night Drive: synthwave in A minor ---------- */

const NIGHT_BARS = ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G', 'Am', 'Am', 'F', 'G', 'C', 'G'] as const
const NIGHT_CHORDS = {
  Am: { bass: noteHz('A2'), pad: hz(['A3', 'C4', 'E4']), arp: hz(['A4', 'C5', 'E5', 'A5']) },
  F: { bass: noteHz('F2'), pad: hz(['F3', 'A3', 'C4']), arp: hz(['F4', 'A4', 'C5', 'F5']) },
  C: { bass: noteHz('C3'), pad: hz(['G3', 'C4', 'E4']), arp: hz(['G4', 'C5', 'E5', 'G5']) },
  G: { bass: noteHz('G2'), pad: hz(['G3', 'B3', 'D4']), arp: hz(['G4', 'B4', 'D5', 'G5']) },
}
/** Bar → [step, note, sixteenths]: the lead that comes in halfway. */
const NIGHT_LEAD: Record<number, [number, string, number][]> = {
  8: [[0, 'C5', 8], [8, 'A4', 8]],
  9: [[0, 'B4', 8], [8, 'D5', 8]],
  10: [[0, 'E5', 16]],
  11: [[0, 'E5', 8], [8, 'D5', 4], [12, 'C5', 4]],
  12: [[0, 'A4', 8], [8, 'C5', 8]],
  13: [[0, 'D5', 8], [8, 'B4', 8]],
  14: [[0, 'C5', 8], [8, 'E5', 8]],
  15: [[0, 'D5', 8], [8, 'B4', 4], [12, 'G4', 4]],
}
const NIGHT_ARP = [0, 1, 2, 3, 2, 1, 2, 3]

/* ---------- Pocket Change: chiptune pop in C major ---------- */

const POCKET_BARS = ['C', 'Am', 'F', 'G', 'C', 'Am', 'FG', 'C'] as const
const POCKET_CHORDS = {
  C: { root: noteHz('C3'), fifth: noteHz('G3'), stab: hz(['E4', 'G4', 'C5']) },
  Am: { root: noteHz('A2'), fifth: noteHz('E3'), stab: hz(['E4', 'A4', 'C5']) },
  F: { root: noteHz('F2'), fifth: noteHz('C3'), stab: hz(['F4', 'A4', 'C5']) },
  G: { root: noteHz('G2'), fifth: noteHz('D3'), stab: hz(['D4', 'G4', 'B4']) },
}
/** The tune, an eighth note a word: '.' rests, '-' holds the note before. */
const POCKET_TUNE = [
  'E5 G5 C6 G5 A5 G5 E5 .',
  'A4 C5 E5 A5 G5 E5 C5 .',
  'F5 A5 C6 A5 G5 F5 D5 .',
  'G5 . B5 . D6 . B5 G5',
  'E5 G5 C6 G5 A5 G5 E5 G5',
  'A5 . G5 E5 C5 . E5 G5',
  'F5 A5 C6 . B5 . G5 .',
  'C6 . G5 . C6 - - .',
].map((bar) => {
  const notes: [number, number, number][] = []
  bar.split(' ').forEach((word, k) => {
    const last = notes[notes.length - 1]
    if (word === '-') {
      if (last) last[2] += 2
    } else if (word !== '.') notes.push([k * 2, noteHz(word), 2])
  })
  return notes
})

/* ---------- Paper Cranes: lo-fi sevenths in C major ---------- */

const PAPER_BARS = ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7', 'Fmaj7', 'Em7', 'Dm7G7', 'Cmaj7'] as const
const PAPER_CHORDS = {
  Fmaj7: { root: noteHz('F2'), fifth: noteHz('C3'), keys: hz(['A3', 'C4', 'E4', 'G4']) },
  Em7: { root: noteHz('E2'), fifth: noteHz('B2'), keys: hz(['G3', 'B3', 'D4', 'E4']) },
  Dm7: { root: noteHz('D2'), fifth: noteHz('A2'), keys: hz(['F3', 'A3', 'C4', 'E4']) },
  G7: { root: noteHz('G2'), fifth: noteHz('D3'), keys: hz(['F3', 'B3', 'D4', 'G4']) },
  Cmaj7: { root: noteHz('C2'), fifth: noteHz('G2'), keys: hz(['E3', 'G3', 'B3', 'D4']) },
}
const PAPER_BELLS: Record<number, [number, string][]> = {
  0: [[8, 'G5'], [12, 'E5']],
  1: [[8, 'D5'], [10, 'E5'], [12, 'G5']],
  2: [[8, 'A5'], [12, 'G5']],
  3: [[8, 'E5'], [10, 'D5'], [12, 'C5']],
  5: [[8, 'G5'], [10, 'A5'], [12, 'C6']],
  7: [[8, 'B4'], [12, 'C5']],
}

export const TRACKS: Record<TrackId, Track> = {
  night: {
    id: 'night',
    name: 'Night Drive',
    bpm: 104,
    bars: 16,
    swing: 0,
    level: 0.3,
    step(K, bar, i, t, S) {
      const c = NIGHT_CHORDS[NIGHT_BARS[bar]!]
      if (i === 0 || i === 8 || (bar % 2 === 1 && i === 10)) K.kick(t)
      if (i === 4 || i === 12) K.snare(t, 1, 0.45)
      if (i % 2 === 0) K.hat(t, i % 4 === 2 ? 0.9 : 0.5)
      if (i === 14 && bar % 2 === 1) K.hat(t, 0.6, true)
      // Driving eighths, jumping the octave on the off-beats.
      if (i % 2 === 0) K.bassSaw(t, c.bass * (i % 4 === 2 ? 2 : 1), S * 1.8, i % 4 === 0 ? 1 : 0.8)
      if (i === 0) K.pad(t, c.pad, S * 16)
      if (bar >= 4) K.arp(t, c.arp[NIGHT_ARP[i % 8]!]!, S * 1.6, bar >= 8 ? 0.7 : 1)
      for (const [at, note, len] of NIGHT_LEAD[bar] ?? []) if (at === i) K.lead(t, noteHz(note), S * len)
    },
  },
  pocket: {
    id: 'pocket',
    name: 'Pocket Change',
    bpm: 132,
    bars: 16,
    swing: 0,
    level: 0.41,
    step(K, bar, i, t, S) {
      const b = bar % 8
      const second = bar >= 8
      const name = POCKET_BARS[b] === 'FG' ? (i < 8 ? 'F' : 'G') : POCKET_BARS[b]!
      const c = POCKET_CHORDS[name as keyof typeof POCKET_CHORDS]
      if (i === 0 || i === 8 || ((b === 3 || b === 7) && i === 14)) K.chipKick(t)
      if (i === 4 || i === 12) K.chipSnare(t)
      // Second time round, the hats double up.
      if (i % 4 === 2 || (second && i % 2 === 1)) K.hat(t, i % 4 === 2 ? 0.6 : 0.3)
      const bass = ({ 0: c.root, 4: c.fifth, 8: c.root * 2, 12: c.fifth } as Record<number, number>)[i]
      if (bass) K.bassTri(t, bass, S * 3)
      if (i % 4 === 2) K.chipStab(t, c.stab, S * 1.2)
      for (const [at, f, len] of POCKET_TUNE[b]!) if (at === i) K.chipLead(t, f, S * len * 0.92, 1, second ? 0.18 : 0)
    },
  },
  paper: {
    id: 'paper',
    name: 'Paper Cranes',
    bpm: 80,
    bars: 8,
    swing: 0.22,
    level: 0.41,
    setup(audio, dest, t) {
      // The hiss of a record under it all.
      const hiss = audio.createBufferSource()
      hiss.buffer = noiseBuffer(audio)
      hiss.loop = true
      const tone = audio.createBiquadFilter()
      tone.type = 'lowpass'
      tone.frequency.value = 4200
      const g = audio.createGain()
      g.gain.value = 0.012
      hiss.connect(tone)
      tone.connect(g)
      g.connect(dest)
      hiss.start(t)
      return () => {
        try {
          hiss.stop()
        } catch {
          /* never started */
        }
      }
    },
    step(K, bar, i, t, S) {
      const split = PAPER_BARS[bar] === 'Dm7G7'
      const name = split ? (i < 8 ? 'Dm7' : 'G7') : PAPER_BARS[bar]!
      const c = PAPER_CHORDS[name as keyof typeof PAPER_CHORDS]
      if (i === 0 || i === 10 || (bar % 2 === 1 && i === 7)) K.kickSoft(t, i === 0 ? 1 : 0.7)
      if (i === 4 || i === 12) K.snareSoft(t)
      if (i % 2 === 0) K.hat(t, 0.28 + Math.random() * 0.14)
      if (i === 0 || (split && i === 8)) K.keys(t, c.keys, S * 7, 0.9)
      if (i === 6 && !split) K.keys(t, c.keys, S * 5, 0.55)
      if (i === 0) K.bassSoft(t, c.root, S * 7)
      if (i === 10 && !split) K.bassSoft(t, c.fifth, S * 4, 0.8)
      for (const [at, note] of PAPER_BELLS[bar] ?? []) if (at === i) K.bell(t, noteHz(note), 1.4)
      // Dust on the record.
      if (Math.random() < 0.08) {
        K.voices.noiseAt(t + Math.random() * S, 0.004, 0.02 + Math.random() * 0.04, { type: 'highpass', freq: 2200 })
      }
    },
  },
  pond: {
    id: 'pond',
    name: 'Pond at Dusk',
    bpm: 60,
    bars: 8,
    swing: 0,
    level: 0.9,
    setup(audio, dest, t) {
      const nodes: AudioScheduledSourceNode[] = []
      // A low hum on C, its fifth, ninth and third, slowly opening and closing.
      const drone = audio.createGain()
      drone.gain.value = 0.0001
      drone.gain.setValueAtTime(0.0001, t)
      drone.gain.exponentialRampToValueAtTime(0.05, t + 3)
      const shade = audio.createBiquadFilter()
      shade.type = 'lowpass'
      shade.frequency.value = 700
      shade.Q.value = 0.4
      const sway = audio.createOscillator()
      sway.frequency.value = 0.07
      const swayDepth = audio.createGain()
      swayDepth.gain.value = 260
      sway.connect(swayDepth)
      swayDepth.connect(shade.frequency)
      drone.connect(shade)
      shade.connect(dest)
      const hum: [number, OscillatorType, number][] = [
        [130.8, 'sine', 0.5],
        [196.0, 'sine', 0.35],
        [293.7, 'triangle', 0.12],
        [329.6, 'sine', 0.16],
      ]
      for (const [f, type, level] of hum) {
        const osc = audio.createOscillator()
        osc.type = type
        osc.frequency.value = f
        const g = audio.createGain()
        g.gain.value = level
        osc.connect(g)
        g.connect(drone)
        osc.start(t)
        nodes.push(osc)
      }
      sway.start(t)
      nodes.push(sway)
      // Water lapping: dark noise that swells and falls.
      const water = audio.createBufferSource()
      water.buffer = noiseBuffer(audio)
      water.loop = true
      const deep = audio.createBiquadFilter()
      deep.type = 'lowpass'
      deep.frequency.value = 500
      const lap = audio.createGain()
      lap.gain.value = 0.02
      const swell = audio.createOscillator()
      swell.frequency.value = 0.13
      const swellDepth = audio.createGain()
      swellDepth.gain.value = 0.012
      swell.connect(swellDepth)
      swellDepth.connect(lap.gain)
      water.connect(deep)
      deep.connect(lap)
      lap.connect(dest)
      water.start(t)
      swell.start(t)
      nodes.push(water, swell)
      return () => {
        for (const node of nodes) {
          try {
            node.stop()
          } catch {
            /* never started */
          }
        }
      }
    },
    step(K, _bar, _i, t) {
      // Crickets, each a few quick chirps from one side or the other.
      if (Math.random() < 0.06) {
        const chirps = 3 + Math.floor(Math.random() * 3)
        const f = 4300 + Math.random() * 500
        const side = (Math.random() * 2 - 1) * 0.7
        for (let k = 0; k < chirps; k++) K.voices.toneAt(t + k * 0.036, f, 0.02, 0.012, { attack: 0.003, pan: side })
      }
      // Now and then a drop into the water, and once in a long while a frog.
      if (Math.random() < 0.012) K.voices.toneAt(t, 900, 0.07, 0.02, { to: 1500, slideTime: 0.05, attack: 0.002, verb: 0.4 })
      if (Math.random() < 0.004) {
        K.voices.toneAt(t, 180, 0.26, 0.025, {
          type: 'square',
          filter: { type: 'lowpass', freq: 700 },
          vib: { rate: 25, depth: 30 },
          pan: -0.5,
        })
      }
    },
  },
}

/** Which music plays under each game. */
const GAME_MUSIC: Record<string, TrackId> = {
  asteroids: 'night',
  barrage: 'night',
  patriot: 'night',
  snake: 'pocket',
  crosswalk: 'pocket',
  pellets: 'pocket',
  crumbtrail: 'pocket',
  pop: 'pocket',
  frenzy: 'pocket',
  bop: 'pocket',
  stacker: 'paper',
  centroid: 'paper',
  putt: 'paper',
  findbug: 'paper',
  spotter: 'paper',
  // A tune to sing back wants no other melody over it: only the pond.
  fireflies: 'pond',
  simon: 'pond',
}

export function trackForGame(slug: string): Track | null {
  const id = GAME_MUSIC[slug]
  return id ? TRACKS[id] : null
}
