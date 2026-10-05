/*
 * Secret trophies: odd things a player can do that nothing on the site mentions until they've done them.
 * The API finds them (its secrets.ts, which numbers them the same) when a run is saved, a bug caught or
 * a day's hole sent, and keeps each once an account as a trophy (period 'secret', periodKey its number).
 * Sixteen are the site's easter eggs, which it reports itself (lib/eggs.ts). A reply that found one carries
 * `secrets`; `announceSecrets` puts it on screen. The player's clock goes with what the site posts
 * (leaderboard.ts api), for Night Owl and Early Bird.
 *
 * Seven are retired, at Ramsey's word (2026-10-05): Palindrome, Lucky Sevens, Photo Finish, So Close, Make a
 * Wish, Déjà Vu and Round Number. Their numbers (4–7, 11–13) stay unused, so every other secret keeps the
 * number its finds are kept under; a find of a retired one is shown nowhere (trophies.ts fetchTrophies, and
 * the API's trophiesForName).
 */

export type SecretKey =
  | 'nightowl'
  | 'earlybird'
  | 'grandtour'
  | 'holeinone'
  | 'konami'
  | 'blip'
  | 'marathon'
  | 'barrelroll'
  | 'corner'
  | 'cheats'
  | 'continue'
  | 'shatter'
  | 'placebo'
  | 'jackpot'
  | 'donuts'
  | 'marbles'
  | 'wargames'
  | 'safespot'
  | 'alien'
  | 'shootingstar'
  | 'moon'

export type Secret = { n: number; key: SecretKey; name: string; says: string }

export const SECRETS: readonly Secret[] = [
  { n: 1, key: 'nightowl', name: 'Night Owl', says: 'Played a run between 3 and 4 in the morning.' },
  { n: 2, key: 'earlybird', name: 'Early Bird', says: 'Caught the day’s bug before 8 in the morning.' },
  { n: 3, key: 'grandtour', name: 'Grand Tour', says: 'Played every game in the arcade in one day.' },
  { n: 8, key: 'holeinone', name: 'Hole in One', says: 'Today’s Hole on the very first try.' },
  { n: 9, key: 'konami', name: 'Up Up Down Down', says: 'Found the old cheat code.' },
  { n: 10, key: 'blip', name: 'Blip Blip', says: 'Tapped the blip until it tapped back.' },
  { n: 14, key: 'marathon', name: 'Marathon', says: 'Fifty runs in one day.' },
  { n: 15, key: 'barrelroll', name: 'Barrel Roll', says: 'Asked the search for a barrel roll.' },
  { n: 16, key: 'corner', name: 'Perfect Corner', says: 'Watched the bouncing blip hit the corner.' },
  { n: 17, key: 'cheats', name: 'Nice Try', says: 'Tried an old cheat on the arcade.' },
  { n: 18, key: 'continue', name: 'Continue?', says: 'Put a coin in at Game Over.' },
  { n: 19, key: 'shatter', name: 'Smashing', says: 'Broke a balanced plate in Centroid.' },
  { n: 20, key: 'placebo', name: 'Placebo', says: 'Pressed the button at a crossing. Nothing happened.' },
  { n: 21, key: 'jackpot', name: 'Jackpot', says: 'Pulled Bop’s lever all the way down to the cherries.' },
  { n: 22, key: 'donuts', name: 'Donuts', says: 'Spun three donuts on Hot Lap’s track.' },
  { n: 23, key: 'marbles', name: 'Lost Your Marbles', says: 'Fell off Marble Run three times before the first checkpoint.' },
  { n: 24, key: 'wargames', name: 'Shall We Play a Game?', says: 'Let a whole wave of Patriot fall without firing a shot.' },
  { n: 25, key: 'safespot', name: 'Safe Spot', says: 'Hid from the chasers in Pellets’ safe spot.' },
  { n: 26, key: 'alien', name: 'Little Green Friend', says: 'Got a wave from the alien in Lander’s cave.' },
  { n: 27, key: 'shootingstar', name: 'Shooting Star', says: 'Caught a shooting star over the Fireflies pond.' },
  { n: 28, key: 'moon', name: 'Shoot the Moon', says: 'Shot the moon over Barrage until it had a black eye.' },
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

