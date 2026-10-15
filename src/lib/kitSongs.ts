import { bar, notes, startingAt, type BarNote, type Kit, type Note } from './kit'

/*
 * The newer songs, for the Arcade, Chill and Piano stations (musicStations.ts), played on the band in
 * kit.ts. They began as eight-bar sketches in the Music Lab, where Ramsey heard each one at three
 * energies: Calm, Steady and Full. Here each is a whole song of about two minutes: an A part and a B part
 * with their own chords and tunes, eight bars a section, the energy rising and falling through the form,
 * a riser or a fill into a bigger section and a crash as it lands. A loop that came round every fifteen
 * seconds is what wore the earlier music thin.
 *
 * The piano pieces are long out of copyright, in our own arrangements: Bach (1722), Pachelbel (about
 * 1680), Satie (1888), Beethoven (1810) and Grieg (1875). Each plays through a few times, adding parts.
 */

export type Energy = 1 | 2 | 3

export type KitTrackId =
  | 'groove'
  | 'toypop'
  | 'dash'
  | 'neonmile'
  | 'rush'
  | 'glide'
  | 'lofi'
  | 'bossa'
  | 'still'
  | 'stillair'
  | 'mountain'
  | 'elise'
  | 'canon'
  | 'prelude'
  | 'gymno'

export type KitTrack = {
  engine: 'kit'
  id: KitTrackId
  name: string
  bpm: number
  /** The tempo in a given bar, for a song that speeds up. */
  tempoAt?: (bar: number) => number
  bars: number
  /** Steps a bar: 16, or 6 for 3/8 and 3/4 by eighths. */
  steps?: number
  /** Steps a beat: 4 for sixteenths, 2 for eighths. */
  perBeat?: number
  /** How late the odd steps land, as a share of a step. */
  swing: number
  /** The echo's time, in seconds. */
  echo: number
  /** Its level under the games, set from offline renders against the Game Boy songs. */
  level: number
  /** The song's own level in a bar, for that bar's energy. */
  gainAt: (bar: number) => number
  play: (k: Kit, bar: number, s: number, t: number, sps: number) => void
}

/** One part of a song: chords and bass by bar (a shorter list repeats), and eight bars of tune. */
type Part = {
  ch: Note[][]
  root: Note[]
  lead: BarNote[][]
  fifth?: Note[]
  thumb?: Note[][]
}

/** Where a step falls: the part and the bar within its section, the energy, and what comes next. */
type Place = {
  p: Part
  /** The bar within the section, 0 to 7. */
  b: number
  /** The bar in the whole song. */
  br: number
  E: Energy
  first: boolean
  last: boolean
  /** The next section's energy: a build leads into a bigger one. */
  nextE: Energy
}

type Style = {
  id: KitTrackId
  name: string
  bpm: number
  echo: number
  swing?: number
  parts: { A: Part; B: Part }
  /** Eight-bar sections: the part, then its energy. */
  form: string
  /** Each energy's level from the Music Lab's renders, which set all three to one loudness. */
  levels: readonly [number, number, number]
  play: (k: Kit, x: Place, s: number, t: number, sps: number) => void
}

/** Calm a little under Steady and Full, so a song breathes rather than staying at one loudness. */
const DYNAMICS = [0.8, 0.92, 1] as const
const SECTION = 8

const bright = (E: Energy) => (E === 1 ? 0.55 : E === 2 ? 0.8 : 1)
const chords = (list: string[]) => list.map(notes)
const bars = (list: string[]) => list.map(bar)
const at = <T,>(list: readonly T[], i: number) => list[i % list.length]!

function styleTrack(st: Style, level: number): KitTrack {
  const form = st.form.split(' ').map((w) => ({ part: w[0] as 'A' | 'B', E: Number(w[1]) as Energy }))
  const total = form.length * SECTION
  const sectionOf = (bar: number) => form[Math.floor(bar / SECTION) % form.length]!
  return {
    engine: 'kit',
    id: st.id,
    name: st.name,
    bpm: st.bpm,
    bars: total,
    swing: st.swing ?? 0,
    echo: st.echo,
    level,
    gainAt: (bar) => {
      const E = sectionOf(bar).E
      return st.levels[E - 1] * DYNAMICS[E - 1]
    },
    play: (k, br, s, t, sps) => {
      const i = Math.floor(br / SECTION)
      const sec = form[i % form.length]!
      const b = br % SECTION
      const place: Place = {
        p: st.parts[sec.part],
        b,
        br,
        E: sec.E,
        first: b === 0,
        last: b === SECTION - 1,
        nextE: form[(i + 1) % form.length]!.E,
      }
      st.play(k, place, s, t, sps)
    },
  }
}

/* ---------- Groove: funk and disco, D minor ---------- */

const GROOVE: Style = {
  id: 'groove',
  name: 'Groove',
  bpm: 112,
  echo: 0.4,
  parts: {
    A: {
      ch: chords(['D3 F3 A3 C4', 'D3 F3 A3 C4', 'D3 F3 G3 B3', 'D3 F3 G3 B3', 'D3 F3 A3 C4', 'D3 F3 A3 C4', 'D3 E3 G3 B3', 'E3 G3 A3 C#4']),
      root: notes('D2 D2 G1 G1 D2 D2 E2 A1'),
      lead: bars([
        '0:A4:2 3:C5:1 4:D5:2 8:F5:2 10:E5:2 12:D5:4',
        '0:C5:2 2:A4:2 4:G4:2 6:A4:6 14:C5:2',
        '0:B4:2 3:D5:1 4:F5:2 8:G5:2 10:F5:2 12:D5:4',
        '0:B4:2 2:G4:2 4:F4:2 6:G4:6 14:B4:2',
        '0:A4:2 3:C5:1 4:D5:2 8:F5:2 10:E5:2 12:D5:4',
        '0:C5:2 2:D5:2 4:F5:2 6:A5:6 14:G5:2',
        '0:G5:2 2:E5:2 4:D5:2 6:B4:4 12:D5:4',
        '0:C#5:2 2:E5:2 4:G5:2 6:A5:4 12:G5:2 14:E5:2',
      ]),
    },
    B: {
      ch: chords(['D3 F3 A3 C4', 'D3 F3 A3 C4', 'E3 G3 A3 C4', 'E3 G3 A3 C4', 'D3 F3 G3 Bb3', 'D3 F3 G3 Bb3', 'D3 E3 G3 A3', 'E3 G3 A3 C#4']),
      root: notes('Bb1 Bb1 A1 A1 G1 G1 A1 A1'),
      lead: bars([
        '0:F5:2 3:D5:1 4:F5:2 6:A5:4 12:G5:2 14:F5:2',
        '0:D5:3 3:C5:1 4:D5:2 6:F5:6 14:E5:2',
        '0:E5:2 3:C5:1 4:E5:2 6:G5:4 12:A5:2 14:G5:2',
        '0:E5:4 4:C5:2 6:A4:6 14:Bb4:2',
        '0:D5:2 3:Bb4:1 4:D5:2 6:G5:4 12:F5:2 14:D5:2',
        '0:F5:2 2:G5:2 4:Bb5:2 6:A5:6 14:G5:2',
        '0:A5:2 2:G5:2 4:E5:2 6:D5:6 14:E5:2',
        '0:C#5:2 2:E5:2 4:G5:2 6:A5:6 12:G5:2 14:E5:2',
      ]),
    },
  },
  form: 'A1 A2 A3 B2 B3 A2 A3',
  levels: [0.398, 0.398, 0.395],
  play(k, x, s, t, sps) {
    const { p, b, E } = x
    const ch = at(p.ch, b)
    const root = at(p.root, b)
    const B = bright(E)
    const strum = '.x.xx.x..x.xx.x.'
    if (s % 4 === 0) k.kick(t, 0.8, 50, 0.26)
    if (s % 2 === 0) k.bass(t, root + (s % 4 === 2 ? 24 : 12), sps * 1.5, { type: 'square', cutoff: 380 + 700 * B, env: 1100 * B, q: 4, gain: 0.22, sub: 0.7 })
    if (E === 1 && s === 0) k.keys(t, ch.map((n) => n + 12), sps * 14, { gain: 0.1 })
    if (E >= 2) {
      if (s === 4 || s === 12) k.snare(t, 0.42, 0.12)
      if (s % 4 === 2) k.hat(t, true, 0.13)
      if (s % 2 === 1) k.hat(t, false, 0.05)
      if (strum[s] === 'x') k.strum(t, ch.map((n) => n + 12), { gain: 0.32, mute: 0.06, cutoff: 2600, spread: 0.006, verb: 0.05 })
      if (s === 0 && b % 2 === 0) k.keys(t, ch.map((n) => n + 12), sps * 6, { gain: 0.06 })
      if (x.last && s >= 12) k.snare(t, 0.14 + (s - 12) * 0.05, 0.1)
    }
    if (E === 3) {
      if (s === 4 || s === 12) k.clap(t, 0.3, 0.2)
      for (const [, n, l] of startingAt(at(p.lead, b), s)) {
        k.pad(t, [n, n - 12], l * sps * 0.9, { type: 'sawtooth', cutoff: 1500, fenv: 2, gain: 0.08, attack: 0.03, release: 0.1, detune: [-8, 8], verb: 0.18 })
      }
      if (x.first && s === 0 && x.br > 0) k.crash(t, 0.16)
    }
  },
}

/* ---------- Toy Pop: bouncy and bright, C major ---------- */

const TOY_POP: Style = {
  id: 'toypop',
  name: 'Toy Pop',
  bpm: 128,
  echo: 0.35,
  parts: {
    A: {
      ch: chords(['C4 E4 G4', 'B3 D4 G4', 'C4 E4 A4', 'C4 F4 A4']),
      root: notes('C2 G1 A1 F1'),
      fifth: notes('G2 D2 E2 C2'),
      lead: bars([
        '0:E5:2 2:G5:2 4:C6:2 6:G5:2 8:E5:2 10:D5:2 12:C5:4',
        '0:D5:2 2:G5:2 4:B5:2 6:G5:2 8:D5:4 12:B4:4',
        '0:C5:2 2:E5:2 4:A5:2 6:G5:2 8:E5:2 10:C5:2 12:E5:4',
        '0:F5:2 2:E5:2 4:D5:2 6:C5:2 8:A4:4 12:G4:4',
        '0:E5:2 2:G5:2 4:C6:2 6:G5:2 8:E5:2 10:D5:2 12:C5:4',
        '0:D5:2 2:G5:2 4:B5:2 6:G5:2 8:D5:4 12:B4:4',
        '0:C5:2 2:E5:2 4:A5:2 6:G5:2 8:E5:2 10:C5:2 12:E5:4',
        '0:F5:2 2:A5:2 4:C6:2 6:A5:2 8:G5:4 12:D5:4',
      ]),
    },
    B: {
      ch: chords(['C4 F4 A4', 'B3 D4 G4', 'B3 E4 G4', 'C4 E4 A4', 'D4 F4 A4', 'B3 D4 G4', 'C4 E4 G4', 'B3 F4 G4']),
      root: notes('F1 G1 E1 A1 D2 G1 C2 G1'),
      fifth: notes('C2 D2 B1 E2 A1 D2 G2 D2'),
      lead: bars([
        '0:A5:2 2:C6:2 4:A5:2 6:F5:2 8:G5:2 10:A5:2 12:F5:4',
        '0:G5:2 2:B5:2 4:G5:2 6:D5:2 8:E5:2 10:F5:2 12:D5:4',
        '0:E5:2 2:G5:2 4:B5:2 6:G5:2 8:E5:4 12:B4:4',
        '0:C5:2 2:E5:2 4:A5:2 6:C6:2 8:B5:4 12:A5:4',
        '0:D5:2 2:F5:2 4:A5:2 6:F5:2 8:D5:2 10:E5:2 12:F5:4',
        '0:G5:2 2:F5:2 4:E5:2 6:D5:2 8:B4:4 12:G4:4',
        '0:C5:2 2:E5:2 4:G5:2 6:C6:2 8:E6:4 12:D6:4',
        '0:B5:2 2:G5:2 4:F5:2 6:D5:2 8:B4:4 12:G4:4',
      ]),
    },
  },
  form: 'A1 A2 A3 B2 B3 A1 A2 A3',
  levels: [0.66, 0.584, 0.583],
  play(k, x, s, t, sps) {
    const { p, b, E } = x
    const ch = at(p.ch, b)
    const root = at(p.root, b)
    const fifth = at(p.fifth!, b)
    const B = bright(E)
    if (s === 0 || s === 8 || (E >= 2 && s === 6)) k.kick(t, 0.75, 52, 0.22)
    if (s % 4 === 0 || s % 4 === 3) k.bass(t, (s % 8 === 0 ? root : fifth) + 12, sps * 0.9, { type: 'square', cutoff: 500 + 600 * B, env: 900, q: 2, gain: 0.2, sub: 0.6 })
    if (s % 4 === 2) k.pad(t, ch, sps * 0.9, { type: 'triangle', cutoff: 2600, gain: 0.08, attack: 0.003, release: 0.1, detune: [0], verb: 0.12 })
    if (E >= 2) {
      if (s === 4 || s === 12) k.clap(t, 0.32, 0.15)
      if (s % 2 === 0) k.hat(t, false, 0.08)
      for (const [, n, l] of startingAt(at(p.lead, b), s)) k.bell(t, n, l * sps, { ratio: 3.5, index: 1.6, decay: 0.9, gain: 0.08, verb: 0.25, delay: 0.15 })
      if (x.last && x.nextE > E && s >= 8 && s % 2 === 0) k.clap(t, 0.12 + (s - 8) * 0.03, 0.1)
    }
    if (E === 3) {
      k.shaker(t, s % 2 ? 0.05 : 0.08)
      if (s % 4 === 3) k.bell(t, at(ch, s) + 24, sps, { ratio: 5, index: 1, decay: 0.4, gain: 0.03, verb: 0.3, delay: 0.25 })
      if (x.first && s === 0 && x.br > 0) k.crash(t, 0.14)
    }
  },
}

/* ---------- Dash: electro-house in the spirit of Geometry Dash, A minor ---------- */

const DASH: Style = {
  id: 'dash',
  name: 'Dash',
  bpm: 140,
  echo: 0.32,
  parts: {
    A: {
      ch: chords(['A3 C4 E4', 'F3 A3 C4', 'G3 C4 E4', 'G3 B3 D4', 'A3 C4 E4', 'F3 A3 C4', 'G3 C4 E4', 'G#3 B3 E4']),
      root: notes('A1 F1 C2 G1 A1 F1 C2 E2'),
      lead: bars([
        '0:E5:2 3:E5:2 6:D5:2 8:C5:2 11:D5:2 14:E5:2',
        '0:F5:3 3:E5:2 6:C5:2 8:A4:4 14:C5:2',
        '0:G5:2 3:G5:2 6:E5:2 8:C5:2 11:E5:2 14:G5:2',
        '0:D5:3 3:B4:2 6:G4:2 8:B4:4 12:D5:2 14:B4:2',
        '0:E5:2 3:E5:2 6:D5:2 8:C5:2 11:D5:2 14:A5:2',
        '0:A5:3 3:G5:2 6:F5:2 8:E5:2 10:F5:2 12:E5:2 14:C5:2',
        '0:E5:3 3:D5:2 6:C5:2 8:G4:4 12:C5:2 14:D5:2',
        '0:E5:4 4:G#4:2 6:B4:2 8:E5:3 11:D5:1 12:B4:2 14:G#4:2',
      ]),
    },
    B: {
      ch: chords(['F3 A3 C4', 'G3 B3 D4', 'G3 B3 E4', 'A3 C4 E4', 'A3 D4 F4', 'G3 B3 D4', 'G3 C4 E4', 'G#3 B3 E4']),
      root: notes('F1 G1 E1 A1 D2 G1 C2 E2'),
      lead: bars([
        '0:A5:4 4:G5:2 6:F5:2 8:C5:6 14:F5:2',
        '0:G5:4 4:F5:2 6:D5:2 8:B4:6 14:D5:2',
        '0:E5:4 4:G5:2 6:B5:2 8:G5:4 12:E5:4',
        '0:A5:6 6:G5:2 8:E5:4 12:C5:4',
        '0:D5:2 2:F5:2 4:A5:4 8:G5:2 10:F5:2 12:D5:4',
        '0:B4:2 2:D5:2 4:G5:4 8:F5:2 10:D5:2 12:B4:4',
        '0:C5:2 2:E5:2 4:G5:2 6:C6:6 12:B5:2 14:G5:2',
        '0:G#5:4 4:B5:2 6:G#5:2 8:E5:6 14:D5:2',
      ]),
    },
  },
  form: 'A1 A2 A3 B2 B3 A1 A2 A3',
  levels: [0.372, 0.374, 0.369],
  play(k, x, s, t, sps) {
    const { p, b, E } = x
    const ch = at(p.ch, b)
    const root = at(p.root, b)
    const B = bright(E)
    if (s % 4 === 0) {
      k.kick(t, 0.95)
      k.duck(t, E === 3 ? 0.3 : E === 2 ? 0.4 : 0.55, 0.22)
    }
    if (s % 4 === 2) k.bass(t, root + 12, sps * 1.6, { type: 'sawtooth', cutoff: 260 + 700 * B, env: 1300 * B, q: 5, gain: 0.3, sub: 0.9 })
    if (E === 3 && s === 15) k.bass(t, root + 24, sps * 0.8, { type: 'sawtooth', cutoff: 900, env: 1600, q: 5, gain: 0.22 })
    if (E === 1 && s === 0) k.pad(t, ch, sps * 16, { cutoff: 900, gain: 0.1, attack: 0.06, release: 0.3, verb: 0.25 })
    if (E >= 2 && s % 2 === 0) k.pad(t, ch.map((n) => n + 12), sps * 1.7, { cutoff: 1200 + 2600 * B, gain: 0.07, attack: 0.004, release: 0.06, detune: [-14, 0, 14], verb: 0.15 })
    if (E >= 2 && (s === 4 || s === 12)) k.clap(t, 0.48)
    if (E >= 2 && s % 4 === 2) k.hat(t, E === 3, 0.28)
    if (E === 3 && s % 2 === 1) k.hat(t, false, 0.1)
    if (E >= 2) {
      const tones = [ch[0]!, ch[1]!, ch[2]!, ch[0]! + 12]
      k.pluck(t, tones[s % 4]! + 12, sps, { type: 'square', cutoff: 1000 + 2200 * B, decay: 0.09, gain: 0.04, delay: 0.18, verb: 0.08 })
    }
    if (E === 3) for (const [, n, l] of startingAt(at(p.lead, b), s)) k.lead(t, n, l * sps, { type: 'sawtooth', cutoff: 3400, gain: 0.08, delay: 0.24, verb: 0.18 })
    if (x.last && x.nextE === 3 && s === 0) k.riser(t, sps * 16, 0.16)
    if (x.last && E >= 2 && s >= 12) k.snare(t, 0.12 + (s - 12) * 0.05, 0.1, 1.1)
    if (E === 3 && x.first && s === 0 && x.br > 0) k.crash(t, 0.2)
  },
}

/* ---------- Neon Mile: synthwave, E minor ---------- */

const NEON_MILE: Style = {
  id: 'neonmile',
  name: 'Neon Mile',
  bpm: 100,
  echo: 0.45,
  parts: {
    A: {
      ch: chords(['E3 G3 B3', 'E3 G3 C4', 'D3 G3 B3', 'D3 F#3 A3']),
      root: notes('E2 C2 G1 D2'),
      lead: bars([
        '0:B4:4 4:E5:4 8:D5:2 10:B4:2 12:G4:4',
        '0:G4:4 4:C5:4 8:B4:2 10:G4:2 12:E4:4',
        '0:D5:4 4:B4:2 6:D5:2 8:G5:6 14:F#5:2',
        '0:F#5:4 4:E5:2 6:D5:2 8:A4:8',
        '0:B4:4 4:E5:4 8:F#5:2 10:G5:2 12:B5:4',
        '0:A5:4 4:G5:4 8:E5:4 12:C5:4',
        '0:D5:4 4:G5:4 8:F#5:2 10:E5:2 12:D5:4',
        '0:F#5:6 6:E5:2 8:D5:4 12:A4:4',
      ]),
    },
    B: {
      ch: chords(['E3 G3 C4', 'D3 F#3 A3', 'D3 F#3 B3', 'E3 G3 B3', 'E3 G3 C4', 'D3 F#3 A3', 'D#3 F#3 B3', 'D#3 F#3 B3']),
      root: notes('C2 D2 B1 E2 C2 D2 B1 B1'),
      lead: bars([
        '0:E5:4 4:G5:4 8:C6:6 14:B5:2',
        '0:A5:4 4:F#5:4 8:D5:8',
        '0:F#5:4 4:B5:4 8:A5:2 10:F#5:2 12:D5:4',
        '0:E5:12 12:G5:2 14:A5:2',
        '0:G5:4 4:E5:4 8:C5:4 12:E5:4',
        '0:F#5:4 4:A5:4 8:D6:6 14:C6:2',
        '0:B5:4 4:A5:2 6:F#5:2 8:D#5:8',
        '0:F#5:8 8:B4:8',
      ]),
    },
  },
  form: 'A1 A2 A3 B2 B3 A3',
  levels: [0.482, 0.449, 0.439],
  play(k, x, s, t, sps) {
    const { p, b, E } = x
    const ch = at(p.ch, b)
    const root = at(p.root, b)
    const B = bright(E)
    if (s === 0 || s === 8 || (E >= 2 && s === 10)) k.kick(t, 0.85, 48, 0.3)
    if (s === 4 || s === 12) k.snare(t, E === 1 ? 0.32 : 0.46, 0.45, 0.95)
    if (s % 2 === 0) k.bass(t, root + (s % 4 === 2 ? 12 : 0), sps * 1.7, { type: 'sawtooth', cutoff: 280 + 500 * B, env: 900 * B, q: 3, gain: 0.26, sub: 0.6 })
    if (s === 0) k.pad(t, ch.map((n) => n + 12), sps * 16, { cutoff: 1100 + 1400 * B, gain: E === 1 ? 0.1 : 0.075, attack: 0.3, release: 0.7, verb: 0.4, detune: [-12, 0, 12] })
    if (E >= 2 && s % 2 === 0) k.hat(t, false, s % 4 === 2 ? 0.16 : 0.07)
    if (E === 3 && s % 2 === 1) k.hat(t, false, 0.06)
    if (E >= 2) {
      const tones = [ch[0]!, ch[1]!, ch[2]!, ch[0]! + 12, ch[2]!, ch[1]!]
      k.pluck(t, tones[s % 6]! + 24, sps, { type: 'square', cutoff: 1400 + 1800 * B, decay: 0.12, gain: 0.035, delay: 0.3, verb: 0.15 })
    }
    if (E === 3) for (const [, n, l] of startingAt(at(p.lead, b), s)) k.lead(t, n, l * sps, { type: 'square', cutoff: 2600, gain: 0.07, delay: 0.3, verb: 0.3, vib: 14 })
    if (x.last && x.nextE > E && s >= 12) k.snare(t, 0.16 + (s - 12) * 0.06, 0.3, 0.95)
    if (E === 3 && x.first && s === 0 && x.br > 0) k.crash(t, 0.16)
  },
}

/* ---------- Rush: liquid drum and bass, A minor ---------- */

const RUSH: Style = {
  id: 'rush',
  name: 'Rush',
  bpm: 172,
  echo: 0.26,
  parts: {
    A: {
      ch: chords(['A3 C4 E4 G4', 'A3 C4 E4 G4', 'F3 A3 C4 E4', 'F3 A3 C4 E4', 'D3 F3 A3 C4', 'D3 F3 A3 C4', 'E3 G#3 B3 D4', 'E3 G#3 B3 D4']),
      root: notes('A1 A1 F1 F1 D2 D2 E1 E1'),
      lead: bars([
        '0:E5:2 2:G5:2 4:A5:4 10:G5:2 12:E5:4',
        '0:D5:4 6:C5:2 8:D5:4 12:E5:4',
        '0:C5:2 2:E5:2 4:F5:4 10:E5:2 12:C5:4',
        '0:A4:8 12:C5:4',
        '0:D5:2 2:F5:2 4:A5:4 10:G5:2 12:F5:4',
        '0:E5:4 6:D5:2 8:C5:4 12:D5:4',
        '0:B4:2 2:D5:2 4:E5:4 10:G#5:2 12:B5:4',
        '0:G#5:8 12:E5:4',
      ]),
    },
    B: {
      ch: chords(['F3 A3 C4 E4', 'F3 A3 C4 E4', 'F3 B3 E4', 'F3 B3 E4', 'E3 G3 B3 D4', 'E3 G3 B3 D4', 'E3 G#3 B3 D4', 'E3 G#3 B3 D4']),
      root: notes('D2 D2 G1 G1 C2 C2 E1 E1'),
      lead: bars([
        '0:A5:4 6:G5:2 8:F5:4 12:E5:4',
        '0:D5:8 12:E5:2 14:F5:2',
        '0:G5:4 6:F5:2 8:E5:4 12:D5:4',
        '0:B4:8 12:C5:2 14:D5:2',
        '0:E5:4 6:G5:2 8:B5:4 12:A5:4',
        '0:G5:8 12:E5:4',
        '0:G#5:4 6:B5:2 8:D6:4 12:B5:4',
        '0:G#5:2 2:E5:2 4:D5:4 8:B4:8',
      ]),
    },
  },
  form: 'A1 A2 A3 B2 B3 A1 A2 A3 B2 B3',
  levels: [0.395, 0.349, 0.348],
  play(k, x, s, t, sps) {
    const { p, b, E } = x
    const ch = at(p.ch, b)
    const root = at(p.root, b)
    const B = bright(E)
    if (s === 0 && b % 2 === 0) k.pad(t, ch, sps * 32, { cutoff: 900 + 1300 * B, gain: E === 1 ? 0.11 : 0.08, attack: 0.6, release: 1, verb: 0.45 })
    if (s === 0 || s === 10) k.sub(t, root + 12, sps * (s === 0 ? 9 : 5), { gain: 0.42 })
    if (E === 1) {
      if (s === 0 && b % 2 === 0) k.kick(t, 0.85, 46, 0.32)
      if (s === 0 && b % 2 === 1) k.snare(t, 0.36, 0.25, 1.1)
      if (s % 4 === 2) k.shaker(t, 0.09)
    } else {
      if (s === 0 || s === 10) k.kick(t, 0.85, 46, 0.26)
      if (s === 4 || s === 12) k.snare(t, 0.45, 0.2, 1.15)
      if (s === 7 || s === 15) k.snare(t, 0.1, 0, 1.2)
      if (s % 2 === 0) k.hat(t, false, s % 4 === 2 ? 0.14 : 0.07)
      if (s === 0) k.keys(t, ch.map((n) => n + 12), sps * 6, { gain: 0.09, index: 1.4, cutoff: 2600 + 1200 * B })
      if (s === 6 && b % 2 === 1) k.keys(t, ch.map((n) => n + 12), sps * 4, { gain: 0.07, index: 1.2 })
      if (x.last && s >= 8 && s % 2 === 1) k.snare(t, 0.1 + (s - 8) * 0.025, 0, 1.2)
    }
    if (E === 3) {
      if (s % 4 === 2) k.hat(t, true, 0.05)
      for (const [, n, l] of startingAt(at(p.lead, b), s)) k.pluck(t, n, l * sps, { type: 'triangle', cutoff: 3600, floor: 1000, decay: 0.3, gain: 0.12, delay: 0.25, verb: 0.3, len: 0.5 })
      if (x.first && s === 0 && x.br > 0) k.crash(t, 0.14)
    }
  },
}

/* ---------- Glide: melodic future bass, D major ---------- */

const GLIDE: Style = {
  id: 'glide',
  name: 'Glide',
  bpm: 75,
  echo: 0.4,
  parts: {
    A: {
      ch: chords(['G3 B3 D4 F#4', 'A3 C#4 E4 A4', 'F#3 A3 C#4 E4', 'B3 D4 F#4 A4']),
      root: notes('G1 A1 F#1 B1'),
      lead: bars([
        '0:B4:2 2:A4:2 4:F#4:2 6:A4:2 8:D5:4 12:A4:2 14:B4:2',
        '0:C#5:3 3:B4:1 4:A4:4 8:E4:2 10:F#4:2 12:A4:4',
        '0:A4:2 2:F#4:2 4:E4:2 6:F#4:2 8:C#5:4 12:B4:2 14:A4:2',
        '0:B4:4 4:D5:2 6:F#5:2 8:E5:4 12:D5:2 14:C#5:2',
        '0:B4:2 2:A4:2 4:F#4:2 6:A4:2 8:D5:4 12:A4:2 14:B4:2',
        '0:C#5:3 3:B4:1 4:A4:4 8:E4:2 10:F#4:2 12:A4:4',
        '0:A4:2 2:F#4:2 4:E4:2 6:F#4:2 8:C#5:4 12:B4:2 14:A4:2',
        '0:D5:3 3:C#5:1 4:B4:4 8:F#4:2 10:A4:2 12:B4:4',
      ]),
    },
    B: {
      ch: chords(['B3 D4 F#4 A4', 'G3 B3 D4 G4', 'F#3 A3 D4 F#4', 'A3 C#4 E4 A4']),
      root: notes('B1 G1 D2 A1'),
      lead: bars([
        '0:F#5:3 3:E5:1 4:D5:4 8:B4:2 10:D5:2 12:F#5:4',
        '0:G5:4 4:F#5:2 6:D5:2 8:B4:6 14:D5:2',
        '0:F#5:2 2:A5:2 4:F#5:2 6:D5:2 8:A4:4 12:D5:4',
        '0:E5:6 6:C#5:2 8:A4:4 12:C#5:2 14:E5:2',
        '0:F#5:3 3:E5:1 4:D5:4 8:B4:2 10:D5:2 12:B5:4',
        '0:A5:2 2:G5:2 4:F#5:2 6:D5:2 8:B4:4 12:D5:4',
        '0:F#5:4 4:E5:2 6:D5:2 8:A5:6 14:G5:2',
        '0:E5:8 8:C#5:4 12:A4:4',
      ]),
    },
  },
  form: 'A1 A2 B2 B3 A3',
  levels: [0.46, 0.449, 0.447],
  play(k, x, s, t, sps) {
    const { p, b, E } = x
    const ch = at(p.ch, b)
    const root = at(p.root, b)
    const B = bright(E)
    if (s === 0) {
      k.kick(t, 0.9, 42, 0.42)
      k.duck(t, 0.45, 0.4)
      k.pad(t, ch, sps * 16, { cutoff: 700 + 900 * B, gain: E === 1 ? 0.11 : 0.07, attack: 0.5, release: 0.8, verb: 0.4 })
      k.sub(t, root, sps * 15, { gain: 0.42 })
    }
    if (E >= 2 && s === 10) k.kick(t, 0.6, 44, 0.3)
    if (s === 8) {
      k.snare(t, E === 1 ? 0.3 : 0.48, 0.3, 1.05)
      k.duck(t, 0.55, 0.3)
    }
    if (E >= 2 && (s === 0 || s === 8)) k.pad(t, ch.map((n) => n + 12), sps * 8, { cutoff: 1500 + 2600 * B, gain: 0.07, attack: 0.02, release: 0.2, detune: [-16, 0, 16], wub: sps * 2, verb: 0.25 })
    if (E >= 2 && s % 2 === 0) k.hat(t, false, s % 4 === 2 ? 0.16 : 0.09)
    const tune = startingAt(at(p.lead, b), s)
    if (E >= 2) for (const [, n, l] of tune) k.pluck(t, n, l * sps, { type: 'triangle', cutoff: 3200, floor: 900, decay: 0.35, gain: 0.13, delay: 0.3, verb: 0.3, len: 0.6 })
    if (E === 3) for (const [, n, l] of tune) k.lead(t, n + 12, l * sps, { type: 'sawtooth', cutoff: 3000, gain: 0.05, delay: 0.3, verb: 0.3, detune: [-12, 0, 12] })
    if (x.last && x.nextE >= E && E >= 2 && s >= 8) k.snare(t, 0.12 + (s - 8) * 0.04, 0.1, 1.1)
    if (E === 3 && x.first && s === 0 && x.br > 0) k.crash(t, 0.18)
  },
}

/* ---------- Lo-fi: chill beats, C major, swung ---------- */

const LOFI: Style = {
  id: 'lofi',
  name: 'Lo-fi',
  bpm: 82,
  echo: 0.5,
  swing: 0.22,
  parts: {
    A: {
      ch: chords(['F3 A3 C4 E4', 'E3 G3 B3 D4', 'D3 F3 A3 C4', 'C3 E3 G3 B3']),
      root: notes('F2 E2 D2 C2'),
      fifth: notes('C3 B2 A2 G2'),
      lead: bars([
        '2:A5:2 6:G5:2 8:E5:4',
        '4:D5:2 6:E5:2 10:G5:4',
        '0:F5:2 2:E5:2 4:D5:2 8:A4:6',
        '6:B4:2 8:C5:2 10:E5:4',
        '2:A5:2 6:G5:2 8:E5:4',
        '4:G5:2 6:A5:2 10:B5:4',
        '0:F5:2 2:E5:2 4:D5:2 8:A4:6',
        '4:E5:2 6:D5:2 8:C5:6',
      ]),
    },
    B: {
      ch: chords(['C4 E4 G4 B4', 'F3 A3 C4 E4', 'F3 B3 E4', 'E3 G3 B3 D4']),
      root: notes('A2 D2 G2 C2'),
      fifth: notes('E3 A2 D3 G2'),
      lead: bars([
        '2:E5:2 6:G5:2 8:A5:4',
        '4:F5:2 6:E5:2 10:C5:4',
        '0:B4:2 2:D5:2 4:F5:2 8:E5:6',
        '6:G5:2 8:E5:2 10:D5:4',
        '2:C6:2 6:B5:2 8:A5:4',
        '4:A5:2 6:F5:2 10:D5:4',
        '0:D5:2 2:F5:2 4:A5:2 8:G5:6',
        '4:E5:2 6:D5:2 8:C5:6',
      ]),
    },
  },
  form: 'A1 A2 B2 A3 B3',
  levels: [0.48, 0.462, 0.461],
  play(k, x, s, t, sps) {
    const { p, b, E } = x
    const ch = at(p.ch, b)
    const B = bright(E)
    if (s === 0) {
      k.keys(t, ch, sps * 15, { gain: 0.15, index: 1.3, cutoff: 1500 + 1200 * B, verb: 0.25 })
      k.vinyl(t, sps * 16, 0.016)
    }
    if (E === 3 && s === 10) k.keys(t, ch.slice(1), sps * 5, { gain: 0.08, index: 1.1, cutoff: 1800 })
    if (s === 0) k.sub(t, at(p.root, b), sps * 7, { gain: 0.36, attack: 0.03 })
    if (s === 10) k.sub(t, at(p.fifth!, b), sps * 5, { gain: 0.3, attack: 0.03 })
    if (s === 0 || s === 7 || (E >= 2 && s === 10)) k.kick(t, 0.7, 44, 0.26)
    if (s === 4 || s === 12) {
      if (E === 1) k.rim(t, 0.22)
      else k.snare(t, 0.3, 0.15, 0.85)
    }
    if (E >= 2 && s % 2 === 0) k.hat(t, false, s % 4 === 2 ? 0.1 : 0.05)
    if (E === 3) {
      if (s % 2 === 1) k.shaker(t, 0.05)
      for (const [, n, l] of startingAt(at(p.lead, b), s)) k.bell(t, n, l * sps, { ratio: 2, index: 0.9, decay: 1.2, gain: 0.07, verb: 0.3, delay: 0.2 })
    }
  },
}

/* ---------- Bossa Café: bossa nova on a nylon guitar ---------- */

const BOSSA: Style = {
  id: 'bossa',
  name: 'Bossa Café',
  bpm: 120,
  echo: 0.375,
  swing: 0.08,
  parts: {
    A: {
      ch: chords(['F3 A3 C4 E4', 'F3 B3 E4', 'E3 G3 B3 D4', 'G3 C#4 E4', 'F3 A3 C4 E4', 'F3 B3 E4', 'E3 G3 B3 D4', 'E3 G3 B3 D4']),
      root: [],
      thumb: chords(['D3 A2', 'G2 D3', 'C3 G2', 'A2 E3', 'D3 A2', 'G2 D3', 'C3 G2', 'C3 G2']),
      lead: bars([
        '0:A4:4 4:C5:2 6:E5:4 12:D5:4',
        '0:B4:6 6:A4:2 8:G4:8',
        '0:E5:4 4:D5:2 6:C5:4 10:B4:2 12:G4:4',
        '0:C#5:6 6:E5:2 8:G5:8',
        '0:F5:4 4:E5:2 6:D5:4 12:A4:4',
        '0:B4:4 4:D5:2 6:F5:6 12:E5:4',
        '0:E5:8 8:G5:4 12:B4:4',
        '0:C5:16',
      ]),
    },
    B: {
      ch: chords(['G3 C4 E4', 'F#3 A3 C4 E4', 'F3 A3 C4 E4', 'F3 B3 E4', 'E3 G3 B3 D4', 'G3 C#4 E4', 'F3 A3 C4 E4', 'F3 B3 E4']),
      root: [],
      thumb: chords(['A2 E3', 'D3 A2', 'D3 A2', 'G2 D3', 'E3 B2', 'A2 E3', 'D3 A2', 'G2 D3']),
      lead: bars([
        '0:E5:4 4:G5:2 6:B5:4 12:A5:4',
        '0:F#5:6 6:E5:2 8:C5:8',
        '0:F5:4 4:E5:2 6:D5:4 10:C5:2 12:A4:4',
        '0:B4:6 6:D5:2 8:E5:8',
        '0:G5:4 4:F#5:2 6:E5:4 12:B4:4',
        '0:C#5:6 6:E5:2 8:G5:8',
        '0:F5:4 4:A5:2 6:C6:4 12:A5:4',
        '0:G5:8 8:F5:4 12:D5:4',
      ]),
    },
  },
  form: 'A1 A3 B2 B3 A2 A3 B3 A2',
  levels: [0.728, 0.711, 0.736],
  play(k, x, s, t, sps) {
    const { p, b, E } = x
    const ch = at(p.ch, b)
    const th = at(p.thumb!, b)
    if (s === 0) k.guitar(t, th[0]!, { gain: 0.34, cutoff: 2200, verb: 0.12 })
    if (s === 8) k.guitar(t, th[1]!, { gain: 0.3, cutoff: 2200, verb: 0.12 })
    const hits = b % 2 === 0 ? 'x..x..x...x..x..' : '..x..x...x..x...'
    if (hits[s] === 'x') k.strum(t, ch, { gain: 0.42, spread: 0.012, cutoff: 3200, verb: 0.15 })
    if (s === 0) k.sub(t, th[0]! - 12, sps * 6, { gain: 0.26, attack: 0.02 })
    if (s === 8) k.sub(t, th[1]! - 12, sps * 6, { gain: 0.22, attack: 0.02 })
    if (E >= 2) {
      if (hits[s] === 'x') k.rim(t, 0.14)
      if (s % 2 === 0) k.shaker(t, s % 4 === 2 ? 0.07 : 0.04)
    }
    if (E === 3) {
      if (s % 4 === 1) k.hat(t, false, 0.03)
      for (const [, n, l] of startingAt(at(p.lead, b), s)) k.bell(t, n, l * sps, { ratio: 4, index: 0.9, bite: 0.15, decay: 1.6, gain: 0.08, trem: 5, verb: 0.3, delay: 0.1 })
    }
  },
}

/* ---------- Still Water: ambient, C major; Still Air is its chords alone ---------- */

const STILL_PARTS = {
  A: {
    ch: chords(['C3 G3 B3 D4 E4', 'C3 G3 B3 D4 E4', 'A2 E3 G3 B3 C4', 'A2 E3 G3 B3 C4', 'F2 C3 E3 A3', 'F2 C3 E3 A3', 'G2 D3 E3 B3', 'G2 D3 E3 B3']),
    root: notes('C2 C2 A1 A1 F1 F1 G1 G1'),
    lead: bars(['0:G5:8 8:D6:8', '4:B5:10', '0:E5:8 8:C6:8', '0:B5:12', '0:A5:8 8:G5:8', '4:E5:12', '0:D5:8 8:E5:8', '0:B4:14']),
  },
  B: {
    ch: chords(['E3 B3 D4 G4', 'E3 B3 D4 G4', 'F2 C3 E3 A3 B3', 'F2 C3 E3 A3 B3', 'D3 F3 C4 E4', 'D3 F3 C4 E4', 'G2 D3 G3 C4', 'G2 D3 G3 C4']),
    root: notes('E2 E2 F1 F1 D2 D2 G1 G1'),
    lead: bars(['0:B5:8 8:G5:8', '4:D6:10', '0:A5:8 8:E5:8', '0:B5:12', '0:F5:8 8:A5:8', '4:E5:12', '0:D5:8 8:G5:8', '0:C5:14']),
  },
}

function playStill(k: Kit, x: Place, s: number, t: number, sps: number) {
  const { p, b, E } = x
  const ch = at(p.ch, b)
  const B = bright(E)
  if (s === 0 && b % 2 === 0) {
    k.pad(t, ch, sps * 32, { type: 'triangle', cutoff: 1400 + 1200 * B, gain: 0.16, attack: 1.4, release: 2, verb: 0.55, detune: [-6, 6] })
    k.sub(t, at(p.root, b) + 12, sps * 31, { gain: 0.22, attack: 0.8, release: 1.2 })
  }
  if (E >= 2) {
    for (const [, n, l] of startingAt(at(p.lead, b), s)) k.bell(t, n, l * sps, { ratio: 3.01, index: 1.1, decay: 3, gain: 0.07, verb: 0.5, delay: 0.3 })
    if (s === 0 && b % 2 === 0) k.pad(t, ch.slice(-2).map((n) => n + 24), sps * 32, { type: 'sine', cutoff: 5000, gain: 0.03, attack: 2, release: 2, verb: 0.6, detune: [-4, 4] })
  }
  if (E === 3) {
    if (s % 2 === 0) k.pluck(t, at(ch, s / 2) + 12, sps * 2, { type: 'triangle', cutoff: 1800, floor: 500, decay: 0.2, gain: 0.05, delay: 0.35, verb: 0.35 })
    if (s % 4 === 2) k.shaker(t, 0.035)
  }
}

const STILL: Style = {
  id: 'still',
  name: 'Still Water',
  bpm: 68,
  echo: 0.66,
  parts: STILL_PARTS,
  form: 'A1 A2 B2 A3 B2',
  levels: [0.634, 0.638, 0.628],
  play: playStill,
}

/** For Fireflies, where you listen for the lanterns' notes: Still Water's chords and hum, and no tune. */
const STILL_AIR: Style = {
  id: 'stillair',
  name: 'Still Air',
  bpm: 68,
  echo: 0.66,
  parts: STILL_PARTS,
  form: 'A1 B1 A1 B1',
  levels: [0.634, 0.638, 0.628],
  play: playStill,
}

/* ---------- the piano pieces ---------- */

/** A piece played through several times, each pass at its energy, its level rising and falling with it. */
function pieceTrack(
  o: Omit<KitTrack, 'engine' | 'gainAt' | 'play' | 'bars' | 'swing'> & {
    passBars: number
    /** Bars before the first pass only, as a pickup. */
    lead?: number
    passes: readonly Energy[]
    levels: readonly [number, number, number]
    play: (k: Kit, bar: number, s: number, t: number, sps: number, E: Energy) => void
  },
): KitTrack {
  const lead = o.lead ?? 0
  const energyAt = (bar: number) => o.passes[Math.min(o.passes.length - 1, Math.floor(Math.max(0, bar - lead) / o.passBars))]!
  return {
    engine: 'kit',
    id: o.id,
    name: o.name,
    bpm: o.bpm,
    tempoAt: o.tempoAt,
    bars: lead + o.passBars * o.passes.length,
    steps: o.steps,
    perBeat: o.perBeat,
    swing: 0,
    echo: o.echo,
    level: o.level,
    gainAt: (bar) => {
      const E = energyAt(bar)
      return o.levels[E - 1] * DYNAMICS[E - 1]
    },
    play: (k, bar, s, t, sps) => o.play(k, bar, s, t, sps, energyAt(bar)),
  }
}

/** Bach, Prelude in C (1722): each bar one chord, broken the same way all the way through. */
const PRELUDE = chords([
  'C4 E4 G4 C5 E5',
  'C4 D4 A4 D5 F5',
  'B3 D4 G4 D5 F5',
  'C4 E4 G4 C5 E5',
  'C4 E4 A4 E5 A5',
  'C4 D4 F#4 A4 D5',
  'B3 D4 G4 D5 G5',
  'B3 C4 E4 G4 C5',
  'A3 C4 E4 G4 C5',
  'D3 A3 D4 F#4 C5',
  'G3 B3 D4 G4 B4',
  'G3 Bb3 E4 G4 C#5',
  'F3 A3 D4 A4 D5',
  'F3 Ab3 D4 F4 B4',
  'E3 G3 C4 G4 C5',
  'E3 F3 A3 C4 F4',
  'D3 F3 A3 C4 F4',
  'G2 D3 G3 B3 F4',
  'C3 E3 G3 C4 E4',
])

/** Pachelbel, Canon in D: the ground bass of eight notes, and three of the tunes laid over it. */
const CANON = {
  bass: notes('D3 A2 B2 F#2 G2 D2 G2 A2'),
  ch: chords(['D4 F#4 A4', 'C#4 E4 A4', 'D4 F#4 B4', 'C#4 F#4 A4', 'D4 G4 B4', 'D4 F#4 A4', 'D4 G4 B4', 'C#4 E4 A4']),
  v1: notes('F#5 E5 D5 C#5 B4 A4 B4 C#5'),
  v2: notes('D5 C#5 B4 A4 G4 F#4 G4 E4'),
  v3: notes('D5 F#5 A5 G5 F#5 D5 F#5 E5 D5 B4 D5 A5 G5 B5 A5 G5'),
}

/** Satie, Gymnopédie No. 1 (1888), in 3/4 by eighth notes: a bass on the beat, a chord after it, the tune above. */
const GYMNO = {
  lh: [
    { bass: notes('G2')[0]!, ch: notes('B3 D4 F#4') },
    { bass: notes('D2')[0]!, ch: notes('A3 C#4 F#4') },
  ],
  mel: [
    [], [], [], [],
    bar('2:F#5:2 4:A5:2'), bar('0:G5:2 2:F#5:2 4:C#5:2'), bar('0:B4:2 2:C#5:2 4:D5:2'), bar('0:A4:6'),
    bar('0:F#4:24'), [], [], [],
    bar('2:F#5:2 4:A5:2'), bar('0:G5:2 2:F#5:2 4:C#5:2'), bar('0:B4:2 2:C#5:2 4:D5:2'), bar('0:A4:6'),
    bar('0:C#5:6'), bar('0:F#5:18'), [], [],
  ] as BarNote[][],
  strings: chords(['B3 D4 F#4', 'A3 C#4 F#4']),
}

/** Beethoven, Für Elise, in 3/8 by sixteenths: the opening section twice, then the first turn of the middle. */
type EliseBar = { rh: BarNote[]; lh: BarNote[]; ch: 'Am' | 'E' | 'C' | 'G' | '' }
const FE_A: EliseBar[] = [
  { rh: bar('0:E5:1 1:D#5:1 2:E5:1 3:B4:1 4:D5:1 5:C5:1'), lh: [], ch: 'Am' },
  { rh: bar('0:A4:2 3:C4:1 4:E4:1 5:A4:1'), lh: bar('0:A2:6 1:E3:5 2:A3:4'), ch: 'Am' },
  { rh: bar('0:B4:2 3:E4:1 4:G#4:1 5:B4:1'), lh: bar('0:E2:6 1:E3:5 2:G#3:4'), ch: 'E' },
  { rh: bar('0:C5:2 3:E4:1 4:E5:1 5:D#5:1'), lh: bar('0:A2:6 1:E3:5 2:A3:4'), ch: 'Am' },
  { rh: bar('0:E5:1 1:D#5:1 2:E5:1 3:B4:1 4:D5:1 5:C5:1'), lh: [], ch: 'Am' },
  { rh: bar('0:A4:2 3:C4:1 4:E4:1 5:A4:1'), lh: bar('0:A2:6 1:E3:5 2:A3:4'), ch: 'Am' },
  { rh: bar('0:B4:2 3:E4:1 4:C5:1 5:B4:1'), lh: bar('0:E2:6 1:E3:5 2:G#3:4'), ch: 'E' },
]
const ELISE_PICKUP: EliseBar = { rh: bar('4:E5:1 5:D#5:1'), lh: [], ch: '' }
const ELISE: EliseBar[] = [
  ...FE_A,
  { rh: bar('0:A4:3 4:E5:1 5:D#5:1'), lh: bar('0:A2:6 1:E3:5 2:A3:4'), ch: 'Am' },
  ...FE_A,
  { rh: bar('0:A4:2 3:B4:1 4:C5:1 5:D5:1'), lh: bar('0:A2:6 1:E3:5 2:A3:4'), ch: 'Am' },
  { rh: bar('0:E5:3 3:G4:1 4:F5:1 5:E5:1'), lh: bar('0:C3:6 1:G3:5 2:C4:4'), ch: 'C' },
  { rh: bar('0:D5:3 3:F4:1 4:E5:1 5:D5:1'), lh: bar('0:G2:6 1:G3:5 2:B3:4'), ch: 'G' },
  { rh: bar('0:C5:3 3:E4:1 4:D5:1 5:C5:1'), lh: bar('0:A2:6 1:E3:5 2:A3:4'), ch: 'Am' },
  { rh: bar('0:B4:2 3:E4:1 4:E5:1 5:D#5:1'), lh: bar('0:E2:6 1:E3:5 2:G#3:4'), ch: 'E' },
]
const ELISE_CH = { Am: notes('A3 C4 E4'), E: notes('G#3 B3 E4'), C: notes('G3 C4 E4'), G: notes('G3 B3 D4') }

/** Grieg, In the Hall of the Mountain King (1875), by eighth notes: the tune low, then an octave up. */
const MOUNTAIN = {
  mel: [
    bar('0:B3:1 1:C#4:1 2:D4:1 3:E4:1 4:F#4:1 5:D4:1 6:F#4:2'),
    bar('0:F4:1 1:C#4:1 2:F4:2 4:E4:1 5:C4:1 6:E4:2'),
    bar('0:B3:1 1:C#4:1 2:D4:1 3:E4:1 4:F#4:1 5:D4:1 6:F#4:1 7:B4:1'),
    bar('0:A4:1 1:F#4:1 2:D4:1 3:F#4:1 4:A4:4'),
  ],
  bass: chords(['B2 F#2 B2 F#2', 'F#2 C#3 E2 C3', 'B2 F#2 B2 F#2', 'D3 A2 D3 F#2']),
  strings: notes('D4 F#4 A4'),
}

/* ---------- the list ---------- */

/*
 * Levels: each song rendered offline whole and weighted for the ear the way the Game Boy songs were (a
 * 60 Hz highpass, 4 dB more above 1.5 kHz), then set to their loudness, about -29.5 dB at the fader;
 * Still Air to the pond songs', -33.
 */
export const KIT_TRACKS: Record<KitTrackId, KitTrack> = {
  groove: styleTrack(GROOVE, 0.2),
  toypop: styleTrack(TOY_POP, 0.207),
  dash: styleTrack(DASH, 0.202),
  neonmile: styleTrack(NEON_MILE, 0.202),
  rush: styleTrack(RUSH, 0.199),
  glide: styleTrack(GLIDE, 0.19),
  lofi: styleTrack(LOFI, 0.2),
  bossa: styleTrack(BOSSA, 0.194),
  still: styleTrack(STILL, 0.212),
  // Under the pond songs' level, as Fireflies' music has always been.
  stillair: styleTrack(STILL_AIR, 0.164),
  // Mountain King: the tune five times round, 12% faster each time and fuller as it goes, then it starts over.
  mountain: pieceTrack({
    id: 'mountain',
    name: 'Mountain King',
    bpm: 96,
    tempoAt: (bar) => 96 * Math.pow(1.12, Math.floor(bar / 8) % 5),
    perBeat: 2,
    steps: 8,
    echo: 0.3,
    level: 0.197,
    passBars: 8,
    passes: [1, 2, 2, 3, 3],
    levels: [4.978, 3.328, 1.01],
    play(k, br, s, t, sps, E) {
      const b = br % 8
      const up = b >= 4 ? 12 : 0
      for (const [, n, l] of startingAt(at(MOUNTAIN.mel, b), s)) {
        const d = l > 1 ? l * sps * 0.9 : sps * 0.55
        k.piano(t, n + up, d, E === 1 ? 0.42 : 0.5)
        if (E === 3) k.piano(t, n + up + 12, d, 0.36)
      }
      if (E >= 2 && s % 2 === 0) {
        const bn = at(MOUNTAIN.bass, b)[s / 2]!
        k.piano(t, bn, sps * 0.8, 0.42)
        if (E === 3) k.piano(t, bn - 12, sps * 0.8, 0.34)
      }
      if (E === 3) {
        if (s === 0 || s === 4) k.kick(t, 0.6, 62, 0.45)
        if (b === 0 && s === 0) k.crash(t, 0.16)
        if (s === 0 && b % 4 === 3) k.pad(t, MOUNTAIN.strings, sps * 8, { cutoff: 1800, gain: 0.05, attack: 0.05, release: 0.3, verb: 0.35, detune: [-8, 8] })
      }
    },
  }),
  // Für Elise: the pickup once, then the tune four times, its left hand and strings coming and going.
  elise: pieceTrack({
    id: 'elise',
    name: 'Für Elise',
    bpm: 132,
    perBeat: 2,
    steps: 6,
    echo: 0.45,
    level: 0.206,
    lead: 1,
    passBars: ELISE.length,
    passes: [1, 2, 3, 2],
    levels: [3.802, 2.976, 2.75],
    play(k, br, s, t, sps, E) {
      const now = br === 0 ? ELISE_PICKUP : ELISE[(br - 1) % ELISE.length]!
      for (const [, n, l] of startingAt(now.rh, s)) k.piano(t, n, l * sps * 1.1, E === 1 ? 0.42 : 0.5)
      for (const [st, n, l] of startingAt(now.lh, s)) if (E >= 2 || st === 0) k.piano(t, n, l * sps, 0.33)
      if (E === 3 && s === 0 && now.ch) k.pad(t, ELISE_CH[now.ch], sps * 6, { cutoff: 1400, gain: 0.04, attack: 0.25, release: 0.5, verb: 0.45, detune: [-6, 6] })
    },
  }),
  // Canon in D: four bars for each of three tunes, then round again with more of the strings.
  canon: pieceTrack({
    id: 'canon',
    name: 'Canon in D',
    bpm: 60,
    echo: 0.5,
    level: 0.206,
    passBars: 12,
    passes: [1, 2, 3, 2],
    levels: [4.619, 3.988, 2.863],
    play(k, br, s, t, sps, E) {
      const ci = (br % 4) * 2 + (s >= 8 ? 1 : 0)
      const v = Math.floor(br / 4) % 3
      const h = s % 8
      if (h === 0) k.piano(t, CANON.bass[ci]!, sps * 8, 0.55)
      if (E === 3 && h === 0) k.piano(t, CANON.bass[ci]! - 12, sps * 8, 0.38)
      if (v === 0 || (v === 2 && E === 1)) {
        if (h === 0) k.piano(t, CANON.v1[ci]!, sps * 8, 0.52)
      } else if (v === 1) {
        if (h === 0) k.piano(t, CANON.v2[ci]!, sps * 8, 0.52)
      } else if (h % 4 === 0) k.piano(t, CANON.v3[ci * 2 + h / 4]!, sps * 4, 0.52)
      if (E >= 2 && h % 2 === 0 && h > 0) k.piano(t, CANON.ch[ci]![h / 2 - 1]!, sps * 2.5, 0.28)
      if (E === 3 && h === 0) k.pad(t, CANON.ch[ci]!, sps * 8, { cutoff: 1500, gain: 0.045, attack: 0.5, release: 0.8, verb: 0.45, detune: [-7, 7] })
    },
  }),
  // Prelude in C: all nineteen bars, then again with strings, then softly with half the notes.
  prelude: pieceTrack({
    id: 'prelude',
    name: 'Prelude in C',
    bpm: 66,
    echo: 0.5,
    level: 0.198,
    passBars: PRELUDE.length,
    passes: [2, 3, 1],
    levels: [4.773, 3.008, 2.339],
    play(k, br, s, t, sps, E) {
      const ch = at(PRELUDE, br)
      if (E === 1) {
        if (s % 2) return
        const i = [0, 2, 3, 4][(s / 2) % 4]!
        k.piano(t, ch[i]!, i === 0 ? sps * 8 : sps * 5, i === 0 ? 0.5 : 0.36)
        return
      }
      const i = [0, 1, 2, 3, 4, 2, 3, 4][s % 8]!
      k.piano(t, ch[i]!, i === 0 ? sps * 8 : i === 1 ? sps * 7 : sps * 3.5, i === 0 ? 0.56 : i === 1 ? 0.46 : i === 4 ? 0.48 : 0.4)
      if (E === 3 && s === 0) {
        k.pad(t, ch.slice(2), sps * 16, { cutoff: 1600, gain: 0.045, attack: 0.6, release: 1.2, verb: 0.45, detune: [-7, 7] })
        k.pad(t, [ch[0]! - 12], sps * 16, { cutoff: 500, gain: 0.05, attack: 0.4, release: 1, verb: 0.3, detune: [-4, 4] })
      }
    },
  }),
  // Gymnopédie No. 1: through four times, the chords, then strings and the tune doubled low, then back.
  gymno: pieceTrack({
    id: 'gymno',
    name: 'Gymnopédie',
    bpm: 72,
    perBeat: 2,
    steps: 6,
    echo: 0.6,
    level: 0.218,
    passBars: GYMNO.mel.length,
    passes: [1, 2, 3, 2],
    levels: [5.877, 4.463, 3.437],
    play(k, br, s, t, sps, E) {
      const b = br % GYMNO.mel.length
      const lh = GYMNO.lh[br % 2]!
      if (s === 0) k.piano(t, lh.bass, sps * 6, E === 1 ? 0.42 : 0.48)
      if (s === 2) {
        if (E === 1) k.piano(t, lh.ch[1]!, sps * 4, 0.24)
        else for (const n of lh.ch) k.piano(t, n, sps * 4, 0.3)
      }
      for (const [, n, l] of startingAt(GYMNO.mel[b]!, s)) {
        k.piano(t, n, l * sps, E === 1 ? 0.4 : 0.46)
        if (E === 3) k.piano(t, n - 12, l * sps, 0.26)
      }
      if (E === 3 && s === 0) k.pad(t, GYMNO.strings[br % 2]!, sps * 6, { cutoff: 1300, gain: 0.04, attack: 0.6, release: 0.8, verb: 0.5, detune: [-6, 6] })
    },
  }),
}
