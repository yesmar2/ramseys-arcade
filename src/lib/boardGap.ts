/** Gap between you and the place directly ahead (or lead if #1). */

export type GapEntry = {
  rank?: number
  score: number
  name?: string
}

export type GapLine = {
  before: string
  /** When set, render as a link to that player's ranking. */
  name?: string
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
}): GapLine | null {
  const { youRank, youScore, entries, direction = 'higher', formatDelta } = opts
  if (youRank < 1 || entries.length === 0) return null

  if (youRank === 1) {
    const second = entries.find((e, i) => rankOf(e, i) === 2)
    if (!second) return { before: 'Holding #1' }
    const lead =
      direction === 'lower' ? second.score - youScore : youScore - second.score
    if (lead <= 0) return { before: 'Holding #1' }
    return { before: `Lead by ${formatDelta(lead)}` }
  }

  const ahead = entries.find((e, i) => rankOf(e, i) === youRank - 1)
  if (!ahead) return null
  const gap =
    direction === 'lower' ? youScore - ahead.score : ahead.score - youScore
  const name = ahead.name?.trim() || undefined
  const fallback = `#${youRank - 1}`
  if (gap <= 0) {
    return name
      ? { before: 'Tied with ', name }
      : { before: `Tied with ${fallback}` }
  }
  return name
    ? { before: `${formatDelta(gap)} behind `, name }
    : { before: `${formatDelta(gap)} behind ${fallback}` }
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
