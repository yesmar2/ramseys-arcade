/** Gap between you and the place directly ahead (or lead if #1). */

export type GapEntry = {
  rank?: number
  score: number
}

function rankOf(entry: GapEntry, index: number) {
  return entry.rank ?? index + 1
}

export function gapToNextLabel(opts: {
  youRank: number
  youScore: number
  entries: GapEntry[]
  direction?: 'higher' | 'lower'
  formatDelta: (n: number) => string
}): string | null {
  const { youRank, youScore, entries, direction = 'higher', formatDelta } = opts
  if (youRank < 1 || entries.length === 0) return null

  if (youRank === 1) {
    const second = entries.find((e, i) => rankOf(e, i) === 2)
    if (!second) return 'Holding #1'
    const lead =
      direction === 'lower' ? second.score - youScore : youScore - second.score
    if (lead <= 0) return 'Holding #1'
    return `Lead by ${formatDelta(lead)}`
  }

  const ahead = entries.find((e, i) => rankOf(e, i) === youRank - 1)
  if (!ahead) return null
  const gap =
    direction === 'lower' ? youScore - ahead.score : ahead.score - youScore
  if (gap <= 0) return `Tied with #${youRank - 1}`
  return `${formatDelta(gap)} behind #${youRank - 1}`
}

/** Compact row delta: `+12` lead over next, or `−84` behind the place ahead. */
export function rowDeltaLabel(opts: {
  rank: number
  score: number
  entries: GapEntry[]
  direction?: 'higher' | 'lower'
  formatDelta: (n: number) => string
}): string | null {
  const { rank, score, entries, direction = 'higher', formatDelta } = opts
  if (rank < 1 || entries.length === 0) return null

  if (rank === 1) {
    const second = entries.find((e, i) => rankOf(e, i) === 2)
    if (!second) return null
    const lead =
      direction === 'lower' ? second.score - score : score - second.score
    if (lead <= 0) return null
    return `+${formatDelta(lead)}`
  }

  const ahead = entries.find((e, i) => rankOf(e, i) === rank - 1)
  if (!ahead) return null
  const gap =
    direction === 'lower' ? score - ahead.score : ahead.score - score
  if (gap <= 0) return null
  return `−${formatDelta(gap)}`
}

export function flashYouRow(el?: HTMLElement | null) {
  const row = el ?? document.getElementById('lb-you-row')
  if (!row) return
  row.classList.remove('lb-row--flash')
  window.requestAnimationFrame(() => {
    row.classList.add('lb-row--flash')
    window.setTimeout(() => row.classList.remove('lb-row--flash'), 1200)
  })
}
