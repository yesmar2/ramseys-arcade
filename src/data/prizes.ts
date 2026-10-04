/*
 * The prize counter's catalogue: what tickets trade for. Every prize is a
 * look, never a score: a finish for the avatar's badge, a style for the tag
 * on the boards, a theme behind the player card, confetti for a win, a title
 * under the tag, and the signs on the wall, which put the tag itself in lights.
 *
 * The API owns the ids and prices (its `src/prizes.ts`); keep them in step.
 * A finish is worn as the avatar's badge (lib/avatars.ts), so its id is the
 * badge's word. The rest ride in the avatar string's worn part.
 */

export type PrizeKind = 'finish' | 'name' | 'card' | 'confetti' | 'title' | 'sign'

export type Prize = {
  id: string
  kind: PrizeKind
  name: string
  price: number
  /** What it is, in a line, for the prize's panel. */
  blurb: string
  /**
   * Never for sale: a Today streak earns it (lib/today.ts), and its price is nought. `by` says what earns
   * it, `short` the same for a tile.
   */
  earned?: { by: string; short: string }
}

export const PRIZE_KINDS: Record<PrizeKind, { one: string; many: string }> = {
  finish: { one: 'Badge finish', many: 'Badges' },
  name: { one: 'Name style', many: 'Names' },
  card: { one: 'Card theme', many: 'Cards' },
  confetti: { one: 'Confetti', many: 'Confetti' },
  title: { one: 'Title', many: 'Titles' },
  sign: { one: 'Sign', many: 'Signs' },
}

const TITLE = 'A title under your tag on your player card.'
const ENAMEL = 'A title on an enamel plate, under your tag on your player card.'
const LIT = 'A title in lights, under your tag on your player card.'
const CONFETTI = 'when you top a board or win an event.'

export const PRIZES: readonly Prize[] = [
  { id: 'glitter', kind: 'finish', name: 'Glitter', price: 450, blurb: 'Your own colour, with a little sparkle in it.' },
  { id: 'starfield', kind: 'finish', name: 'Starfield', price: 600, blurb: 'Your badge on a night full of stars.' },
  { id: 'pixels', kind: 'finish', name: '8-bit', price: 700, blurb: 'Your own colour in chunky squares, like an old console.' },
  { id: 'neon', kind: 'finish', name: 'Neon', price: 900, blurb: 'A lit tube on a dark badge. It glows on every board you’re on.' },
  { id: 'lava', kind: 'finish', name: 'Lava', price: 1200, blurb: 'Molten orange glowing up through a cracked black crust.' },
  { id: 'holo', kind: 'finish', name: 'Holo', price: 1500, blurb: 'Every colour at once, and it catches the light.' },
  { id: 'aurora', kind: 'finish', name: 'Aurora', price: 2000, blurb: 'Northern lights rippling across a night-sky badge.' },
  { id: 'nm-outline', kind: 'name', name: 'Outline', price: 150, blurb: 'Your tag drawn in a clean line on the boards.' },
  { id: 'nm-retro', kind: 'name', name: 'Retro', price: 250, blurb: 'Your tag with a chunky 80s shadow on the boards.' },
  { id: 'nm-pixel', kind: 'name', name: 'Pixel', price: 300, blurb: 'Your tag in chunky arcade letters on the boards.' },
  { id: 'nm-glitch', kind: 'name', name: 'Glitch', price: 350, blurb: 'Your tag split into red and blue, like a screen on the blink.' },
  { id: 'nm-candy', kind: 'name', name: 'Candy', price: 400, blurb: 'Your tag in pink, gold and sky on the boards.' },
  { id: 'nm-neon', kind: 'name', name: 'Neon', price: 500, blurb: 'Your tag lit up pink on every board.' },
  { id: 'nm-ember', kind: 'name', name: 'Ember', price: 600, blurb: 'Your tag glowing red-hot, like coals, on every board.' },
  { id: 'cd-checker', kind: 'card', name: 'Checkerboard', price: 600, blurb: 'An old arcade’s checked floor running off to a neon wall, behind your player card.' },
  { id: 'cd-carpet', kind: 'card', name: 'Arcade carpet', price: 750, blurb: 'The old arcade floor, squiggles and all, behind your player card.' },
  { id: 'cd-sunset', kind: 'card', name: 'Sunset grid', price: 1200, blurb: 'A striped sun going down behind a neon grid, behind your player card.' },
  { id: 'cd-asteroids', kind: 'card', name: 'Asteroid belt', price: 1800, blurb: 'Asteroids’ rocks drifting past your player card, with the ship among them.' },
  { id: 'cd-aquarium', kind: 'card', name: 'Aquarium', price: 2500, blurb: 'Frenzy’s fish swimming behind your player card.' },
  { id: 'cd-fireflies', kind: 'card', name: 'Firefly lake', price: 3500, blurb: 'Fireflies’ lanterns and fireflies over the lake at night, behind your player card.' },
  { id: 'cf-stars', kind: 'confetti', name: 'Stars', price: 150, blurb: `Stars go up ${CONFETTI}` },
  { id: 'cf-bubbles', kind: 'confetti', name: 'Bubbles', price: 150, blurb: `Bubbles go up ${CONFETTI}` },
  { id: 'cf-hearts', kind: 'confetti', name: 'Hearts', price: 150, blurb: `Hearts go up ${CONFETTI}` },
  { id: 'cf-pixels', kind: 'confetti', name: 'Pixels', price: 200, blurb: `Chunky pixels in arcade colours go up ${CONFETTI}` },
  { id: 'cf-tickets', kind: 'confetti', name: 'Ticket shower', price: 250, blurb: `Tickets rain down ${CONFETTI}` },
  { id: 'cf-fireworks', kind: 'confetti', name: 'Fireworks', price: 500, blurb: `Fireworks burst over the screen ${CONFETTI}` },
  { id: 't-insert', kind: 'title', name: 'Insert Coin', price: 50, blurb: TITLE },
  { id: 't-start', kind: 'title', name: 'Press Start', price: 50, blurb: TITLE },
  { id: 't-masher', kind: 'title', name: 'Button Masher', price: 60, blurb: TITLE },
  { id: 't-snack', kind: 'title', name: 'Snack Goblin', price: 60, blurb: TITLE },
  { id: 't-owl', kind: 'title', name: 'Night Owl', price: 80, blurb: TITLE },
  { id: 't-early', kind: 'title', name: 'Early Bird', price: 80, blurb: TITLE },
  { id: 't-onemore', kind: 'title', name: 'Just One More', price: 80, blurb: TITLE },
  { id: 't-rage', kind: 'title', name: 'Rage Quitter', price: 100, blurb: TITLE },
  { id: 't-tutorial', kind: 'title', name: 'Tutorial Skipper', price: 100, blurb: TITLE },
  { id: 't-couch', kind: 'title', name: 'Couch Captain', price: 120, blurb: TITLE },
  { id: 't-bugmagnet', kind: 'title', name: 'Bug Magnet', price: 120, blurb: TITLE },
  { id: 't-lurker', kind: 'title', name: 'Leaderboard Lurker', price: 150, blurb: TITLE },
  { id: 't-rat', kind: 'title', name: 'Arcade Rat', price: 300, blurb: ENAMEL },
  { id: 't-jockey', kind: 'title', name: 'Joystick Jockey', price: 350, blurb: ENAMEL },
  { id: 't-muncher', kind: 'title', name: 'Quarter Muncher', price: 350, blurb: ENAMEL },
  { id: 't-hoarder', kind: 'title', name: 'Ticket Hoarder', price: 400, blurb: ENAMEL },
  { id: 't-cannon', kind: 'title', name: 'Glass Cannon', price: 450, blurb: ENAMEL },
  { id: 't-twist', kind: 'title', name: 'Plot Twist', price: 500, blurb: ENAMEL },
  { id: 't-main', kind: 'title', name: 'Main Character', price: 600, blurb: ENAMEL },
  { id: 't-bossmusic', kind: 'title', name: 'Boss Music', price: 700, blurb: ENAMEL },
  { id: 't-secret', kind: 'title', name: 'Secret Level', price: 900, blurb: LIT },
  { id: 't-egg', kind: 'title', name: 'Easter Egg', price: 1000, blurb: LIT },
  { id: 't-extralife', kind: 'title', name: 'Extra Life', price: 1200, blurb: LIT },
  { id: 't-finalboss', kind: 'title', name: 'Final Boss', price: 1500, blurb: LIT },
  { id: 'sign-led', kind: 'sign', name: 'LED board', price: 4000, blurb: 'Your tag in lit dots on a scoreboard, across your player card.' },
  { id: 'sign-marquee', kind: 'sign', name: 'Marquee', price: 6500, blurb: 'Your tag in lights, ringed with bulbs like a show’s opening night.' },
  { id: 'sign', kind: 'sign', name: 'Neon sign', price: 10_000, blurb: 'Your tag in lit tubes across your player card.' },
  { id: 'sign-rooftop', kind: 'sign', name: 'Rooftop', price: 15_000, blurb: 'Your tag in giant neon on a rooftop over the city at night.' },
  // Earned by a Today streak, never traded for (the API's prizes.ts has them too).
  {
    id: 'gilded',
    kind: 'finish',
    name: 'Gold',
    price: 0,
    blurb: 'Your badge in gold leaf, with a shine across it.',
    earned: { by: 'A 30-day Dailies streak', short: '30 days' },
  },
  {
    id: 't-everyday',
    kind: 'title',
    name: 'Every Day',
    price: 0,
    blurb: LIT,
    earned: { by: 'A 100-day Dailies streak', short: '100 days' },
  },
  // Season 1, Space Race: its pass gives these at their levels (the API's seasons.ts).
  ...(
    [
      ['t-space-race', 'title', 'Space Race', 5, LIT],
      ['t-liftoff', 'title', 'Liftoff', 10, LIT],
      ['t-space-cadet', 'title', 'Space Cadet', 16, LIT],
      ['t-zero-g', 'title', 'Zero G', 21, LIT],
      ['t-moonwalker', 'title', 'Moonwalker', 26, LIT],
      ['nm-starlight', 'name', 'Starlight', 2, 'Your tag lit like a star, with one beside it.'],
      ['nm-countdown', 'name', 'Countdown', 11, 'Your tag in mission control’s orange, letters spaced like a countdown clock.'],
      ['nm-nebula', 'name', 'Nebula', 24, 'Your tag in a nebula’s pink and violet.'],
      ['orbit', 'finish', 'Orbit', 4, 'Your badge on a night sky, a moon going round it.'],
      ['ringed', 'finish', 'Ringed planet', 14, 'Your badge as a violet planet with a ring of gold across it.'],
      ['mission', 'finish', 'Mission patch', 22, 'Your badge stitched like a mission patch, a hill of the moon along the bottom.'],
      ['supernova', 'finish', 'Supernova', 30, 'Your badge in the heart of a nebula, a comet going by. The top of the pass.'],
      ['cd-deepfield', 'card', 'Deep field', 6, 'Your card on a night of stars, a ringed planet at its edge.'],
      ['cd-launchpad', 'card', 'Launch pad', 17, 'Your card at the launch pad: the gantry, the rocket and the smoke.'],
      ['cd-nebula', 'card', 'Nebula', 29, 'Your card in a nebula’s clouds of pink and violet, stars being born in them.'],
      ['cf-stardust', 'confetti', 'Stardust', 7, `Twinkling stars ${CONFETTI}`],
      ['cf-shooting', 'confetti', 'Shooting stars', 20, `Shooting stars across the screen ${CONFETTI}`],
      ['sign-liftoff', 'sign', 'Liftoff', 28, 'Your tag in lights beside a rocket lifting off.'],
    ] as const
  ).map(
    ([id, kind, name, level, blurb]): Prize => ({
      id,
      kind,
      name,
      price: 0,
      blurb,
      earned: { by: `Season 1’s pass, level ${level}`, short: 'Season 1' },
    }),
  ),
  // Season 1's Pass+: its second row gives these at their levels (the API's seasons.ts).
  ...(
    [
      ['nm-aurora', 'name', 'Aurora', 4, 'Your tag in an aurora’s ribbon of green, teal and violet.'],
      ['cd-mission', 'card', 'Mission control', 10, 'Your card in mission control: a wall of screens with orbits, the moon’s map and the countdown.'],
      ['cf-meteors', 'confetti', 'Meteor shower', 16, `Fiery meteors streaking across the screen ${CONFETTI}`],
      ['t-commander', 'title', 'Commander', 25, LIT],
      ['eclipse', 'finish', 'Eclipse', 30, 'Your badge as a total eclipse: a black moon, the sun’s corona round it, a diamond of light at its edge.'],
      ['t-flight-director', 'title', 'Flight Director', 2, LIT],
      ['nm-telemetry', 'name', 'Telemetry', 5, 'Your tag as a green readout on mission control’s screens, a cursor after it.'],
      ['cd-porthole', 'card', 'Porthole', 8, 'Your card through a spacecraft’s porthole: a riveted ring, the stars, and the Earth turning below.'],
      ['cf-splashdown', 'confetti', 'Splashdown', 14, `Parachutes drifting down with their capsules, and the splash ${CONFETTI}`],
      ['blue-marble', 'finish', 'Blue marble', 20, 'Your badge as the Earth from space: blue seas, green and brown land, white swirls of cloud.'],
      ['t-ace-pilot', 'title', 'Ace Pilot', 26, LIT],
      ['cd-station', 'card', 'Space station', 29, 'Your card at a space station, its long solar wings over the edge of the Earth.'],
      ['nm-wormhole', 'name', 'Wormhole', 33, 'Your tag swirling from magenta into cyan, a dark glow at its heart.'],
      ['black-hole', 'finish', 'Black hole', 34, 'Your badge as a black hole, a burning ring of light round it bent by its pull.'],
      ['t-legend', 'title', 'Space Race Legend', 35, LIT],
    ] as const
  ).map(
    ([id, kind, name, level, blurb]): Prize => ({
      id,
      kind,
      name,
      price: 0,
      blurb,
      // Past the pass's 30 levels are Pass+'s bonus levels.
      earned: { by: `Season 1’s Pass+, ${level > 30 ? 'bonus ' : ''}level ${level}`, short: 'Pass+' },
    }),
  ),
  {
    id: 't-regular',
    kind: 'title',
    name: 'Regular',
    price: 0,
    blurb: LIT,
    earned: { by: 'Keeping the Dailies on 30 days of Season 1', short: 'Season 1' },
  },
]

const byId = new Map(PRIZES.map((p) => [p.id, p]))

export function prizeById(id: string | null | undefined): Prize | null {
  return (id && byId.get(id)) || null
}

/** What the counter sells: everything but what a streak earns. */
export const FOR_SALE: readonly Prize[] = PRIZES.filter((p) => !p.earned)

/** The badge finishes, as the words an avatar's badge takes. */
export const FINISH_IDS = PRIZES.filter((p) => p.kind === 'finish').map((p) => p.id)

/** Worn in the avatar string's last part: anything but a finish, which is the badge. */
export function isWornPrizeId(id: string): boolean {
  const prize = byId.get(id)
  return !!prize && prize.kind !== 'finish'
}

/** The signs on the wall above the counter, cheapest first. */
export const SIGNS: readonly Prize[] = PRIZES.filter((p) => p.kind === 'sign' && !p.earned).sort((a, b) => a.price - b.price)

/** How a title's plate is made: plain, enamel from 300 tickets, in lights from 900. */
export type PlateTier = 'plain' | 'enamel' | 'lit'

export function plateTier(prize: Prize): PlateTier {
  // An earned title is in lights: a hundred days of Todays is worth it.
  if (prize.earned) return 'lit'
  return prize.price >= 900 ? 'lit' : prize.price >= 300 ? 'enamel' : 'plain'
}

/** The counter's three shelves, dearest first. The signs hang on the wall above them. */
export const SHELVES: { id: 'top' | 'mid' | 'low'; label: string; range: string; holds: (p: Prize) => boolean }[] = [
  { id: 'top', label: 'Top shelf', range: '900 and up', holds: (p) => !p.earned && p.kind !== 'sign' && p.price >= 900 },
  { id: 'mid', label: 'Worth saving for', range: '300 and up', holds: (p) => !p.earned && p.price >= 300 && p.price < 900 },
  { id: 'low', label: 'Pocket change', range: 'Under 300', holds: (p) => !p.earned && p.price < 300 },
]

/** How many days of play a number of tickets is, for "about 3 days": a day's steady play pays about this many. */
export const TICKETS_A_DAY = 75
