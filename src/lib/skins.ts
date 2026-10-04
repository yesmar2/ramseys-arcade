import { useEffect, useSyncExternalStore } from 'react'
import { ownedNow, subscribeTickets, useTickets } from './tickets'

/*
 * Skins: a different look for the player's own ship, car or snake in a game, won on a season's pass (the
 * API's seasons.ts gives them; they're owned like prizes, in the tickets' `owned`). Looks only: a skin
 * never changes speed, size, hitbox or score. Chosen per game on its page and kept on this device; a
 * choice the signed-in player doesn't own is ignored, so another account on the device plays in the usual
 * look. Ghosts and replays of other players keep the usual look too.
 */

export type Skin = { id: string; game: string; name: string; season: number; what: string; plus?: boolean }

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
  { id: 'hotlap-midnight', game: 'hotlap', name: 'Midnight rocket', season: 1, what: 'Hot Lap car', plus: true },
  { id: 'hotlap-sunracer', game: 'hotlap', name: 'Sunracer', season: 1, what: 'Hot Lap car', plus: true },
  { id: 'barrage-stingray', game: 'barrage', name: 'Stingray', season: 1, what: 'Barrage ship', plus: true },
  { id: 'snake-saturn-tail', game: 'snake', name: 'Saturn tail', season: 1, what: 'Snake skin', plus: true },
  { id: 'asteroids-orbiter', game: 'asteroids', name: 'Orbiter', season: 1, what: 'Asteroids ship', plus: true },
  { id: 'lander-starhopper', game: 'lander', name: 'Starhopper', season: 1, what: 'Lander ship', plus: true },
]

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
