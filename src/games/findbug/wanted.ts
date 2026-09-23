/**
 * Who you are looking for.
 *
 * It used to be one bug, every scene of every run: red and white stripes, a
 * red bobble hat, round glasses. Now each scene has a bug of its own on the
 * wanted card, never the same one twice in a run, and the crowd is dressed
 * around whoever it is — so there are always plenty of others in that shell,
 * that hat or those glasses, and none in all three.
 *
 * Each one is a shell (a colour and a pattern), a hat (a kind and a colour)
 * and glasses, picked so the three read at a glance at the size a critter is
 * drawn in the crowd, and so no two of them could be mistaken for each other.
 */

import { hashString, mulberry32 } from '../../lib/seededRandom'
import { CREAM, INK, NAVY, RED, WHITE, type Glasses, type Hat, type Look, type Pattern } from './critters'

const BLUE = '#3d99d8'
const GREEN = '#40a276'
const YELLOW = '#e6ac39'
const PURPLE = '#7d57d5'
const ORANGE = '#e67732'
const PINK = '#e969a1'
const BLACK = '#2a3136'
const TEAL = '#34aeb4'

export type WantedBug = {
  id: string
  /** As it reads in a sentence: "Find the Bug", "Found Skip!". */
  name: string
  look: Look
  /** The three things that pick it out of a crowd, in words. */
  shell: string
  hat: string
  eyes: string
}

function bug(
  id: string,
  name: string,
  shell: [body: string, trim: string, pattern: Pattern, words: string],
  hat: [kind: Hat, colour: string, trim: string, words: string],
  eyes: Glasses,
): WantedBug {
  return {
    id,
    name,
    look: {
      species: 'beetle',
      body: shell[0],
      trim: shell[1],
      pattern: shell[2],
      head: CREAM,
      limb: NAVY,
      hat: hat[0],
      hatColour: hat[1],
      hatTrim: hat[2],
      glasses: eyes,
      scarf: null,
      held: 'none',
      heldColour: RED,
    },
    shell: shell[3],
    hat: hat[3],
    eyes: eyes === 'shades' ? 'Sunglasses' : 'Round glasses',
  }
}

export const WANTED: readonly WantedBug[] = [
  bug('bug', 'the Bug', [RED, WHITE, 'stripes', 'Red and white stripes'], ['bobble', RED, WHITE, 'Red bobble hat'], 'round'),
  bug('skip', 'Skip', [BLUE, YELLOW, 'spots', 'Blue with yellow spots'], ['cap', GREEN, WHITE, 'Green cap'], 'shades'),
  bug('dotty', 'Dotty', [PURPLE, WHITE, 'dots', 'Purple with white dots'], ['beanie', YELLOW, PURPLE, 'Yellow beanie'], 'round'),
  bug('pickle', 'Pickle', [GREEN, YELLOW, 'stripes', 'Green and yellow stripes'], ['tophat', BLACK, RED, 'Black top hat'], 'round'),
  bug('tiger', 'Tiger', [ORANGE, INK, 'stripes', 'Orange and black stripes'], ['bobble', BLUE, WHITE, 'Blue bobble hat'], 'shades'),
  bug('rosie', 'Rosie', [PINK, WHITE, 'spots', 'Pink with white spots'], ['party', TEAL, YELLOW, 'Teal party hat'], 'round'),
  bug('ziggy', 'Ziggy', [TEAL, WHITE, 'stripes', 'Teal and white stripes'], ['headphones', PURPLE, WHITE, 'Purple headphones'], 'shades'),
  bug('honey', 'Honey', [YELLOW, INK, 'spots', 'Yellow with black spots'], ['cap', RED, WHITE, 'Red cap'], 'round'),
]

/** The original, for anything that wants a Bug without a run to pick one: the thumb, a harness. */
export const CLASSIC = WANTED[0]!

/** A name for the start of a sentence. */
export function titleOf(w: WantedBug): string {
  return w.name.charAt(0).toUpperCase() + w.name.slice(1)
}

/**
 * The run's bugs, scene by scene: every one of them before any comes round
 * again, in an order that is the run's own.
 */
export function wantedFor(runSeed: number, index: number): WantedBug {
  const rng = mulberry32(hashString(`wanted:${runSeed}`))
  const order = WANTED.map((w) => ({ w, r: rng() }))
    .sort((a, b) => a.r - b.r)
    .map((e) => e.w)
  return order[index % order.length]!
}

/** Same shell: a beetle in its colours and pattern. */
export function sameShell(look: Look, w: WantedBug): boolean {
  const t = w.look
  return look.species === t.species && look.pattern === t.pattern && look.body === t.body && look.trim === t.trim
}

export function sameHat(look: Look, w: WantedBug): boolean {
  const t = w.look
  return look.hat === t.hat && look.hatColour === t.hatColour && look.hatTrim === t.hatTrim
}

export function sameEyes(look: Look, w: WantedBug): boolean {
  return look.glasses === w.look.glasses
}

/** All three: nobody in a scene but the wanted bug may have this. */
export function wearsAllOf(look: Look, w: WantedBug): boolean {
  return sameShell(look, w) && sameHat(look, w) && sameEyes(look, w)
}

/**
 * How many of the three a critter shares, 0 to 3 — for anything that wants
 * to know who a searcher would take for the wanted bug at a glance.
 */
export function likeness(look: Look, w: WantedBug): number {
  return (sameShell(look, w) ? 1 : 0) + (sameHat(look, w) ? 1 : 0) + (sameEyes(look, w) ? 1 : 0)
}
