import { games, getGame } from '../../data/games'
import { hashDayKey, mulberry32, spotterDayKey, spotterHuntNumber } from './dayKey'

export type SpotterGlitchType =
  | 'name_typo'
  | 'wrong_accent'
  | 'wrong_icon'
  | 'swapped_pair'
  | 'wrong_score'
  | 'wrong_marquee'
  | 'wrong_order'
  | 'coming_soon_live'

export type SpotterVariant = 'poster' | 'cabinet' | 'board'

export type PosterCell = {
  slug: string
  iconSlug: string
  name: string
  accent: string
}

export type CabinetCell = {
  slug: string
  name: string
  accent: string
  score: number
  comingSoon: boolean
}

export type BoardCell = {
  rank: number
  name: string
  score: number
  slug: string
}

export type SpotterPuzzle =
  | {
      variant: 'poster'
      id: string
      huntNumber: number
      cells: PosterCell[]
      answerIndex: number
      glitchType: SpotterGlitchType
      glitchDescription: string
      hintRow: number
      hintCol: number
    }
  | {
      variant: 'cabinet'
      id: string
      huntNumber: number
      cells: CabinetCell[]
      answerIndex: number
      glitchType: SpotterGlitchType
      glitchDescription: string
    }
  | {
      variant: 'board'
      id: string
      huntNumber: number
      cells: BoardCell[]
      answerIndex: number
      glitchType: SpotterGlitchType
      glitchDescription: string
    }

const NAME_TYPOS: Record<string, string[]> = {
  patriot: ['Patrio', 'Patriott'],
  stacker: ['Stackr', 'Stakcer'],
  snake: ['Snak', 'Snakee'],
  asteroids: ['Astroids', 'Asteriods'],
  'dead-center': ['Centriod', 'Centoid'],
  simon: ['Simmon', 'Simo'],
  crosswalk: ['Croswalk', 'Crosswalkk'],
  pop: ['Popp', 'Po'],
  pellets: ['Pellet', 'Pellets'],
  barrage: ['Barage', 'Barragee'],
}

const POSTER_GLITCHES: SpotterGlitchType[] = [
  'name_typo',
  'wrong_accent',
  'wrong_icon',
  'swapped_pair',
]

const CABINET_GLITCHES: SpotterGlitchType[] = [
  'wrong_score',
  'wrong_marquee',
  'coming_soon_live',
]

const BOARD_GLITCHES: SpotterGlitchType[] = ['wrong_order', 'name_typo', 'wrong_score']

const GRID_SIZE = 9
const GRID_COLS = 3

function pickNameTypo(name: string, rand: () => number): string {
  const opts = [
    name.replace(/O/g, '0'),
    name.slice(0, -1) + name.slice(-1) + name.slice(-1),
    name.slice(0, -1),
  ].filter((v) => v && v !== name)
  return opts[Math.floor(rand() * opts.length)] ?? `${name}x`
}

function pickTypo(slug: string, rand: () => number): string {
  const game = getGame(slug)
  const base = game?.name ?? slug
  const options = NAME_TYPOS[slug]
  if (options?.length) return options[Math.floor(rand() * options.length)]
  if (base.length > 4) return base.slice(0, -1)
  return `${base}x`
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function wallSlugs(rand: () => number): string[] {
  const pool = games.map((g) => g.slug)
  const shuffled = shuffle(pool, rand)
  return shuffled.slice(0, GRID_SIZE)
}

function realisticScore(slug: string, rank: number, rand: () => number): number {
  const bands: Record<string, [number, number]> = {
    stacker: [40, 110],
    patriot: [1200, 24000],
    snake: [80, 900],
    pop: [120, 800],
    'dead-center': [3200, 9800],
    asteroids: [800, 14000],
    simon: [6, 22],
    crosswalk: [400, 4200],
    spotter: [15, 90],
  }
  const [min, max] = bands[slug] ?? [100, 999]
  const t = 1 - rank / 4 + (rand() - 0.5) * 0.15
  return Math.round(min + (max - min) * Math.max(0, Math.min(1, t)))
}

function buildPosterPuzzle(
  id: string,
  huntNumber: number,
  rand: () => number,
): Extract<SpotterPuzzle, { variant: 'poster' }> {
  const slugs = wallSlugs(rand)
  const glitchType = POSTER_GLITCHES[Math.floor(rand() * POSTER_GLITCHES.length)]
  let answerIndex = Math.floor(rand() * GRID_SIZE)
  let glitchDescription = 'Something on this tile is wrong.'

  const cells: PosterCell[] = slugs.map((slug) => {
    const game = getGame(slug)!
    return {
      slug,
      iconSlug: slug,
      name: game.name,
      accent: game.accent,
    }
  })

  if (glitchType === 'name_typo') {
    const typo = pickTypo(cells[answerIndex].slug, rand)
    cells[answerIndex] = { ...cells[answerIndex], name: typo }
    glitchDescription = `Wrong name: “${typo}”`
  } else if (glitchType === 'wrong_accent') {
    const donor = cells[(answerIndex + 3) % GRID_SIZE]
    cells[answerIndex] = { ...cells[answerIndex], accent: donor.accent }
    glitchDescription = 'Wrong accent color on this tile'
  } else if (glitchType === 'wrong_icon') {
    const donorIdx = (answerIndex + 1 + Math.floor(rand() * (GRID_SIZE - 1))) % GRID_SIZE
    cells[answerIndex] = {
      ...cells[answerIndex],
      iconSlug: cells[donorIdx].slug,
    }
    glitchDescription = `Wrong icon — that’s not ${cells[answerIndex].name}`
  } else if (glitchType === 'swapped_pair') {
    const col = answerIndex % GRID_COLS
    if (col === GRID_COLS - 1) answerIndex -= 1
    const b = answerIndex + 1
    const nameA = cells[answerIndex].name
    const nameB = cells[b].name
    cells[answerIndex] = { ...cells[answerIndex], name: nameB }
    cells[b] = { ...cells[b], name: nameA }
    glitchDescription = `Swapped names: “${nameB}” / “${nameA}”`
  }

  const hintRow = Math.floor(answerIndex / GRID_COLS)
  const hintCol = answerIndex % GRID_COLS

  return {
    variant: 'poster',
    id,
    huntNumber,
    cells,
    answerIndex,
    glitchType,
    glitchDescription,
    hintRow,
    hintCol,
  }
}

function buildCabinetPuzzle(
  id: string,
  huntNumber: number,
  rand: () => number,
): Extract<SpotterPuzzle, { variant: 'cabinet' }> {
  const count = 5 + Math.floor(rand() * 3)
  const slugs = shuffle(
    games.filter((g) => g.playable).map((g) => g.slug),
    rand,
  ).slice(0, count)
  const answerIndex = Math.floor(rand() * count)
  const glitchType = CABINET_GLITCHES[Math.floor(rand() * CABINET_GLITCHES.length)]

  const cells: CabinetCell[] = slugs.map((slug, i) => {
    const game = getGame(slug)!
    return {
      slug,
      name: game.name,
      accent: game.accent,
      score: realisticScore(slug, i, rand),
      comingSoon: false,
    }
  })

  let glitchDescription = 'This cabinet isn’t right.'

  if (glitchType === 'wrong_score') {
    cells[answerIndex].score = Math.max(cells[answerIndex].score * 8, 9999)
    glitchDescription = `Impossible high score: ${cells[answerIndex].score.toLocaleString()}`
  } else if (glitchType === 'wrong_marquee') {
    const typo = pickTypo(cells[answerIndex].slug, rand)
    cells[answerIndex].name = typo
    glitchDescription = `Marquee typo: “${typo}”`
  } else if (glitchType === 'coming_soon_live') {
    cells[answerIndex].comingSoon = true
    glitchDescription = `${cells[answerIndex].name} marked coming soon`
  }

  return {
    variant: 'cabinet',
    id,
    huntNumber,
    cells,
    answerIndex,
    glitchType,
    glitchDescription,
  }
}

function buildBoardPuzzle(
  id: string,
  huntNumber: number,
  rand: () => number,
): Extract<SpotterPuzzle, { variant: 'board' }> {
  const slug = shuffle(
    games.filter((g) => g.playable).map((g) => g.slug),
    rand,
  )[0]
  const glitchType = BOARD_GLITCHES[Math.floor(rand() * BOARD_GLITCHES.length)]
  const names = shuffle(['JUNO', 'WREN', 'NOVA'], rand)
  const answerIndex = Math.floor(rand() * 3)

  let cells: BoardCell[]
  let glitchDescription: string

  if (glitchType === 'wrong_order') {
    const top = realisticScore(slug, 0, rand)
    const mid = top + Math.round(300 + rand() * 500)
    const low = Math.max(1, top - Math.round(100 + rand() * 200))
    cells = [
      { rank: 1, name: names[0], score: top, slug },
      { rank: 2, name: names[1], score: mid, slug },
      { rank: 3, name: names[2], score: low, slug },
    ]
    glitchDescription = '#2 scored higher than #1'
    return {
      variant: 'board',
      id,
      huntNumber,
      cells,
      answerIndex: 1,
      glitchType,
      glitchDescription,
    }
  }

  if (glitchType === 'name_typo') {
    const typo = pickNameTypo(names[answerIndex], rand)
    cells = [0, 1, 2].map((i) => ({
      rank: i + 1,
      name: i === answerIndex ? typo : names[i],
      score: realisticScore(slug, i, rand),
      slug,
    }))
    glitchDescription = `Name typo: “${typo}”`
  } else {
    cells = [0, 1, 2].map((i) => ({
      rank: i + 1,
      name: names[i],
      score:
        i === answerIndex
          ? Math.max(realisticScore(slug, i, rand) * 10, 50_000)
          : realisticScore(slug, i, rand),
      slug,
    }))
    glitchDescription = `Impossible score: ${cells[answerIndex].score.toLocaleString()}`
  }

  return {
    variant: 'board',
    id,
    huntNumber,
    cells,
    answerIndex,
    glitchType,
    glitchDescription,
  }
}

export function buildDailyPuzzle(dayKey = spotterDayKey()): SpotterPuzzle {
  const rand = mulberry32(hashDayKey(dayKey))
  const huntNumber = spotterHuntNumber(dayKey)
  const roll = rand()

  if (roll < 0.55) return buildPosterPuzzle(dayKey, huntNumber, rand)
  if (roll < 0.8) return buildCabinetPuzzle(dayKey, huntNumber, rand)
  return buildBoardPuzzle(dayKey, huntNumber, rand)
}

export function spotterShareLine(
  huntNumber: number,
  leaderboardMs: number,
  strikes: number,
  glitchDescription: string,
): string {
  const secs = Math.round(leaderboardMs / 1000)
  const m = Math.floor(secs / 60)
  const s = secs % 60
  const time = m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`
  return `Spotter #${huntNumber} · ${time} · ${strikes} wrong · ${glitchDescription}`
}
