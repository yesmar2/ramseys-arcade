import { useEffect, useState } from 'react'
import { activeChallenge } from './challenges'

/*
 * Race any ghost (Ramsey picked it, 2026-10-11: a Race button on every board row, and a "Who do you race?"
 * picker on the start card): which player's run a racing daily's ghost drives on a course, when one was picked.
 * A board row's Race button opens the game with ?race=TAG; the start card's picker sets it in place. With none
 * picked the game races as it always has: the next place up, the #1, your best, or the blue. The #1's ghost is
 * anyone's; anyone else's is Plus's (the API's ghost?of=, PlanLimits.anyGhost). Ghosts are only for racing.
 */

/** The racing dailies, whose runs leave ghosts to race. */
export const RACE_GHOST_GAMES: ReadonlySet<string> = new Set(['hotlap', 'marblerun', 'lander', 'swoop', 'wobblerun', 'sling'])

type Pick = { game: string; course: number; tag: string | null }

let picked: Pick | null = null
/** The courses whose ?race= has been read, so a pick cleared on the card isn't brought back by the address. */
const readFromUrl = new Set<string>()
const listeners = new Set<() => void>()

function fromUrl(): string | null {
  try {
    const tag = new URLSearchParams(window.location.search).get('race')
    return tag && /^[A-Za-z0-9_]{1,12}$/.test(tag) ? tag.toUpperCase() : null
  } catch {
    return null
  }
}

/** Race `tag`'s ghost on a course, or none to race as usual. */
export function pickRace(game: string, course: number, tag: string | null) {
  picked = { game, course, tag }
  for (const fn of listeners) fn()
}

/** The tag whose ghost to race on a course, if one was picked (on the card, or by the address's ?race=). */
export function raceTagFor(game: string, course: number): string | null {
  const key = `${game}:${course}`
  if (!readFromUrl.has(key)) {
    readFromUrl.add(key)
    const tag = fromUrl()
    if (tag && !(picked && picked.game === game && picked.course === course)) picked = { game, course, tag }
  }
  return picked && picked.game === game && picked.course === course ? picked.tag : null
}

/** The picked tag on a course, kept current as the picker changes it. */
export function useRaceTag(game: string, course: number): string | null {
  const [tag, setTag] = useState(() => raceTagFor(game, course))
  useEffect(() => {
    setTag(raceTagFor(game, course))
    const fn = () => setTag(raceTagFor(game, course))
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  }, [game, course])
  return tag
}

/** A play link with a ghost to race: `href` plus ?race=TAG. */
export function withRace(href: string, tag: string): string {
  return `${href}${href.includes('?') ? '&' : '?'}race=${encodeURIComponent(tag)}`
}

/**
 * The ghost route's query for `tag`'s run: ?of=TAG, and the challenge link this tab opened when it's TAG's, which
 * opens their ghost to anyone (the API's challengeOpensGhost). Without one, anyone's but the #1's is Plus's.
 */
export function ghostOfQuery(game: string, tag: string): string {
  const challenge = activeChallenge(game)
  const dare = challenge && challenge.name.toUpperCase() === tag.toUpperCase() ? `&challenge=${encodeURIComponent(challenge.id)}` : ''
  return `of=${encodeURIComponent(tag)}${dare}`
}
