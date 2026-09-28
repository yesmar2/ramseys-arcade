import { WANTED, type WantedBug } from '../findbug/wanted'
import type { DayPlan } from './plan'

/*
 * What Half Full's day looks like, none of which changes a glass: what's poured, and who it's for.
 * The guests are Find the Bug's wanted cast, sitting with their drinks.
 */

export type Liquid = {
  name: string
  /** The drink. */
  body: string
  /** Its top, seen from above: lighter. */
  top: string
  /** The far side, in shade. */
  shade: string
  /** Whether it fizzes. */
  bubbles: boolean
}

/** Eight drinks; the plan deals five a day (LIQUID_COUNT). No alcohol: it's a family counter. */
export const LIQUIDS: readonly Liquid[] = [
  { name: 'lemonade', body: '#f7c93c', top: '#fde58c', shade: '#e2a91c', bubbles: true },
  { name: 'orange juice', body: '#f68a2c', top: '#fbb56b', shade: '#d96d14', bubbles: false },
  { name: 'grape juice', body: '#8b4fc7', top: '#b184e0', shade: '#6c37a3', bubbles: false },
  { name: 'cocoa', body: '#8a5433', top: '#b98159', shade: '#6d3f24', bubbles: false },
  { name: 'milk', body: '#fbf7ee', top: '#ffffff', shade: '#e3dccb', bubbles: false },
  { name: 'strawberry milk', body: '#f59fc4', top: '#fbc8de', shade: '#e07aa6', bubbles: false },
  { name: 'lime soda', body: '#8fdc4f', top: '#c2f08e', shade: '#6cbb2f', bubbles: true },
  { name: 'cherry soda', body: '#e3404f', top: '#f27c86', shade: '#bf2837', bubbles: true },
]

export function liquidFor(plan: DayPlan, round: number): Liquid {
  return LIQUIDS[plan.looks.liquids[round]! % LIQUIDS.length]!
}

/** The half glasses' guests, one each, then the split's two: the tall glass's and the wide one's. */
export function guestFor(plan: DayPlan, index: number): WantedBug {
  return WANTED[plan.looks.guests[index]! % WANTED.length]!
}

/** A guest's name for a sentence's start: "The Bug", "Pip". */
export function guestName(w: WantedBug): string {
  return w.name.charAt(0).toUpperCase() + w.name.slice(1)
}

/** "Pip's party cup"; "the Bug's goblet" mid-sentence. */
export function glassOwner(w: WantedBug, glass: string, start = false): string {
  const name = start ? guestName(w) : w.name
  return `${name}’s ${glass}`
}
