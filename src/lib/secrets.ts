/*
 * Secret trophies: odd things a player can do that nothing on the site mentions until they've done them.
 * The API finds them (its secrets.ts, which numbers them the same) when a run is saved, a bug caught or
 * a day's hole sent, and keeps each once an account as a trophy (period 'secret', periodKey its number).
 * Six are the site's easter eggs, which it reports itself (lib/eggs.ts). A reply that found one carries
 * `secrets`; `announceSecrets` puts it on screen. The player's clock goes with what the site posts
 * (leaderboard.ts api), for Night Owl and Early Bird.
 */

export type SecretKey =
  | 'nightowl'
  | 'earlybird'
  | 'grandtour'
  | 'palindrome'
  | 'sevens'
  | 'photofinish'
  | 'soclose'
  | 'holeinone'
  | 'konami'
  | 'blip'
  | 'wish'
  | 'dejavu'
  | 'round'
  | 'marathon'
  | 'barrelroll'
  | 'corner'
  | 'cheats'
  | 'continue'

export type Secret = { n: number; key: SecretKey; name: string; says: string }

export const SECRETS: readonly Secret[] = [
  { n: 1, key: 'nightowl', name: 'Night Owl', says: 'Played a run between 3 and 4 in the morning.' },
  { n: 2, key: 'earlybird', name: 'Early Bird', says: 'Caught the day’s bug before 8 in the morning.' },
  { n: 3, key: 'grandtour', name: 'Grand Tour', says: 'Played every game in the arcade in one day.' },
  { n: 4, key: 'palindrome', name: 'Palindrome', says: 'A score of four figures or more that reads the same backwards.' },
  { n: 5, key: 'sevens', name: 'Lucky Sevens', says: 'A score of nothing but sevens.' },
  { n: 6, key: 'photofinish', name: 'Photo Finish', says: 'Tied for first on a game’s board this week.' },
  { n: 7, key: 'soclose', name: 'So Close', says: 'One point short of a game’s record.' },
  { n: 8, key: 'holeinone', name: 'Hole in One', says: 'Today’s Hole on the very first try.' },
  { n: 9, key: 'konami', name: 'Up Up Down Down', says: 'Found the old cheat code.' },
  { n: 10, key: 'blip', name: 'Blip Blip', says: 'Tapped the blip until it tapped back.' },
  { n: 11, key: 'wish', name: 'Make a Wish', says: 'Saved a run at 11:11.' },
  { n: 12, key: 'dejavu', name: 'Déjà Vu', says: 'The same score twice in a row.' },
  { n: 13, key: 'round', name: 'Round Number', says: 'A score of exactly 1,000, 10,000 or 100,000.' },
  { n: 14, key: 'marathon', name: 'Marathon', says: 'Fifty runs in one day.' },
  { n: 15, key: 'barrelroll', name: 'Barrel Roll', says: 'Asked the search for a barrel roll.' },
  { n: 16, key: 'corner', name: 'Perfect Corner', says: 'Watched the bouncing blip hit the corner.' },
  { n: 17, key: 'cheats', name: 'Nice Try', says: 'Tried an old cheat on the arcade.' },
  { n: 18, key: 'continue', name: 'Continue?', says: 'Put a coin in at Game Over.' },
]

export function secretByNumber(n: number): Secret | undefined {
  return SECRETS.find((s) => s.n === n)
}

/** What a reply says it found. `signedOut`: an egg found with nobody signed in, so nothing was kept. */
export type SecretFound = { key: SecretKey; n: number; name: string; says: string; signedOut?: boolean }

/** A secret was found: the pop-up (SecretToast) shows it. */
export const SECRET_EVENT = 'skermix:secret-found'

export function announceSecrets(found: readonly SecretFound[] | null | undefined) {
  if (!found?.length || typeof window === 'undefined') return
  for (const secret of found) window.dispatchEvent(new CustomEvent<SecretFound>(SECRET_EVENT, { detail: secret }))
}

