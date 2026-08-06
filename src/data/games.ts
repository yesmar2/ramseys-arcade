export type Game = {
  name: string
  slug: string
  description: string
  accent: string
  playable?: boolean
}

export const games: Game[] = [
  {
    name: 'Stacker',
    slug: 'stacker',
    description: 'Time the drop. Stack higher. Don’t miss.',
    accent: '#4aa8e8',
    playable: true,
  },
  {
    name: 'Patriot',
    slug: 'patriot',
    description: 'Defend the cities. Aim. Fire. Survive the wave.',
    accent: '#e85d75',
    playable: true,
  },
  {
    name: 'Snake',
    slug: 'snake',
    description: 'Grow longer. Don’t bite yourself.',
    accent: '#3ecf8e',
    playable: true,
  },
  {
    name: 'Memory Match',
    slug: 'memory-match',
    description: 'Flip cards and find the pairs.',
    accent: '#f5b942',
  },
  {
    name: 'Merge 2048',
    slug: 'merge-2048',
    description: 'Slide tiles. Double up. Hit 2048.',
    accent: '#e87a4a',
  },
  {
    name: 'Whack-a-Mole',
    slug: 'whack-a-mole',
    description: 'Tap the moles before they duck.',
    accent: '#c47a3a',
  },
  {
    name: 'Breakout',
    slug: 'breakout',
    description: 'Bounce the ball. Smash every brick.',
    accent: '#5bc0de',
  },
  {
    name: 'Minesweeper',
    slug: 'minesweeper',
    description: 'Clear the board. Avoid the mines.',
    accent: '#6b8cae',
  },
  {
    name: 'Pong',
    slug: 'pong',
    description: 'Classic paddle duel. Don’t miss.',
    accent: '#2eb8a0',
  },
  {
    name: 'Tic-Tac-Toe',
    slug: 'tic-tac-toe',
    description: 'Three in a row wins the round.',
    accent: '#7a6cf0',
  },
]

export function getGame(slug: string) {
  return games.find((game) => game.slug === slug)
}

export function playableGames() {
  return games.filter((g) => g.playable)
}

export function comingSoonGames() {
  return games.filter((g) => !g.playable)
}
