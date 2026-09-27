/*
 * Words that do something (lib/eggs.ts): "do a barrel roll" spins the page, and old game cheats answer
 * back. They work typed into the search (components/SiteSearch.tsx) or, on a keyboard, anywhere nothing
 * else is taking keys, spaces left out (components/EasterEggs.tsx, which also plays them).
 */

export type EggWord = {
  /** As it's searched; typed anywhere, it's the same without its spaces. */
  words: string
  egg: 'barrelroll' | 'cheats'
  /** What the arcade says back, on screen and under the search. */
  reply: string
  effect?: 'roll' | 'god'
}

const NICE_TRY = 'Nice try. Tickets are earned here.'

export const EGG_WORDS: readonly EggWord[] = [
  { words: 'do a barrel roll', egg: 'barrelroll', reply: 'Wheee!', effect: 'roll' },
  { words: 'barrel roll', egg: 'barrelroll', reply: 'Wheee!', effect: 'roll' },
  { words: 'iddqd', egg: 'cheats', reply: 'God mode on. Nothing can touch you… for ten seconds.', effect: 'god' },
  { words: 'idkfa', egg: 'cheats', reply: 'All the keys! There are no doors here, though.' },
  { words: 'xyzzy', egg: 'cheats', reply: 'Nothing happens.' },
  { words: 'there is no cow level', egg: 'cheats', reply: 'There is no cow level.' },
  { words: 'rosebud', egg: 'cheats', reply: NICE_TRY },
  { words: 'motherlode', egg: 'cheats', reply: NICE_TRY },
  { words: 'kaching', egg: 'cheats', reply: NICE_TRY },
  { words: 'show me the money', egg: 'cheats', reply: NICE_TRY },
  { words: 'hesoyam', egg: 'cheats', reply: 'Health, armour and a quarter of a million? Nice try.' },
]

/** Fired to play one. */
export const EGG_WORD_EVENT = 'skermix:egg-word'

/** A word said, and where: the search shows its own answer, so only one typed on the page gets the pop-up. */
export type EggWordSaid = { word: EggWord; in: 'search' | 'keys' }

const tidy = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** The egg a search is, if it's one: the words exactly, spaces or not. */
export function eggWordFor(search: string): EggWord | null {
  const said = tidy(search)
  if (!said) return null
  const bare = said.replace(/ /g, '')
  return EGG_WORDS.find((w) => w.words === said || w.words.replace(/ /g, '') === bare) ?? null
}

/** The egg that letters typed anywhere have just finished spelling, if any. */
export function eggWordTyped(letters: string): EggWord | null {
  return EGG_WORDS.find((w) => letters.endsWith(w.words.replace(/ /g, ''))) ?? null
}

/** The longest egg word, typed without spaces: how many letters are worth keeping. */
export const EGG_LETTERS_KEPT = Math.max(...EGG_WORDS.map((w) => w.words.replace(/ /g, '').length))

export function playEggWord(word: EggWord, where: EggWordSaid['in']) {
  window.dispatchEvent(new CustomEvent<EggWordSaid>(EGG_WORD_EVENT, { detail: { word, in: where } }))
}
