import type { Game } from '../data/games'

/*
 * A game's page, worked out: which games to suggest after it. Its board and its records are their own
 * components (GameBoard.tsx GamePageBoard, RecordBookView.tsx), under the page's tabs.
 */

/* ---------- more games ---------- */

/**
 * Games to suggest from this one: its own kinds first, then the rest of the shelf. `alike` when any of them is
 * one of its kinds: a game none shares a kind with (Putt, the shelf's one sport) is offered more games, not ones
 * like it.
 */
export function moreLike(game: Game, shelf: Game[], count = 6): { games: Game[]; alike: boolean } {
  const tags = new Set(game.tags ?? [])
  const others = shelf.filter((g) => g.slug !== game.slug && !g.comingSoon)
  const shared = (g: Game) => (g.tags ?? []).filter((t) => tags.has(t)).length
  const games = [...others].sort((a, b) => shared(b) - shared(a)).slice(0, count)
  return { games, alike: games.some((g) => shared(g) > 0) }
}
