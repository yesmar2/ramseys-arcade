import type { Chip } from './chip'

/*
 * The arcade's music: thirteen songs for the Game Boy chip in chip.ts, each a loop of a few bars written a
 * sixteenth at a time, played under the games by music.ts. Ramsey picked them in the Chip Lab (2026-10-05,
 * "i like them all, can you put them in?"), with the Game Boy sound, replacing the four synth tracks.
 *
 * Mountain King is Grieg's (1875) and free to use. Korobeiniki, Tetris's Type A tune, was left out on his
 * word, though the folk tune is free: it is too tied to Tetris.
 */

/** 'A4', 'C#5', 'Bb3' in Hz. */
export function noteHz(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name)
  if (!m) return 0
  const semi = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1] as 'C'] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
  return 440 * Math.pow(2, ((Number(m[3]) + 1) * 12 + semi - 69) / 12)
}

const tones = (names: string) => names.split(' ').map(noteHz)

/** A chord's notes as semitones above its first: an arpeggio on one channel. */
const semis = (fs: number[]) => fs.map((f) => Math.round(12 * Math.log2(f / fs[0]!)))

/**
 * Bars of a tune, `steps` sixteenths a bar (12 for a waltz), one word a note: '.' rests and '-' holds the
 * note before. Eight words to a bar of sixteen are eighth notes. → [step, Hz, sixteenths]
 */
function tune(bars: string[], steps = 16): [number, number, number][][] {
  return bars.map((bar) => {
    const words = bar.trim().split(/\s+/)
    const w = steps / words.length
    const notes: [number, number, number][] = []
    words.forEach((word, k) => {
      const last = notes[notes.length - 1]
      if (word === '-') {
        if (last) last[2] += w
      } else if (word !== '.') notes.push([k * w, noteHz(word), w])
    })
    return notes
  })
}

export type TrackId =
  | 'nightdrive'
  | 'pocket'
  | 'paper'
  | 'pond'
  | 'hyperspace'
  | 'coinop'
  | 'puzzle'
  | 'nightpond'
  | 'mountainking'
  | 'highscore'
  | 'dungeon'
  | 'bonus'
  | 'credits'

export type Track = {
  id: TrackId
  name: string
  bpm: number
  /** The tempo on a given time round, for a song that speeds up. */
  bpmAt?: (loop: number) => number
  bars: number
  /** Sixteenths a bar: 16, or 12 for a waltz. */
  steps?: number
  /** How late the odd sixteenths land, as a share of a sixteenth. */
  swing: number
  /**
   * Its level under the games: rendered offline with a treble-weighted loudness, each set to where the old
   * synth tracks sat (the pond songs to the old pond's), so the music sits as far under the sounds as before.
   */
  level: number
  step: (chip: Chip, bar: number, i: number, t: number, sixteenth: number) => void
}

/* ---------- Night Drive: A minor, square-wave stage tune ---------- */

const NIGHT_BARS = ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G', 'Am', 'Am', 'F', 'G', 'C', 'G'] as const
const NIGHT = {
  Am: { bass: noteHz('A2'), pad: tones('A3 C4 E4'), arp: tones('A4 C5 E5 A5') },
  F: { bass: noteHz('F2'), pad: tones('F3 A3 C4'), arp: tones('F4 A4 C5 F5') },
  C: { bass: noteHz('C3'), pad: tones('G3 C4 E4'), arp: tones('G4 C5 E5 G5') },
  G: { bass: noteHz('G2'), pad: tones('G3 B3 D4'), arp: tones('G4 B4 D5 G5') },
}
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
const UP_DOWN = [0, 1, 2, 3, 2, 1, 2, 3]

/* ---------- Pocket Change: C major pop ---------- */

const POCKET_BARS = ['C', 'Am', 'F', 'G', 'C', 'Am', 'FG', 'C'] as const
const POCKET = {
  C: { root: noteHz('C3'), fifth: noteHz('G3'), stab: tones('E4 G4 C5') },
  Am: { root: noteHz('A2'), fifth: noteHz('E3'), stab: tones('E4 A4 C5') },
  F: { root: noteHz('F2'), fifth: noteHz('C3'), stab: tones('F4 A4 C5') },
  G: { root: noteHz('G2'), fifth: noteHz('D3'), stab: tones('D4 G4 B4') },
}
const POCKET_TUNE = tune([
  'E5 G5 C6 G5 A5 G5 E5 .',
  'A4 C5 E5 A5 G5 E5 C5 .',
  'F5 A5 C6 A5 G5 F5 D5 .',
  'G5 . B5 . D6 . B5 G5',
  'E5 G5 C6 G5 A5 G5 E5 G5',
  'A5 . G5 E5 C5 . E5 G5',
  'F5 A5 C6 . B5 . G5 .',
  'C6 . G5 . C6 - - .',
])

/* ---------- Paper Cranes: sevenths, swung ---------- */

const PAPER_BARS = ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7', 'Fmaj7', 'Em7', 'Dm7G7', 'Cmaj7'] as const
const PAPER = {
  Fmaj7: { root: noteHz('F2'), fifth: noteHz('C3'), keys: tones('A3 C4 E4 G4') },
  Em7: { root: noteHz('E2'), fifth: noteHz('B2'), keys: tones('G3 B3 D4 E4') },
  Dm7: { root: noteHz('D2'), fifth: noteHz('A2'), keys: tones('F3 A3 C4 E4') },
  G7: { root: noteHz('G2'), fifth: noteHz('D3'), keys: tones('F3 B3 D4 G4') },
  Cmaj7: { root: noteHz('C2'), fifth: noteHz('G2'), keys: tones('E3 G3 B3 D4') },
}
const PAPER_BELLS: Record<number, [number, string][]> = {
  0: [[8, 'G5'], [12, 'E5']],
  1: [[8, 'D5'], [10, 'E5'], [12, 'G5']],
  2: [[8, 'A5'], [12, 'G5']],
  3: [[8, 'E5'], [10, 'D5'], [12, 'C5']],
  5: [[8, 'G5'], [10, 'A5'], [12, 'C6']],
  7: [[8, 'B4'], [12, 'C5']],
}

/* ---------- Pond at Dusk: no melody ---------- */

const PENTA = tones('C6 D6 E6 G6 A6 C7')

/* ---------- Hyperspace: E minor, fast ---------- */

const HYPER_BARS = ['Em', 'Em', 'C', 'C', 'D', 'D', 'B', 'B', 'Em', 'Em', 'C', 'C', 'Am', 'Am', 'B', 'B'] as const
const HYPER = {
  Em: { root: noteHz('E2'), arp: tones('E4 G4 B4 E5') },
  C: { root: noteHz('C2'), arp: tones('C4 E4 G4 C5') },
  D: { root: noteHz('D2'), arp: tones('D4 F#4 A4 D5') },
  B: { root: noteHz('B1'), arp: tones('B3 D#4 F#4 B4') },
  Am: { root: noteHz('A1'), arp: tones('A3 C4 E4 A4') },
}
const HYPER_TUNE = tune([
  'E5 . E5 G5 B5 . A5 G5',
  'F#5 . G5 . E5 - - .',
  'E5 . E5 G5 C6 . B5 A5',
  'G5 . A5 . B5 - - .',
  'A5 . A5 B5 D6 . C6 B5',
  'A5 . F#5 . D5 - E5 F#5',
  'D#5 . F#5 . B5 . A5 .',
  'F#5 - D#5 - B4 - - .',
  'B5 - - A5 G5 - E5 .',
  'G5 A5 B5 . E6 . D6 .',
  'C6 - - B5 A5 - G5 .',
  'E5 G5 A5 . C6 . B5 .',
  'A5 - C6 - E6 - D6 C6',
  'B5 - A5 - G5 - A5 B5',
  'D#6 . B5 . F#5 . D#5 .',
  'B5 . F#5 . D#5 . B4 .',
])

/* ---------- Coin Op: F major shuffle ---------- */

const COIN_BARS = ['F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Gm', 'C'] as const
const COIN = {
  F: { root: noteHz('F2'), fifth: noteHz('C3'), stab: tones('F4 A4 C5') },
  Dm: { root: noteHz('D2'), fifth: noteHz('A2'), stab: tones('D4 F4 A4') },
  Bb: { root: noteHz('Bb1'), fifth: noteHz('F2'), stab: tones('D4 F4 Bb4') },
  C: { root: noteHz('C2'), fifth: noteHz('G2'), stab: tones('E4 G4 C5') },
  Gm: { root: noteHz('G2'), fifth: noteHz('D3'), stab: tones('D4 G4 Bb4') },
}
const COIN_TUNE = tune([
  'C5 F5 A5 F5 C6 . A5 .',
  'D5 F5 A5 . G5 F5 D5 .',
  'D5 F5 Bb5 . A5 Bb5 C6 .',
  'G5 . E5 . C5 . G4 .',
  'A4 C5 F5 . A5 . G5 F5',
  'F5 . D5 . F5 A5 D6 .',
  'Bb5 . G5 . D5 . E5 .',
  'C6 . G5 . E5 . F5 -',
])

/* ---------- Puzzle Room: D dorian ---------- */

const PUZZLE_BARS = ['Dm7', 'G', 'Dm7', 'G', 'Bbmaj7', 'C', 'Dm', 'Am'] as const
const PUZZLE = {
  Dm7: { root: noteHz('D2'), fifth: noteHz('A2'), arp: tones('D4 F4 A4 C5') },
  G: { root: noteHz('G2'), fifth: noteHz('D3'), arp: tones('G3 B3 D4 G4') },
  Bbmaj7: { root: noteHz('Bb1'), fifth: noteHz('F2'), arp: tones('Bb3 D4 F4 A4') },
  C: { root: noteHz('C2'), fifth: noteHz('G2'), arp: tones('C4 E4 G4 C5') },
  Dm: { root: noteHz('D2'), fifth: noteHz('A2'), arp: tones('D4 F4 A4 D5') },
  Am: { root: noteHz('A1'), fifth: noteHz('E2'), arp: tones('A3 C4 E4 A4') },
}
const PUZZLE_TUNE = tune([
  'D5 - F5 - A5 - G5 -',
  'B4 - D5 - G5 - - .',
  'A5 - G5 - F5 - E5 -',
  'D5 - B4 - D5 - - .',
  'F5 - A5 - D6 - C6 -',
  'G5 - E5 - C6 - - .',
  'A5 - F5 - D5 - E5 F5',
  'E5 - - . C5 - - .',
])
const BROKEN = [0, 1, 2, 1, 3, 1, 2, 1]

/* ---------- Night Pond: slow chords, no melody ---------- */

const DUSK_BARS = ['Cmaj7', 'Am7', 'Fmaj7', 'G6', 'Cmaj7', 'Am7', 'Fmaj7', 'G6'] as const
const DUSK = {
  Cmaj7: { root: noteHz('C3'), arp: tones('C5 E5 G5 B5') },
  Am7: { root: noteHz('A2'), arp: tones('A4 C5 E5 G5') },
  Fmaj7: { root: noteHz('F2'), arp: tones('F4 A4 C5 E5') },
  G6: { root: noteHz('G2'), arp: tones('G4 B4 D5 E5') },
}
const DUSK_ORDER = [0, 2, 1, 3, 2, 1, 3, 0]

/* ---------- Mountain King: Grieg, quicker every time round ---------- */

const KING_TUNE = tune([
  'A4 B4 C5 D5 E5 C5 E5 .',
  'D#5 B4 D#5 . D5 Bb4 D5 .',
  'A4 B4 C5 D5 E5 C5 E5 A5',
  'G5 E5 C5 E5 G5 . . .',
])
const KING_BASS = [
  ['A2', 'E2'],
  ['B2', 'Bb2'],
  ['A2', 'E2'],
  ['C3', 'E2'],
] as const

/* ---------- High Score: C major, triumphant ---------- */

const SCORE_BARS = ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G'] as const
const SCORE = {
  C: { root: noteHz('C2'), stab: tones('C4 E4 G4') },
  G: { root: noteHz('G1'), stab: tones('B3 D4 G4') },
  Am: { root: noteHz('A1'), stab: tones('A3 C4 E4') },
  F: { root: noteHz('F1'), stab: tones('A3 C4 F4') },
}
const SCORE_TUNE = tune([
  'C5 . E5 G5 C6 - G5 E5',
  'D5 . G5 B5 D6 - B5 G5',
  'A5 - G5 E5 C5 - E5 A5',
  'G5 - F5 E5 F5 - A5 -',
  'C6 . C6 B5 C6 - G5 E5',
  'B5 . B5 A5 B5 - D6 -',
  'C6 - A5 F5 A5 - C6 -',
  'D6 - - . B5 - G5 -',
])

/* ---------- Dungeon: D minor, mysterious ---------- */

const DUNGEON_BARS = ['Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'C', 'A'] as const
const DUNGEON = {
  Dm: { root: noteHz('D2'), ost: tones('D4 A4 F4 A4') },
  Bb: { root: noteHz('Bb1'), ost: tones('D4 Bb4 F4 Bb4') },
  C: { root: noteHz('C2'), ost: tones('E4 G4 C5 G4') },
  A: { root: noteHz('A1'), ost: tones('C#4 A4 E4 A4') },
}
const DUNGEON_TUNE = tune([
  'D5 - - - - - E5 F5',
  'E5 - - - D5 - - -',
  'C5 - - - E5 - G5 -',
  'E5 - - - C#5 - - -',
  'F5 - - - G5 - A5 -',
  'Bb5 - - - A5 - G5 -',
  'G5 - - - F5 - E5 -',
  'E5 - - - - - - .',
])

/* ---------- Bonus Stage: G major gallop ---------- */

const BONUS_BARS = ['G', 'D', 'G', 'D', 'G', 'C', 'D', 'G'] as const
const BONUS = {
  G: { root: noteHz('G2'), fifth: noteHz('D3'), stab: tones('B4 D5 G5') },
  D: { root: noteHz('D2'), fifth: noteHz('A2'), stab: tones('A4 D5 F#5') },
  C: { root: noteHz('C3'), fifth: noteHz('G2'), stab: tones('C5 E5 G5') },
}
const BONUS_TUNE = tune([
  'D5 G5 B5 G5 D6 . B5 .',
  'C6 A5 F#5 A5 D5 . F#5 .',
  'G5 A5 B5 C6 D6 C6 B5 A5',
  'A5 . F#5 . D5 . . .',
  'B5 B5 B5 . G5 G5 G5 .',
  'C6 C6 C6 . E5 F#5 G5 A5',
  'B5 . A5 . F#5 . A5 .',
  'G5 . D5 . G5 - - .',
])

/* ---------- Credits Roll: an F major waltz ---------- */

const CREDITS_BARS = ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C'] as const
const CREDITS = {
  F: { root: noteHz('F2'), chord: tones('A4 C5 F5') },
  C: { root: noteHz('C2'), chord: tones('G4 C5 E5') },
  Dm: { root: noteHz('D2'), chord: tones('A4 D5 F5') },
  Bb: { root: noteHz('Bb1'), chord: tones('Bb4 D5 F5') },
}
const CREDITS_TUNE = tune(
  ['A5 - - - C6 A5', 'G5 - - - E5 C5', 'F5 - - - A5 F5', 'D5 - - - - .', 'C5 - F5 - A5 -', 'G5 - - - E5 G5', 'F5 - - - D5 Bb4', 'C5 - - - - .'],
  12,
)

export const TRACKS: Record<TrackId, Track> = {
  nightdrive: {
    id: 'nightdrive',
    name: 'Night Drive',
    bpm: 104,
    bars: 16,
    swing: 0,
    level: 0.35,
    step(C, bar, i, t, S) {
      const c = NIGHT[NIGHT_BARS[bar]!]
      if (i === 0 || i === 8 || (bar % 2 === 1 && i === 10)) C.kick(t)
      else if (i === 4 || i === 12) C.snare(t)
      else if (i % 2 === 0) C.hat(t, i % 4 === 2 ? 6 : 3)
      if (i % 2 === 0) C.play('wave', t, c.bass * (i % 4 === 2 ? 2 : 1), S * 1.8)
      if (bar < 8 && i % 4 === 0) C.play('p2', t, c.pad[0]!, S * 3.6, { duty: 0.125, vol: 7, decay: 6, floor: 3, arp: semis(c.pad) })
      if (bar >= 8) C.play('p2', t, c.arp[UP_DOWN[i % 8]!]!, S * 0.95, { duty: 0.25, vol: 7, decay: 2, floor: 2 })
      if (bar >= 4 && bar < 8) C.play('p1', t, c.arp[UP_DOWN[i % 8]!]!, S * 0.95, { duty: 0.25, vol: 10, decay: 2, floor: 3 })
      for (const [at, note, len] of NIGHT_LEAD[bar] ?? []) {
        if (at === i) C.play('p1', t, noteHz(note), S * len, { duty: 0.5, vol: 12, decay: 8, floor: 8, vib: { delay: 14, depth: 0.25, rate: 5.5 } })
      }
    },
  },
  pocket: {
    id: 'pocket',
    name: 'Pocket Change',
    bpm: 132,
    bars: 16,
    swing: 0,
    level: 0.36,
    step(C, bar, i, t, S) {
      const b = bar % 8
      const second = bar >= 8
      const name = POCKET_BARS[b] === 'FG' ? (i < 8 ? 'F' : 'G') : POCKET_BARS[b]!
      const c = POCKET[name as keyof typeof POCKET]
      if (i === 0 || i === 8 || ((b === 3 || b === 7) && i === 14)) C.kick(t)
      else if (i === 4 || i === 12) C.snare(t)
      else if (i % 4 === 2 || (second && i % 2 === 1)) C.hat(t, i % 4 === 2 ? 6 : 3)
      const bass = ({ 0: c.root, 4: c.fifth, 8: c.root * 2, 12: c.fifth } as Record<number, number>)[i]
      if (bass) C.play('wave', t, bass, S * 3)
      if (i % 4 === 2) C.play('p2', t, c.stab[0]!, S * 1.4, { duty: 0.125, vol: 8, decay: 2, arp: semis(c.stab) })
      for (const [at, f, len] of POCKET_TUNE[b]!) if (at === i) C.play('p1', t, f, S * len * 0.92, { duty: 0.25, vol: 12, decay: 5, floor: 7 })
    },
  },
  paper: {
    id: 'paper',
    name: 'Paper Cranes',
    bpm: 80,
    bars: 8,
    swing: 0.22,
    level: 0.54,
    step(C, bar, i, t, S) {
      const split = PAPER_BARS[bar] === 'Dm7G7'
      const c = PAPER[(split ? (i < 8 ? 'Dm7' : 'G7') : PAPER_BARS[bar]!) as keyof typeof PAPER]
      if (i === 0 || i === 10 || (bar % 2 === 1 && i === 7)) C.kick(t, i === 0 ? 11 : 8)
      else if (i === 4 || i === 12) C.snare(t, 6)
      else if (i % 2 === 0) C.hat(t, 2 + Math.round(Math.random()))
      if (i % 2 === 0) C.play('p2', t, c.keys[(i / 2) % 4]!, S * 1.9, { duty: 0.5, vol: 6, decay: 5, floor: 2 })
      if (i === 0) C.play('wave', t, c.root, S * 7)
      if (i === 10 && !split) C.play('wave', t, c.fifth, S * 4)
      for (const [at, note] of PAPER_BELLS[bar] ?? []) if (at === i) C.play('p1', t, noteHz(note), S * 3.5, { duty: 0.125, vol: 11, decay: 3, floor: 1 })
    },
  },
  pond: {
    id: 'pond',
    name: 'Pond at Dusk',
    bpm: 60,
    bars: 8,
    swing: 0,
    level: 0.535,
    step(C, bar, i, t, S) {
      if (i === 0) C.play('wave', t, noteHz(bar % 4 < 2 ? 'C3' : 'G2'), S * 16, { vol: 6 })
      if (i === 0 && bar % 2 === 0) C.noise(t, S * 30, { rate: 0.035, vol: 4, swell: true })
      if (Math.random() < 0.09) C.play('p2', t, PENTA[Math.floor(Math.random() * PENTA.length)]!, S * 2, { duty: 0.125, vol: 3, decay: 3 })
      // Crickets, and once in a long while a frog.
      if (Math.random() < 0.06) C.play('p1', t, 4300 + Math.random() * 400, 0.24, { duty: 0.5, vol: 2, gate: 2 })
      else if (Math.random() < 0.006) C.play('p1', t, 180, 0.3, { duty: 0.5, vol: 5, vib: { delay: 0, depth: 2, rate: 25 } })
    },
  },
  hyperspace: {
    id: 'hyperspace',
    name: 'Hyperspace',
    bpm: 152,
    bars: 16,
    swing: 0,
    level: 0.375,
    step(C, bar, i, t, S) {
      const c = HYPER[HYPER_BARS[bar]!]
      const fill = (bar === 7 || bar === 15) && i >= 12
      if (fill) C.snare(t, 9 + (i - 12))
      else if (i === 0 || i === 8 || (bar % 2 === 1 && i === 6)) C.kick(t)
      else if (i === 4 || i === 12) C.snare(t)
      else if (i % 2 === 0) C.hat(t, 4)
      if (i % 2 === 0) C.play('wave', t, c.root * (i % 4 === 2 ? 2 : 1), S * 1.7)
      if (bar < 8) C.play('p2', t, c.arp[UP_DOWN[i % 8]!]!, S * 0.95, { duty: 0.125, vol: 6, decay: 2, floor: 2 })
      else if (i % 4 === 0) C.play('p2', t, c.arp[0]!, S * 3.5, { duty: 0.25, vol: 7, decay: 5, floor: 3, arp: semis(c.arp.slice(0, 3)) })
      for (const [at, f, len] of HYPER_TUNE[bar]!) {
        if (at === i) C.play('p1', t, f, S * len * 0.95, { duty: bar < 8 ? 0.5 : 0.25, vol: 12, decay: 4, floor: 9, vib: { delay: 12, depth: 0.25, rate: 6 } })
      }
    },
  },
  coinop: {
    id: 'coinop',
    name: 'Coin Op',
    bpm: 138,
    bars: 16,
    swing: 0.16,
    level: 0.41,
    step(C, bar, i, t, S) {
      const b = bar % 8
      const second = bar >= 8
      const c = COIN[COIN_BARS[b]!]
      if (i === 0 || i === 8) C.kick(t)
      else if (i === 4 || i === 12) C.snare(t, 11)
      else if (i % 4 === 2 || (second && i % 2 === 1)) C.hat(t, i % 4 === 2 ? 5 : 3)
      const bass = ({ 0: c.root, 4: c.fifth, 8: c.root * 2, 12: c.fifth, 14: c.fifth * 1.122 } as Record<number, number>)[i]
      if (bass && (i !== 14 || b % 2 === 1)) C.play('wave', t, bass, S * (i === 14 ? 1.8 : 3))
      if (!second && i % 4 === 2) C.play('p2', t, c.stab[0]!, S * 1.4, { duty: 0.125, vol: 8, decay: 2, arp: semis(c.stab) })
      for (const [at, f, len] of COIN_TUNE[b]!) {
        if (at === i) C.play('p1', t, f, S * len * 0.9, { duty: 0.25, vol: 12, decay: 4, floor: 7 })
        // The echo: the tune again, quieter, three sixteenths behind on the second square.
        if (second && (at + 3) % 16 === i) C.play('p2', t, f, S * len * 0.9, { duty: 0.25, vol: 5, decay: 4, floor: 2 })
      }
    },
  },
  puzzle: {
    id: 'puzzle',
    name: 'Puzzle Room',
    bpm: 112,
    bars: 8,
    swing: 0,
    level: 0.44,
    step(C, bar, i, t, S) {
      const c = PUZZLE[PUZZLE_BARS[bar]!]
      if (i === 0) C.kick(t, 10)
      else if (i === 12) C.snare(t, 6)
      else if (i % 4 === 2) C.hat(t, 3)
      const bass = ({ 0: c.root, 4: c.fifth, 8: c.root * 2, 12: c.fifth } as Record<number, number>)[i]
      if (bass) C.play('wave', t, bass, S * 3.4)
      C.play('p2', t, c.arp[BROKEN[i % 8]!]!, S * 0.95, { duty: 0.25, vol: 6, decay: 2, floor: 3 })
      for (const [at, f, len] of PUZZLE_TUNE[bar]!) {
        if (at === i) C.play('p1', t, f, S * len * 0.95, { duty: 0.125, vol: 11, decay: 6, floor: 6, vib: { delay: 18, depth: 0.2, rate: 5 } })
      }
    },
  },
  nightpond: {
    id: 'nightpond',
    name: 'Night Pond',
    bpm: 72,
    bars: 8,
    swing: 0,
    level: 0.56,
    step(C, bar, i, t, S) {
      const c = DUSK[DUSK_BARS[bar]!]
      if (i === 0) C.play('wave', t, c.root, S * 15.5, { vol: 8 })
      if (i === 0 && bar % 2 === 0) C.noise(t, S * 30, { rate: 0.03, vol: 3, swell: true })
      if (i % 4 === 0) C.play('p2', t, c.arp[DUSK_ORDER[(bar * 4 + i / 4) % 8]! % 4]!, S * 3.8, { duty: 0.125, vol: 7, decay: 6, floor: 1 })
      if (i % 4 === 2) C.play('p1', t, c.arp[DUSK_ORDER[(bar * 4 + (i - 2) / 4) % 8]! % 4]!, S * 3.6, { duty: 0.125, vol: 3, decay: 7 })
    },
  },
  mountainking: {
    id: 'mountainking',
    name: 'Mountain King',
    bpm: 100,
    // Ten per cent quicker each time round, back to the start after six.
    bpmAt: (loop) => 100 * Math.pow(1.1, loop % 6),
    bars: 8,
    swing: 0,
    level: 0.565,
    step(C, bar, i, t, S) {
      const b = bar % 4
      const high = bar >= 4
      const [b1, b2] = KING_BASS[b]!
      if (i === 0 || i === 8) C.play('wave', t, noteHz(i === 0 ? b1 : b2), S * 1.2)
      if (i === 4 || i === 12) C.play('wave', t, noteHz(i === 4 ? b1 : b2) * 2, S * 1.2)
      if (i === 0) C.kick(t, 11)
      else if (i === 8 && high) C.snare(t, 8)
      else if (i % 4 === 2) C.hat(t, 3)
      for (const [at, f] of KING_TUNE[b]!) {
        if (at !== i) continue
        C.play('p1', t, f * (high ? 2 : 1), S * 1.2, { duty: 0.25, vol: 12, decay: 2, floor: 4 })
        if (high) C.play('p2', t, f, S * 1.2, { duty: 0.5, vol: 8, decay: 2, floor: 2 })
      }
    },
  },
  highscore: {
    id: 'highscore',
    name: 'High Score',
    bpm: 144,
    bars: 8,
    swing: 0,
    level: 0.3,
    step(C, bar, i, t, S) {
      const c = SCORE[SCORE_BARS[bar]!]
      if (i === 0 || i === 6 || i === 8) C.kick(t)
      else if (i === 4 || i === 12) C.snare(t)
      else if (i % 2 === 0) C.hat(t, 4)
      if (i % 2 === 0) C.play('wave', t, c.root * (i % 4 === 2 ? 2 : 1) * 2, S * 1.7)
      if (i === 4 || i === 12) C.play('p2', t, c.stab[0]!, S * 3, { duty: 0.25, vol: 8, decay: 3, floor: 3, arp: semis(c.stab) })
      for (const [at, f, len] of SCORE_TUNE[bar]!) {
        if (at === i) C.play('p1', t, f, S * len * 0.93, { duty: 0.5, vol: 12, decay: 5, floor: 9, vib: { delay: 14, depth: 0.2, rate: 6 } })
      }
    },
  },
  dungeon: {
    id: 'dungeon',
    name: 'Dungeon',
    bpm: 96,
    bars: 8,
    swing: 0,
    level: 0.64,
    step(C, bar, i, t, S) {
      const c = DUNGEON[DUNGEON_BARS[bar]!]
      if (i === 0 || i === 6) C.kick(t, 10)
      else if (i === 12) C.snare(t, 5)
      if (i === 0 || i === 8) C.play('wave', t, c.root, S * 7.5)
      C.play('p2', t, c.ost[i % 4]!, S * 0.9, { duty: 0.125, vol: 6, decay: 2, floor: 2 })
      for (const [at, f, len] of DUNGEON_TUNE[bar]!) {
        if (at === i) C.play('p1', t, f, S * len * 0.97, { duty: 0.25, vol: 11, decay: 10, floor: 6, vib: { delay: 20, depth: 0.35, rate: 4.5 } })
      }
    },
  },
  bonus: {
    id: 'bonus',
    name: 'Bonus Stage',
    bpm: 168,
    bars: 8,
    swing: 0,
    level: 0.49,
    step(C, bar, i, t, S) {
      const c = BONUS[BONUS_BARS[bar]!]
      if (i === 0 || i === 8) C.kick(t)
      else if (i === 4 || i === 12) C.snare(t, 10)
      if (i % 4 === 0) C.play('wave', t, i % 8 === 0 ? c.root : c.fifth, S * 1.8)
      if (i % 4 === 2) C.play('p2', t, c.stab[0]!, S * 1.2, { duty: 0.125, vol: 8, decay: 2, arp: semis(c.stab) })
      for (const [at, f, len] of BONUS_TUNE[bar]!) if (at === i) C.play('p1', t, f, S * len * 0.85, { duty: 0.25, vol: 12, decay: 3, floor: 7 })
    },
  },
  credits: {
    id: 'credits',
    name: 'Credits Roll',
    bpm: 120,
    bars: 8,
    steps: 12,
    swing: 0,
    level: 0.58,
    step(C, bar, i, t, S) {
      const c = CREDITS[CREDITS_BARS[bar]!]
      if (i === 0) C.play('wave', t, c.root, S * 3.6)
      if (i === 4 || i === 8) C.play('p2', t, c.chord[0]!, S * 3.2, { duty: 0.125, vol: 5, decay: 5, floor: 1, arp: semis(c.chord) })
      if (i === 0) C.hat(t, 2)
      for (const [at, f, len] of CREDITS_TUNE[bar]!) {
        if (at === i) C.play('p1', t, f, S * len * 0.95, { duty: 0.5, vol: 10, decay: 9, floor: 5, vib: { delay: 18, depth: 0.25, rate: 5 } })
      }
    },
  },
}

/** Which song plays under each game. */
const GAME_MUSIC: Record<string, TrackId> = {
  // Waves that come quicker, and a tune that does too.
  asteroids: 'mountainking',
  barrage: 'hyperspace',
  patriot: 'nightdrive',
  hotlap: 'highscore',
  marblerun: 'nightdrive',
  // A cave in the dark, and a hunt for something hiding.
  lander: 'dungeon',
  findbug: 'dungeon',
  snake: 'pocket',
  frenzy: 'pocket',
  bop: 'pocket',
  // A bouncy tune for a bird over the hills.
  swoop: 'pocket',
  crosswalk: 'coinop',
  crumbtrail: 'coinop',
  pellets: 'bonus',
  pop: 'bonus',
  // A game show's bonus round for Blip on an obstacle course: quick and bouncy, and no other race's song.
  wobblerun: 'bonus',
  stacker: 'puzzle',
  spotter: 'puzzle',
  pileup: 'puzzle',
  centroid: 'paper',
  halffull: 'paper',
  putt: 'credits',
  acechase: 'credits',
  // A tune to sing back wants no other melody over it.
  fireflies: 'nightpond',
  simon: 'pond',
}

export function trackForGame(slug: string): Track | null {
  const id = GAME_MUSIC[slug]
  return id ? TRACKS[id] : null
}
