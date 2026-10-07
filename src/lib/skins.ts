import { useEffect, useSyncExternalStore } from 'react'
import { ownedNow, subscribeTickets, useTickets } from './tickets'

/*
 * Skins: a different look for the player's own ship, car or snake in a game, won on a season's pass (the
 * API's seasons.ts gives them) or traded for tickets in the Hangar at the prize counter (the API's prizes.ts,
 * `price`); either way owned like prizes, in the tickets' `owned`. Looks only: a skin
 * never changes speed, size, hitbox or score. Chosen per game on its page and kept on this device; a
 * choice the signed-in player doesn't own is ignored, so another account on the device plays in the usual
 * look. Ghosts and replays of other players keep the usual look too.
 */

/** A skin: a season's (`season`, its pass gives it) or the Hangar's (`price` in tickets, for good). */
export type Skin = { id: string; game: string; name: string; season?: number; price?: number; what: string; plus?: boolean }

export const SKINS: readonly Skin[] = [
  { id: 'lander-moonhopper', game: 'lander', name: 'Moonhopper', season: 1, what: 'Lander ship' },
  { id: 'asteroids-comet', game: 'asteroids', name: 'Comet', season: 1, what: 'Asteroids ship' },
  { id: 'barrage-nova', game: 'barrage', name: 'Nova fighter', season: 1, what: 'Barrage ship' },
  { id: 'hotlap-rocket', game: 'hotlap', name: 'Rocket car', season: 1, what: 'Hot Lap car' },
  { id: 'snake-comet-tail', game: 'snake', name: 'Comet tail', season: 1, what: 'Snake skin' },
  // Season 1's Pass+ row.
  { id: 'asteroids-shuttle', game: 'asteroids', name: 'Shuttle', season: 1, what: 'Asteroids ship', plus: true },
  { id: 'lander-eagle', game: 'lander', name: 'Eagle', season: 1, what: 'Lander ship', plus: true },
  { id: 'barrage-ringship', game: 'barrage', name: 'Ringship', season: 1, what: 'Barrage ship', plus: true },
  { id: 'snake-nebula-tail', game: 'snake', name: 'Nebula tail', season: 1, what: 'Snake skin', plus: true },
  { id: 'hotlap-midnight', game: 'hotlap', name: 'Moon buggy', season: 1, what: 'Hot Lap car', plus: true },
  { id: 'hotlap-sunracer', game: 'hotlap', name: 'Shuttle car', season: 1, what: 'Hot Lap car', plus: true },
  { id: 'barrage-stingray', game: 'barrage', name: 'Stingray', season: 1, what: 'Barrage ship', plus: true },
  { id: 'snake-saturn-tail', game: 'snake', name: 'Saturn tail', season: 1, what: 'Snake skin', plus: true },
  { id: 'asteroids-orbiter', game: 'asteroids', name: 'Orbiter', season: 1, what: 'Asteroids ship', plus: true },
  { id: 'lander-starhopper', game: 'lander', name: 'Starhopper', season: 1, what: 'Lander ship', plus: true },
  // Season 2's (Cold Snap), free row then Pass+. Skins go round the games a season at a time (Ramsey, 2026-10-07):
  // Cold Snap's are Hot Lap's and Snake's, and Swoop's, Marble Run's and Pileup's for the first time. Its Lander,
  // Asteroids and Barrage skins, drawn first, sit this one out (their art stays in lib/skinArt.ts for a later one).
  { id: 'swoop-snow-swift', game: 'swoop', name: 'Snow swift', season: 2, what: 'Swoop bird' },
  { id: 'marblerun-snowball', game: 'marblerun', name: 'Snowball', season: 2, what: 'Marble Run marble' },
  { id: 'pileup-ice-cubes', game: 'pileup', name: 'Ice cubes', season: 2, what: 'Pileup blocks' },
  { id: 'hotlap-ice-rocket', game: 'hotlap', name: 'Bobsled', season: 2, what: 'Hot Lap car' },
  { id: 'snake-snowdrift-tail', game: 'snake', name: 'Snowdrift tail', season: 2, what: 'Snake skin' },
  { id: 'swoop-penguin', game: 'swoop', name: 'Penguin', season: 2, what: 'Swoop bird', plus: true },
  { id: 'marblerun-ice-marble', game: 'marblerun', name: 'Ice marble', season: 2, what: 'Marble Run marble', plus: true },
  { id: 'hotlap-whiteout', game: 'hotlap', name: 'Crystal car', season: 2, what: 'Hot Lap car', plus: true },
  { id: 'pileup-knitted', game: 'pileup', name: 'Knitted', season: 2, what: 'Pileup blocks', plus: true },
  { id: 'marblerun-polar-night', game: 'marblerun', name: 'Polar night', season: 2, what: 'Marble Run marble', plus: true },
  { id: 'snake-aurora-tail', game: 'snake', name: 'Aurora tail', season: 2, what: 'Snake skin', plus: true },
  { id: 'hotlap-borealis', game: 'hotlap', name: 'Aurora glider', season: 2, what: 'Hot Lap car', plus: true },
  { id: 'snake-fireside-tail', game: 'snake', name: 'Fireside tail', season: 2, what: 'Snake skin', plus: true },
  { id: 'swoop-aurora-phoenix', game: 'swoop', name: 'Aurora phoenix', season: 2, what: 'Swoop bird', plus: true },
  { id: 'pileup-northern-lights', game: 'pileup', name: 'Northern lights', season: 2, what: 'Pileup blocks', plus: true },
  // The Hangar's: for good, traded for tickets (the API's prizes.ts has the prices too). Never a season's.
  { id: 'hotlap-green-flash', game: 'hotlap', name: 'Green Flash', price: 1000, what: 'Hot Lap car' },
  { id: 'lander-gold', game: 'lander', name: 'Gold Lander', price: 1500, what: 'Lander ship' },
  { id: 'asteroids-retro', game: 'asteroids', name: 'Retro Wedge', price: 800, what: 'Asteroids ship' },
  { id: 'barrage-paper-plane', game: 'barrage', name: 'Paper Plane', price: 1200, what: 'Barrage ship' },
  { id: 'snake-candy-stripe', game: 'snake', name: 'Candy Stripe', price: 800, what: 'Snake skin' },
]

/** The Hangar's skins, cheapest first. */
export const HANGAR_SKINS: readonly Skin[] = SKINS.filter((s) => s.price != null).sort((a, b) => a.price! - b.price!)

const KEY = 'skermix-skins'
const EVENT = 'arcade-skins'

function readChoices(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export function skinsFor(game: string): Skin[] {
  return SKINS.filter((s) => s.game === game)
}

export function skinById(id: string | null | undefined): Skin | null {
  return (id && SKINS.find((s) => s.id === id)) || null
}

/** The skin the player plays this game in: their choice, if they own it; null for the usual look. */
export function chosenSkin(game: string): string | null {
  const id = readChoices()[game]
  return id && ownedNow().has(id) && skinById(id)?.game === game ? id : null
}

export function chooseSkin(game: string, id: string | null) {
  const choices = readChoices()
  if (id) choices[game] = id
  else delete choices[game]
  try {
    localStorage.setItem(KEY, JSON.stringify(choices))
  } catch {
    /* kept for this page only */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onChange)
  const stopTickets = subscribeTickets(onChange)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('storage', onChange)
    stopTickets()
  }
}

/** The skin chosen for a game, kept up to date as the player chooses or their tickets load. */
export function useChosenSkin(game: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => chosenSkin(game),
    () => null,
  )
}

/**
 * For a game's own loop: keeps `ref` holding the skin to draw the player in, which the loop reads each frame,
 * so a choice or tickets landing late still reach it. It loads what the player owns too, as a play page
 * has no header to have done it.
 */
export function useSkinInto(game: string, ref: { current: string | null }) {
  useTickets()
  const skin = useChosenSkin(game)
  useEffect(() => {
    ref.current = skin
  }, [ref, skin])
}

/** The skins the player owns for a game. */
export function ownedSkins(game: string): Skin[] {
  const owned = ownedNow()
  return skinsFor(game).filter((s) => owned.has(s.id))
}
