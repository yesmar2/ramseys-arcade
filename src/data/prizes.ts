/*
 * The prize counter's catalogue: what tickets trade for. Every prize is a
 * look, never a score: a finish for the avatar's badge, a style for the tag
 * on the boards, a theme behind the player card, confetti for a win, a title
 * under the tag, and the neon sign at the top of the wall.
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
}

export const PRIZE_KINDS: Record<PrizeKind, { one: string; many: string }> = {
  finish: { one: 'Badge finish', many: 'Badges' },
  name: { one: 'Name style', many: 'Names' },
  card: { one: 'Card theme', many: 'Cards' },
  confetti: { one: 'Confetti', many: 'Confetti' },
  title: { one: 'Title', many: 'Titles' },
  sign: { one: 'Top prize', many: 'Top prize' },
}

const TITLE = 'A title under your tag on your player card.'

export const PRIZES: readonly Prize[] = [
  { id: 'glitter', kind: 'finish', name: 'Glitter', price: 450, blurb: 'Your own colour, with a little sparkle in it.' },
  { id: 'starfield', kind: 'finish', name: 'Starfield', price: 600, blurb: 'Your badge on a night full of stars.' },
  { id: 'neon', kind: 'finish', name: 'Neon', price: 900, blurb: 'A lit tube on a dark badge. It glows on every board you’re on.' },
  { id: 'holo', kind: 'finish', name: 'Holo', price: 1500, blurb: 'Every colour at once, and it catches the light.' },
  { id: 'nm-outline', kind: 'name', name: 'Outline', price: 150, blurb: 'Your tag drawn in a clean line on the boards.' },
  { id: 'nm-pixel', kind: 'name', name: 'Pixel', price: 300, blurb: 'Your tag in chunky arcade letters on the boards.' },
  { id: 'nm-candy', kind: 'name', name: 'Candy', price: 400, blurb: 'Your tag in pink, gold and sky on the boards.' },
  { id: 'nm-neon', kind: 'name', name: 'Neon', price: 500, blurb: 'Your tag lit up pink on every board.' },
  { id: 'cd-carpet', kind: 'card', name: 'Arcade carpet', price: 750, blurb: 'The old arcade floor, squiggles and all, behind your player card.' },
  { id: 'cd-aquarium', kind: 'card', name: 'Aquarium', price: 2500, blurb: 'Frenzy’s fish swimming behind your player card.' },
  { id: 'cf-stars', kind: 'confetti', name: 'Stars', price: 150, blurb: 'Stars go up when you top a board or win an event.' },
  { id: 'cf-bubbles', kind: 'confetti', name: 'Bubbles', price: 150, blurb: 'Bubbles go up when you top a board or win an event.' },
  { id: 'cf-tickets', kind: 'confetti', name: 'Ticket shower', price: 250, blurb: 'Tickets rain down when you top a board or win an event.' },
  { id: 't-masher', kind: 'title', name: 'Button Masher', price: 60, blurb: TITLE },
  { id: 't-snack', kind: 'title', name: 'Snack Break', price: 60, blurb: TITLE },
  { id: 't-owl', kind: 'title', name: 'Night Owl', price: 80, blurb: TITLE },
  { id: 't-early', kind: 'title', name: 'Early Bird', price: 80, blurb: TITLE },
  { id: 't-onemore', kind: 'title', name: 'Just One More', price: 80, blurb: TITLE },
  { id: 't-couch', kind: 'title', name: 'Couch Captain', price: 120, blurb: TITLE },
  { id: 'sign', kind: 'sign', name: 'Neon sign', price: 10_000, blurb: 'Your tag in lit tubes across your player card.' },
]

const byId = new Map(PRIZES.map((p) => [p.id, p]))

export function prizeById(id: string | null | undefined): Prize | null {
  return (id && byId.get(id)) || null
}

/** The badge finishes, as the words an avatar's badge takes. */
export const FINISH_IDS = PRIZES.filter((p) => p.kind === 'finish').map((p) => p.id)

/** Worn in the avatar string's last part: anything but a finish, which is the badge. */
export function isWornPrizeId(id: string): boolean {
  const prize = byId.get(id)
  return !!prize && prize.kind !== 'finish'
}

/** The counter's three shelves, dearest first. The sign hangs on the wall above them. */
export const SHELVES: { id: 'top' | 'mid' | 'low'; label: string; range: string; holds: (p: Prize) => boolean }[] = [
  { id: 'top', label: 'Top shelf', range: '900 and up', holds: (p) => p.kind !== 'sign' && p.price >= 900 },
  { id: 'mid', label: 'Worth saving for', range: '300 and up', holds: (p) => p.price >= 300 && p.price < 900 },
  { id: 'low', label: 'Pocket change', range: 'Under 300', holds: (p) => p.price < 300 },
]

/** How many days of play a number of tickets is, for "about 3 days": a day's steady play pays about this many. */
export const TICKETS_A_DAY = 75
