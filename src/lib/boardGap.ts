/** Gap between you and the place directly ahead (or lead if #1). */

export type GapEntry = {
  rank?: number
  score: number
  name?: string
}

function rankOf(entry: GapEntry, index: number) {
  return entry.rank ?? index + 1
}

function labelFor(entry: GapEntry, fallbackRank: number) {
  const name = entry.name?.trim()
  return name || `#${fallbackRank}`
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
  const who = labelFor(ahead, youRank - 1)
  if (gap <= 0) return `Tied with ${who}`
  return `${formatDelta(gap)} behind ${who}`
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
