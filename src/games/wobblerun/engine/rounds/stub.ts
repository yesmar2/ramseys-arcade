/**
 * A stand-in round, until a round is built: a flat, walled, safe stretch with the round's name on an arch, so a
 * course with that letter in it still lays and still runs. A finale's stand-in ends at a crown on a pedestal.
 * The round's module replaces its `build` with the real one and drops `stub`.
 */
import type { RoundOut, RoundSlot, Tier } from '../types.ts'
import { kit } from './kit.ts'

/** The stand-in stretch: `len` m of floor (a little longer each tier), walled, with an arch. */
export function stubBuild(slot: RoundSlot, tier: Tier, name: string): RoundOut {
  const k = kit(slot, tier)
  const len = 20 + 4 * tier
  k.floor(0, len)
  k.walls(0, len)
  k.deco({ look: 'arch', z: len / 2, sx: 10, sy: 4, sz: 0.6, params: { text: name, stub: true } })
  k.node('in', 0, -1.5)
  if (slot.finale) {
    // A finale's stand-in: the crown bobbing over the end of the floor, walled in on three sides.
    k.box({ x: 0, z: len + 4, hx: 4.5, hz: 4, top: 0, look: 'summit' })
    k.walls(len, len + 8)
    k.box({ x: 0, z: len + 8.25, hx: 5, hz: 0.25, top: 1.2, hy: 0.9, look: 'rail', noGround: true })
    k.deco({ look: 'pedestal', z: len + 5, sx: 1.2, sy: 0.6, sz: 1.2 })
    k.crown({ z: len + 5, y: 2.2, bob: (t) => 0.5 * Math.sin((2 * Math.PI * t) / 2.2) })
    k.node('summit', 0, len + 1.5)
    k.node('crown', 0, len + 5, { y: 0 })
    k.edge('in', 'summit')
    k.edge('summit', 'crown', 'jump', { takeoff: k.at(0, 0, len + 3.2) })
    k.camera('climb')
    return k.done({ x: 0, y: 0, z: len + 8.5 })
  }
  k.node('mid', 0, len / 2)
  k.node('out', 0, len + 1.5)
  k.edge('in', 'mid')
  k.edge('mid', 'out')
  return k.done({ x: 0, y: 0, z: len })
}
